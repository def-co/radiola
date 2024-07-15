package main

import (
	"container/ring"
	"fmt"
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

type ringbuf struct {
	r *ring.Ring
	size int
}

func newRingbuf(size int) ringbuf {
	return ringbuf{
		r: nil,
		size: size,
	}
}

func (r *ringbuf) Length() (total int) {
	r.r.Do(func (val any) {
		total += len(val.([]byte))
	})
	return total
}

func (r *ringbuf) Concat() []byte {
	l := r.Length()
	if l == 0 {
		return nil
	}

	buf := make([]byte, l)

	p := buf
	r.r.Do(func (val any) {
		chunk := val.([]byte)
		copy(p, chunk)
		p = p[len(chunk):]
	})

	return buf
}

func (r *ringbuf) Append(b []byte) {
	total := r.Length()

	for total + len(b) >= r.size {
		if r.r.Next() == r.r {
			r.r = nil
			break
		}

		r.r = r.r.Next()
		r1 := r.r.Prev().Prev().Link(r.r)
		total -= len(r1.Value.([]byte))
	}

	ringEl := new(ring.Ring)
	ringEl.Value = b

	if r.r == nil {
		r.r = ringEl
	} else {
		r.r.Prev().Link(ringEl)
	}
}

type ringbufLenReporter struct {
	r *ringbuf
}
func (r *ringbuf) lengthReporter() ringbufLenReporter {
	return ringbufLenReporter{r}
}
func (r ringbufLenReporter) String() string {
	return fmt.Sprintf("%d", r.r.Length())
}
