package main

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"regexp"
	"sync"
	"syscall"
)

type packet []byte
type packetId3 []byte
type packetMp3 []byte
type Packet interface {
	Raw() []byte
	Length() uint
	Name() string
}

const LevelSilly = slog.Level(slog.LevelDebug - 4)

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

func (p packet) cast() (Packet, packet) {
	if len(p) == 0 {
		return nil, nil
	}

	if len(p) >= 3 && p[0] == 0xFF && p[1] == 0xFB {
		mp3Len := packetMp3(p).Length()
		mp3 := packetMp3(p[0:mp3Len])
		var rest packet
		if len(p) == int(mp3Len) {
			rest = p[mp3Len:]
		}
		return mp3, rest
	}

	if len(p) >= 10 && bytes.Equal(p[0:5], []byte{'I', 'D', '3', 0x04, 0x00}) {
		id3Len := packetId3(p).Length()
		id3 := packetId3(p[0:id3Len])
		var rest packet
		if len(p) == int(id3Len) {
			rest = p[id3Len:]
		}
		return id3, rest
	}

	return p, nil
}
func (p packet) Raw() []byte {
	return []byte(p)
}
func (p packet) Length() uint {
	return uint(len(p))
}
func (p packet) Name() string {
	return "raw"
}

var MP3_BITRATE = [16]uint{0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0}
var MP3_SAMPLE_RATE = [4]uint{44100, 48000, 32000, 0}
func (p packetMp3) Raw() []byte {
	return []byte(p)
}
func (p packetMp3) Length() uint {
	if len(p) < 3 {
		return 0
	}
	if p[0] != 0xFF || p[1] != 0xFB {
		return 0
	}

	b2 := p[2]
	bitrate := b2 >> 4
	sampleRate := (b2 >> 2) & 0b11
	padding := (b2 >> 1) & 0b1

	return 144 * MP3_BITRATE[bitrate] * 1000 / MP3_SAMPLE_RATE[sampleRate] + uint(padding)
}
func (p packetMp3) Name() string {
	return "mp3"
}

