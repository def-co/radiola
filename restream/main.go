package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"log/slog"
	"os"
	"os/signal"
	"regexp"
	"sync/atomic"
	"syscall"
)

var Stations atomic.Pointer[map[string]string]

func loadStations() error {
	stations := make(map[string]string)
	data, err := os.ReadFile(configCurrent.Load().StationsPath)
	if err != nil {
		return fmt.Errorf("stations load: %w", err)
	}

	var stationsRaw [](map[string]any)
	if err := json.Unmarshal(data, &stationsRaw); err != nil {
		return fmt.Errorf("stations parse: %w", err)
	}

	for _, obj := range stationsRaw {
		id := obj["id"].(string)
		hls, ok := obj["hls"]
		if !ok {
			continue
		}
		stations[id] = hls.(string)
	}

	Stations.Store(&stations)
	return nil
}

func setupLogger() {
	lvl := new(slog.LevelVar)
	lvl.Set(LevelSilly)
	h := slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: lvl})
	slog.SetDefault(slog.New(h))
}

func main() {
	setupLogger()

	if err := configBoot(); err != nil {
		panic(err)
	}
	if err := loadStations(); err != nil {
		panic(err)
	}

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
		source, ok := (*Stations.Load())[name]
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

		statusWritten := false
		ensureHeaders := func() {
			if statusWritten {
				return
			}
			w.Header().Set("content-type", "audio/mpeg")
			w.WriteHeader(200)
			statusWritten = true
		}
		
		if buf := strh.s.GetBurst(); buf != nil {
			ensureHeaders()
			w.Write(buf)
		}

		for {
			select {
			case <-r.Context().Done():
				return
			default:
				break
			}

			chunk, err := strh.s.WaitForNext()
			if err != nil {
				if !statusWritten {
					w.WriteHeader(500)
					w.Write([]byte("internal error\n"))
				}
				return
			}

			ensureHeaders()
			_, err = w.Write(chunk)
			// TODO: handle EPIPE here correctly
			if errors.Is(err, io.EOF) || errors.Is(err, syscall.EPIPE) {
				break
			} else if err != nil {
				panic(err)
			}
		}
	})

	listener, err := net.Listen("tcp", configCurrent.Load().ListenOn)
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
			if err := configLoad(); err != nil {
				slog.Error("config reload failed", "err", err)
			} else {
				slog.Info("config reloaded")
			}
			if err := loadStations(); err != nil {
				slog.Error("stations reload failed", "err", err)
			}
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
