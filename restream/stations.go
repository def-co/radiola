package main

import (
	"encoding/json"
	"fmt"
	"os"
	"sync/atomic"
)

type Station struct {
	Id string `json:"id"`
	Name string `json:"name"`
	Logo string `json:"logo"`
	StreamMp3 string `json:"stream_mp3"`
	StreamHls string `json:"hls,omitempty"`
	IsOldShoutcast bool `json:"old_shoutcast,omitempty"`
}

type stations struct {
	idOrder []string
	st map[string]Station
}

var _stations atomic.Pointer[stations]

func stationGetAll() []Station {
	s := _stations.Load()
	if s == nil {
		return nil
	}

	stat := make([]Station, 0, len(s.st))
	for _, id := range s.idOrder {
		stat = append(stat, s.st[id])
	}

	return stat
}

func stationGet(name string) (stat Station, ok bool) {
	stations := _stations.Load()
	if stations == nil {
		return
	}

	stat, ok = stations.st[name]
	return
}

func stationLoad() error {
	var stationsRaw []Station

	data, err := os.ReadFile(configGet().StationsPath)
	if err != nil {
		return fmt.Errorf("stations load: %w", err)
	}

	if err := json.Unmarshal(data, &stationsRaw); err != nil {
		return fmt.Errorf("stations parse: %w", err)
	}

	s := new(stations)
	s.st = make(map[string]Station, len(stationsRaw))

	for _, station := range stationsRaw {
		s.idOrder = append(s.idOrder, station.Id)
		s.st[station.Id] = station
	}

	_stations.Store(s)
	return nil
}