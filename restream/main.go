package main

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"log/slog"
	"os"
	"os/signal"
	"regexp"
	"syscall"
)

var STATIONS = map[string]string{
	"lr1": "https://60766ff53d5e6.streamlock.net/liveALR1/mp4:LR1/playlist.m3u8",
	"lr3": "https://60766ff53d5e6.streamlock.net/liveALR3/mp4:klasika/playlist.m3u8",
}

func setupLogger() {
	lvl := new(slog.LevelVar)
	lvl.Set(LevelSilly)
	h := slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: lvl})
	slog.SetDefault(slog.New(h))
}

func main() {
	setupLogger()
	mgr := newManager()

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
		source, ok := STATIONS[name]
		if !ok {
			w.Header().Set("content-type", "text/plain")
			w.WriteHeader(404)
			w.Write([]byte("not found\n"))
			return
		}

		strh, err := mgr.Get(name, source)
		if err != nil {
			logger.Warn("spawn error", "err", err)

			w.Header().Set("content-type", "text/plain")
			w.WriteHeader(500)
			w.Write([]byte("internal error\n"))

			return
		}

		defer strh.Release()

		h := w.Header()
		h.Set("content-type", "audio/mpeg")
		w.WriteHeader(200)

		if buf := strh.s.GetBurst(); buf != nil {
			w.Write(buf)
		}

		for {
			select {
			case <-r.Context().Done():
				return
			default:
				break
			}

			chunk := strh.s.WaitForNext()
			_, err := w.Write(chunk)
			if errors.Is(err, io.EOF) {
				break
			} else if err != nil {
				panic(err)
			}
		}
	})

	listener, err := net.Listen("tcp", ":8080")
	if err != nil {
		panic(err)
	}

	ctx, cancel := context.WithCancel(context.TODO())
	httpFinish := make(chan struct{})

	go func() {
		slog.Info("listening")
		err := http.Serve(listener, nil)
		select {
		case <-ctx.Done():
			// silence error
			break

		default:
			slog.Warn("http listen error", "err", err)
			break
		}
		close(httpFinish)
	}()

	ch := make(chan os.Signal)
	signal.Notify((chan<- os.Signal)(ch), syscall.SIGINT, syscall.SIGTERM, syscall.SIGHUP)

	for {
		sig := <-ch
		if sig == syscall.SIGHUP {
			slog.Info("reload")
			continue
		}
		if sig == syscall.SIGINT || sig == syscall.SIGTERM {
			cancel()
			listener.Close()
			<-httpFinish
			break
		}
	}
}
