package main

import (
	"flag"
	"fmt"
	"encoding/json"
	"log/slog"
	"os"
	"sync/atomic"
)

var configLocation = flag.String("config", "", "path to config.json")
var configCurrent atomic.Pointer[config]

func configBoot() error {
	flag.Parse()
	return configLoad()
}

type config struct {
	FfmpegPath string `json:"ffmpeg_path"`
	ListenOn string `json:"listen_on"`
	ChunkSize int `json:"chunk_size"`
	StationsPath string `json:"stations_path"`
}

func configLoad() error {
	data, err := os.ReadFile(*configLocation)
	if err != nil {
		return fmt.Errorf("read config: %w", err)
	}

	conf := new(config)
	if err := json.Unmarshal(data, conf); err != nil {
		return fmt.Errorf("parse config: %w", err)
	}

	slog.Debug("config loaded", "data", conf, "proc", "config")
	configCurrent.Store(conf)

	return nil
}