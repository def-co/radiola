package main

import (
	"log/slog"
	"sync"
)

const (
	LevelWarn = slog.LevelWarn
	LevelInfo = slog.LevelInfo
	LevelDebug = slog.LevelDebug
	LevelSilly = slog.Level(LevelDebug - 4)
)

type fanOut[T any] struct {
	cond *sync.Cond
	ver int
	val T
}

func newFanOut[T any]() fanOut[T] {
	return fanOut[T]{
		cond: sync.NewCond(&sync.Mutex{}),
		ver: 0,
		val: *new(T),
	}
}

func (f *fanOut[T]) Wait() T {
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