package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"log/slog"
	"regexp"
	"syscall"
)

var httpReMp3 *regexp.Regexp
var mgr *manager

func init() {
	httpReMp3 = regexp.MustCompile("^/audio/(\\w+)\\.mp3$")

	http.HandleFunc("/stations.json", httpHandleStations)
	// http.HandleFunc("/status.json", httpHandleStatus)
	http.HandleFunc("/audio/", httpHandleAudio)
}

func httpHandleStations(w http.ResponseWriter, r *http.Request) {
	stat := stationGetAll()
	for i, st := range stat {
		if st.StreamHls != "" {
			st.StreamHls = ""
			st.StreamMp3 = fmt.Sprintf("/audio/%s.mp3", st.Id)
			stat[i] = st
		}
	}

	b, err := json.Marshal(stat)
	if err != nil {
		panic(err)
	}

	w.Header().Set("content-type", "application/json")
	w.Write(b)
}

func httpHandleAudio(w http.ResponseWriter, r *http.Request) {
	logger := slog.Default().With(
		"proc", "http",
		"path", r.URL.Path)

	logger.Debug("request")
	defer logger.Debug("stopped")

	f := httpReMp3.FindSubmatch([]byte(r.URL.Path))
	if f == nil {
		w.Header().Set("content-type", "text/plain")
		w.WriteHeader(404)
		w.Write([]byte("not found\n"))
		return
	}
	name := string(f[1])
	source, _ := stationGet(name)
	if source.StreamHls == "" {
		w.Header().Set("content-type", "text/plain")
		w.WriteHeader(404)
		w.Write([]byte("not found\n"))
		return
	}

	strh, err := mgr.Get(source.Id, source.StreamHls)
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
}
