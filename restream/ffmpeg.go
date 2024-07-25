package main

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	// "syscall"
	"time"
)

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

	ffmpegPath := configCurrent.Load().FfmpegPath

	args := []string{
		ffmpegPath,
		"-loglevel", "warning",
		"-readrate", "1.1",
		"-i", source,
		"-map_metadata", "-1",
		"-c:a", "libmp3lame",
		"-q:a", "5",
		"-f", "mp3",
		"fd:",
	}

	if proc.rfd, proc.wfd, err = openPipes(); err != nil {
		err = fmt.Errorf("ffmpeg open pipes: %w", err)
		return
	}

	procAttr := os.ProcAttr{
		Files: []*os.File{
			proc.rfd[0],
			proc.wfd[1],
			proc.wfd[2],
		},
	}

	if proc.p, err = os.StartProcess(args[0], args, &procAttr); err != nil {
		err = fmt.Errorf("ffmpeg spawn: %w", err)
		return
	}

	return proc, nil
}

type stream struct {
	proc process
	packetNotif *notif
	packetBuf packetBuffer
	logger *slog.Logger
	finish chan struct{}
	st *sentrySessionTracer
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
		packetNotif: newNotif(),
		packetBuf: newPacketBuffer(),
		logger: logger,
		finish: make(chan struct{}),
		st: sentryStartSession(name),
	}

	go str.errReader()
	go str.dataReader()
	go str.waiter()

	logger.Debug("starting")

	return str, nil
}

func (str *stream) errReader() {
	r := str.proc.rfd[2]
	defer r.Close()
	logger := str.logger.With("gr", "err")

	sc := bufio.NewScanner(r)
	for {
		logSilly(logger, nil, "reading")

		if ok := sc.Scan(); !ok {
			err := sc.Err()
			if err == nil { // eof
				logSilly(logger, nil, "eof")
				break
			}

			logger.Debug("read error", "err", err)
			return
		}

		line := sc.Text()
		logger.Warn("read", "data", line)
		str.st.WriteStderr(sc.Bytes())
	}
}

func (str *stream) dataReader() {
	r := str.proc.rfd[1]
	defer r.Close()
	logger := str.logger.With("gr", "data")

	buf := make([]byte, 8 * 1024)

	for {
		logSilly(logger, nil, "reading")

		n, err := r.Read(buf)
		if errors.Is(err, io.EOF) {
			logSilly(logger, nil, "eof")
			break
		}
		if err != nil {
			logger.Debug("read error", "err", err)
			break
		}

		logSilly(logger, nil, "read",
			"len", n,
			"total_len", str.packetBuf.NextLength() + n)
		if rotated := str.packetBuf.Append(buf[:n]); rotated {
			str.st.CapturePacketDispatched(str.packetBuf.CurrLength())
			str.packetNotif.Broadcast()
		}
	}
}

func (str *stream) waiter() {
	res, err := str.proc.p.Wait()
	str.logger.Debug("process finished", "code", res.ExitCode(), "err", err)
	close(str.finish)
	str.st.Finish(res.ExitCode() == 0)
	str.packetNotif.Broadcast()

	for _, fd := range str.proc.wfd {
		fd.Close()
	}
}

func (str *stream) Stop() error {
	str.logger.Debug("interrupting")

	timer := time.NewTimer(2500 * time.Millisecond)
	// str.proc.p.Signal(syscall.SIGINT)
	str.proc.wfd[0].Write([]byte("q"))

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
	last, curr := str.packetBuf.GetLast()
	if len(last) + len(curr) == 0 {
		return nil
	}

	burst := make([]byte, len(last) + len(curr))
	copy(burst, last)
	copy(burst[len(last):], curr)

	return burst
}

func (str *stream) WaitForNext() ([]byte, error) {
	str.packetNotif.Wait()
	select {
	case <-str.finish:
		return nil, io.EOF
	default:
		return str.packetBuf.GetCurr(), nil
	}
}