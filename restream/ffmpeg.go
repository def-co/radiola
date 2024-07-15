package main

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"syscall"
	"time"
)

const FFMPEG = "/opt/local/bin/ffmpeg6"
const PIPES = 3

var errTimeout = errors.New("timeout")

func openPipes() (r [PIPES]*os.File, w [PIPES]*os.File, err error) {
	defer func() {
		if err == nil {
			return
		}

		for i := 0; i < PIPES; i += 1 {
			if r[i] != nil {
				r[i].Close()
			}
			if w[i] != nil {
				w[i].Close()
			}
		}
	}()

	for i := 0; i < PIPES; i += 1 {
		if r[i], w[i], err = os.Pipe(); err != nil {
			return r, w, err
		}
	}

	return r, w, nil
}

type process struct {
	p *os.Process
	rfd [PIPES]*os.File
	wfd [PIPES]*os.File
}

func startProcess(source string) (proc process, err error) {
	defer func() {
		if err == nil {
			return
		}
		for _, fd := range proc.rfd {
			if fd != nil {
				fd.Close()
			}
		}
		for _, fd := range proc.wfd {
			if fd != nil {
				fd.Close()
			}
		}
	}()

	args := []string{
		FFMPEG,
		"-loglevel", "warning",
		"-readrate", "1.1",
		"-i", source,
		// "-progress", "fd:", // stdout
		"-map_metadata", "-1",
		"-c:a", "libmp3lame",
		"-q:a", "5",
		"-f", "mp3",
		// "-fd", "3",
		"fd:",
	}

	if proc.rfd, proc.wfd, err = openPipes(); err != nil {
		err = fmt.Errorf("ffmpeg open pipes: %w", err)
		return
	}

	procAttr := os.ProcAttr{
		Files: []*os.File{
			nil,
			proc.wfd[0],
			proc.wfd[1],
			// proc.wfd[2],
		},
	}

	if proc.p, err = os.StartProcess(args[0], args, &procAttr); err != nil {
		err = fmt.Errorf("ffmpeg spawn: %w", err)
		return
	}

	return proc, nil
}

// type progress map[string]string

type stream struct {
	proc process
	packet fanOut[packet]
	// progress fanOut[progress]
	burst ringbuf
	logger *slog.Logger
	finish chan struct{}
}

func startStream(name, source string) (*stream, error) {
	logger := slog.Default().With(
		"proc", "ffmpeg",
		"name", name,
	)

	proc, err := startProcess(source)
	if err != nil {
		return nil, err
	}

	str := &stream{
		proc: proc,
		packet: newFanOut[packet](),
		burst: newRingbuf(48 * 1024),
		logger: logger,
		finish: make(chan struct{}),
	}

	// go str.progressReader()
	go str.errReader()
	go str.dataReader()
	go str.waiter()

	logger.Debug("starting")

	return str, nil
}

func (str *stream) errReader() {
	r := str.proc.rfd[1]
	defer r.Close()
	logger := str.logger.With("gr", "err")

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
			return
		}

		line := sc.Text()
		logger.Warn("read", "data", line)
	}
}

func (str *stream) dataReader() {
	r := str.proc.rfd[0]
	defer r.Close()
	logger := str.logger.With("gr", "data")

	buf := make([]byte, 16 * 1024)
	for {
		logger.Log(nil, LevelSilly, "reading")

		n, err := r.Read(buf)
		if errors.Is(err, io.EOF) {
			logger.Log(nil, LevelSilly, "eof")
			break
		}
		if err != nil {
			logger.Debug("read error", "err", err)
			break
		}

		logger.Log(nil, LevelSilly, "read", "len", n)

		chunk := make([]byte, n)
		copy(chunk, buf[0:n])
		p := packetRaw(chunk)

		hasMp3 := false
		for p != nil {
			pt, rest := p.Cast()
			if pt != nil {
				logger.Log(nil, LevelSilly, "got packet", "type", pt.Name())
				str.packet.Publish(pt)
				if mp3, ok := pt.(packetMp3); ok {
					str.burst.Append(mp3)
					hasMp3 = true
				}
			}
			p = rest
		}
		if hasMp3 {
			logger.Log(nil, LevelSilly, "burst size", "val", str.burst.lengthReporter())
		}
	}
}

func (str *stream) waiter() {
	res, err := str.proc.p.Wait()
	str.logger.Debug("process finished", "code", res.ExitCode(), "err", err)
	close(str.finish)

	for _, fd := range str.proc.wfd {
		fd.Close()
	}
}

func (str *stream) Stop() error {
	str.logger.Debug("interrupting")

	timer := time.NewTimer(2500 * time.Millisecond)
	str.proc.p.Signal(syscall.SIGINT)

	select {
	case <-timer.C:
		str.proc.p.Kill()
		str.logger.Debug("interrupt timed out")
		return errTimeout

	case <-str.finish:
		str.logger.Debug("interrupt shut down")
		return nil
	}
}

func (str *stream) GetBurst() []byte {
	return str.burst.Concat()
}