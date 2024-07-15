package main

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"sync"
)

type packet []byte

type fanOut[T any] struct {
	cond *sync.Cond
	ver int
	val T
}

func newFanOut[T any]() *fanOut[T] {
	return &fanOut[T]{
		cond: sync.NewCond(&sync.Mutex{}),
		ver: 0,
		val: *new(T),
	}
}

func (f *fanOut[T]) Subscribe() T {
	f.cond.L.Lock()
	defer f.cond.L.Unlock()

	seen := f.ver
	for f.ver == seen {
		f.cond.Wait()
	}
	return f.val
}
func (f *fanOut[T]) Publish(val T) {
	f.cond.L.Lock()
	defer f.cond.L.Unlock()

	f.ver += 1
	f.val = val

	f.cond.Broadcast()
}

type Stream struct {
	proc *os.Process
	subscriber *fanOut[packet]
	progress chan progress
}

type progress map[string]string

func openPipes() (r [3]*os.File, w [3]*os.File, err error) {
	defer func() {
		if err != nil {
			for i := 0; i < 3; i += 1 {
				if r[i] != nil {
					r[i].Close()
				}
				if w[i] != nil {
					w[i].Close()
				}
			}
		}
	}()

	for i := 0; i < 3; i += 1 {
		if r[i], w[i], err = os.Pipe(); err != nil {
			return r, w, err
		}
	}

	return r, w, nil
}

func startStreamProcess(source string) ([3]*os.File, *os.Process, error) {
	const FFMPEG = "/opt/local/bin/ffmpeg6"

	var r [3]*os.File

	args := []string{
		FFMPEG,
		"-loglevel", "warning",
		"-readrate", "1.1",
		"-i", source,
		"-progress", "fd:", // stdout
		"-c:a", "libmp3lame",
		"-q:a", "5",
		"-f", "mp3",
		"-fd", "3",
		"fd:",
	}

	r, w, err := openPipes()
	if err != nil {
		return r, nil, fmt.Errorf("failed to prepare pipes for ffmpeg: %w", err)
	}

	procAttr := os.ProcAttr{
		Files: []*os.File{
			nil,
			w[0],
			w[1],
			w[2],
		},
	}

	proc, err := os.StartProcess(FFMPEG, args, &procAttr)
	if err != nil {
		return r, nil, fmt.Errorf("failed to spawn ffmpeg: %w", err)
	}

	return r, proc, nil
}

func startStream(source string) (*Stream, error) {
	r, proc, err := startStreamProcess(source)
	if err != nil {
		return nil, err
	}

	str := &Stream{
		proc: proc,
		subscriber: newFanOut[packet](),
		progress: make(chan progress, 1),
	}

	go str.progressReader(r[0])
	go str.errReader(r[1])
	go str.dataReader(r[2])

	return str, nil
}

func (str *Stream) progressReader(r io.ReadCloser) {
	defer r.Close()

	buf := make([]byte, 8192)
	for {
		fmt.Printf("[prog] reading\n")
		n, err := r.Read(buf)
		if errors.Is(err, io.EOF) {
			break
		} else if err != nil {
			panic(err)
		}
		
		prog := make(progress)
		lines := bytes.Split(buf[0:n], []byte("\n"))
		for _, line := range lines {
			if len(line) == 0 {
				continue
			}
			kv := bytes.SplitN(line, []byte("="), 2)
			if len(kv) != 2 {
				continue
			}
			key := string(kv[0])
			value := string(kv[1])
			prog[key] = value
		}

		str.progress <- prog
		fmt.Printf("[prog] %v\n", prog)
	}
}

func (str *Stream) errReader(r io.ReadCloser) {
	defer r.Close()

	sc := bufio.NewScanner(r)
	for {
		fmt.Printf("[err] reading\n")
		if ok := sc.Scan(); !ok {
			err := sc.Err()
			if err == nil { // eof
				break
			}
			panic(err)
		}

		line := sc.Text()
		fmt.Printf("[err] %s\n", line)
	}
}

func (str *Stream) dataReader(r io.ReadCloser) {
	defer r.Close()

	buf := make([]byte, 16 * 1024)
	for {
		fmt.Printf("[data] reading\n")
		n, err := r.Read(buf)
		if errors.Is(err, io.EOF) {
			break
		} else if err != nil {
			panic(err)
		}
		fmt.Printf("[data] received data (%d)\n", n)

		chunk := make([]byte, n)
		copy(chunk, buf[0:n])
		str.subscriber.Publish(chunk)
	}
}


func main() {
	str, err := startStream("https://60766ff53d5e6.streamlock.net/liveALR1/mp4:LR1/playlist.m3u8")
	if err != nil {
		panic(err)
	}

	http.HandleFunc("/stream.mp3", func (w http.ResponseWriter, r *http.Request) {
		fmt.Printf("[http] incoming request\n")
		h := w.Header()
		h.Set("content-type", "audio/mpeg")
		w.WriteHeader(200)

		for {
			chunk := str.subscriber.Subscribe()
			_, err := w.Write(chunk)
			if errors.Is(err, io.EOF) {
				break
			} else if err != nil {
				panic(err)
			}
		}
	})
	panic(http.ListenAndServe(":8080", nil))
}