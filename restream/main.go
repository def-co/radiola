package main

import (
	"errors"
	"io"
	"net/http"
	"log/slog"
	"os"
	"regexp"
)

var STATIONS = map[string]string{
	"lr1": "https://60766ff53d5e6.streamlock.net/liveALR1/mp4:LR1/playlist.m3u8",
	"lr3": "https://60766ff53d5e6.streamlock.net/liveALR3/mp4:klasika/playlist.m3u8",
}

func setupLogger() {
	lvl := new(slog.LevelVar)
	lvl.Set(LevelDebug)
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

		for {
			select {
			case <-r.Context().Done():
				return
			default:
				break
			}

			packet := strh.s.packet.Wait()
			_, err := w.Write(packet.Raw())
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
