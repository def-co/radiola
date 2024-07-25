package main

import (
	"context"
	"net"
	"net/http"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
)

func setupLogger() {
	lvl := new(slog.LevelVar)
	lvl.Set(LevelInfo)
	h := slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: lvl})
	slog.SetDefault(slog.New(h))
}

func main() {
	setupLogger()

	if err := configBoot(); err != nil {
		panic(err)
	}

	if err := setupSentry(); err != nil {
		panic(err)
	}

	if err := stationLoad(); err != nil {
		panic(err)
	}

	mgr = newManager()

	listener, err := net.Listen("tcp", configGet().ListenOn)
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
			if err := stationLoad(); err != nil {
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