func (p packetId3) Raw() []byte {
	return []byte(p)
}
func (p packetId3) Length() uint {
	if len(p) < 10 {
		return 0
	}

	if !bytes.Equal(p[0:5], []byte{'I', 'D', '3', 0x04, 0x00}) {
		return 0
	}
	
	size := uint(p[6]) << 21 | uint(p[7]) << 14 | uint(p[8]) << 7 | uint(p[9])
	return size + 10
}
func (p packetId3) Name() string {
	return "id3"
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

func startStreamProcess(source string) ([3]*os.File, [3]*os.File, *os.Process, error) {
	const FFMPEG = "/opt/local/bin/ffmpeg6"

	var (
		r [3]*os.File
		w [3]*os.File
	)

	args := []string{
		FFMPEG,
		"-loglevel", "warning",
		"-readrate", "1.1",
		"-i", source,
		"-progress", "fd:", // stdout
		"-map_metadata", "-1",
		"-c:a", "libmp3lame",
		"-q:a", "5",
		"-f", "mp3",
		"-fd", "3",
		"fd:",
	}

	r, w, err := openPipes()
	if err != nil {
		return r, w, nil, fmt.Errorf("failed to prepare pipes for ffmpeg: %w", err)
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
		return r, w, nil, fmt.Errorf("failed to spawn ffmpeg: %w", err)
	}

	return r, w, proc, nil
}

type Stream struct {
	proc *os.Process
	subscriber *fanOut[packet]
	progress chan progress
	logger *slog.Logger
	wfds [3]*os.File
	context context.Context
	cancel context.CancelCauseFunc
}

func startStream(name, source string) (*Stream, error) {
	logger := slog.Default().With(
		"proc", "ffmpeg",
		"name", name)

	r, w, proc, err := startStreamProcess(source)
	if err != nil {
		return nil, err
	}

	ctx := context.TODO()
	ctx, cancel := context.WithCancelCause(ctx)

	str := &Stream{
		proc: proc,
		subscriber: newFanOut[packet](),
		progress: make(chan progress, 1),
		logger: logger,
		wfds: w,
		context: ctx,
		cancel: cancel,
	}

	go str.canceller()
	go str.shutdowner()
	go str.progressReader(r[0])
	go str.errReader(r[1])
	go str.dataReader(r[2])

	logger.Debug("starting")

	return str, nil
}

func (str *Stream) Dispose() {
	str.logger.Debug("stopping")
	str.proc.Signal(syscall.SIGINT)
	str.cancel(nil)
}

func (str *Stream) canceller() {
	<-str.context.Done()
	if errors.Is(context.Cause(str.context), context.Canceled) {
		str.logger.Debug("done")
	} else {
		str.logger.Debug("interrupted", "err", context.Cause(str.context))
		str.proc.Kill()
	}
}

func (str *Stream) shutdowner() {
	str.proc.Wait()
	str.logger.Debug("finished")

	for _, fd := range str.wfds {
		fd.Close()
	}
}

func (str *Stream) progressReader(r io.ReadCloser) {
	defer r.Close()
	defer close(str.progress)
	logger := str.logger.With("thr", "progress")

	buf := make([]byte, 8192)
	for {
		logger.Log(nil, LevelSilly, "reading")

		n, err := r.Read(buf)
		if errors.Is(err, io.EOF) {
			logger.Log(nil, LevelSilly, "eof")
			break
		} else if err != nil {
			logger.Debug("read error", "err", err)
			// panic(err)
			return
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

		logger.Log(nil, LevelSilly, "read", "data", prog)

		select {
		case str.progress <- prog:
			logger.Log(nil, LevelSilly, "submitted")
			break
		default:
			logger.Log(nil, LevelSilly, "submit failed, no reader")
			break
		}
	}
}

func (str *Stream) errReader(r io.ReadCloser) {
	defer r.Close()
	logger := str.logger.With("thr", "err")

	sc := bufio.NewScanner(r)
	for {
		logger.Log(nil, LevelSilly, "reading")

		if ok := sc.Scan(); !ok {
			err := sc.Err()
			if err == nil { // eof
				logger.Log(nil, LevelSilly, "eof")
				break
			}
			logger.Debug("read error", "err", err)
			// panic(err)
			return
		}

		line := sc.Text()

		logger.Log(nil, LevelSilly, "read", "data", line)
	}
}

func (str *Stream) dataReader(r io.ReadCloser) {
	defer r.Close()
	logger := str.logger.With("thr", "data")

	buf := make([]byte, 16 * 1024)
	for {
		logger.Log(nil, LevelSilly, "reading")

		n, err := r.Read(buf)
		if errors.Is(err, io.EOF) {
			logger.Log(nil, LevelSilly, "eof")
			break
		} else if err != nil {
			logger.Debug("read error", "err", err)
			// panic(err)
			return
		}

		logger.Log(nil, LevelSilly, "read", "len", n)

		chunk := make([]byte, n)
		copy(chunk, buf[0:n])
		p := packet(chunk)

		for p != nil {
			pt, rest := p.cast()
			if pt != nil {
				logger.Log(nil, LevelSilly, "got packet", "type", pt.Name())
				str.subscriber.Publish(pt.Raw())
			}
			p = rest
		}

		str.subscriber.Publish(chunk)
	}
}

var STATIONS = map[string]string{
	"lr1": "https://60766ff53d5e6.streamlock.net/liveALR1/mp4:LR1/playlist.m3u8",
	"lr3": "https://60766ff53d5e6.streamlock.net/liveALR3/mp4:klasika/playlist.m3u8",
}

var errNotFound = errors.New("not found")

type streamManager struct {
	mu sync.Mutex
	streams map[string]*Stream
	refcount map[string]uint
}
func (sm *streamManager) Open(name string) (*Stream, error) {
	strUrl, ok := STATIONS[name]
	if !ok {
		return nil, errNotFound
	}

	sm.mu.Lock()
	defer sm.mu.Unlock()

	if sm.refcount[name] == 0 {
		str, err := startStream(name, strUrl)
		if err != nil {
			return nil, fmt.Errorf("could not open shared stream: %w", err)
		}
		sm.streams[name] = str
	}
	sm.refcount[name] += 1

	return sm.streams[name], nil
}
func (sm *streamManager) Release(name string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	sm.refcount[name] -= 1
	if sm.refcount[name] == 0 {
		sm.streams[name].Dispose()
	}
}

func setupLogger() {
	lvl := new(slog.LevelVar)
	lvl.Set(slog.LevelDebug)
	h := slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: lvl})
	slog.SetDefault(slog.New(h))
}

func main() {
	setupLogger()
	streams := new(streamManager)
	streams.streams = make(map[string]*Stream)
	streams.refcount = make(map[string]uint)

	re := regexp.MustCompile("^/(\\w+)\\.mp3$")

	http.HandleFunc("/", func (w http.ResponseWriter, r *http.Request) {
		logger := slog.Default().With(
			"proc", "http",
			"path", r.URL.Path)

		logger.Debug("request")
		defer logger.Debug("stopped")

		f := re.FindSubmatch([]byte(r.URL.Path))
		if f == nil {
			w.Header().Set("content-type", "text/plain")
			w.WriteHeader(404)
			w.Write([]byte("not found\n"))
			return
		}
		name := string(f[1])
		str, err := streams.Open(name)
		if err != nil {
			buf := make([]byte, len(err.Error()), len(err.Error()) + 1)
			copy(buf, err.Error())
			buf = append(buf, '\n')

			w.Header().Set("content-type", "text/plain")
			w.WriteHeader(500)
			w.Write(buf)

			return
		}

		defer streams.Release(name)

		h := w.Header()
		h.Set("content-type", "audio/mpeg")
		w.WriteHeader(200)

		for {
			select {
			case <-r.Context().Done():
				return
			default:
			}

			chunk := str.subscriber.Subscribe()
			_, err := w.Write(chunk)
			if errors.Is(err, io.EOF) {
				break
			} else if err != nil {

				panic(err)
			}
		}
	})

	slog.Info("listening")
	panic(http.ListenAndServe(":8080", nil))
}
