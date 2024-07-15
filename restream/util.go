package main

import (
	"context"
	"log/slog"
	"sync"
)

const (
	LevelWarn = slog.LevelWarn
	LevelInfo = slog.LevelInfo
	LevelDebug = slog.LevelDebug
	LevelSilly = slog.Level(LevelDebug - 4)

	SupportSilly = true
)

func logSilly(logger *slog.Logger, ctx context.Context, msg string, args... any) {
	if !SupportSilly {
		return
	}

	if logger == nil {
		logger = slog.Default()
	}

	logger.Log(ctx, LevelSilly, msg, args...)
}

type notif struct {
	c *sync.Cond
	ver int
}
func newNotif() *notif {
	return &notif{
		c: sync.NewCond(&sync.Mutex{}),
		ver: 0,
	}
}
func (n *notif) Wait() {
	n.c.L.Lock()
	defer n.c.L.Unlock()

	curr := n.ver
	for n.ver == curr {
		n.c.Wait()
	}
}
func (n *notif) Broadcast() {
	n.c.L.Lock()
	defer n.c.L.Unlock()

	n.ver += 1
	n.c.Broadcast()
}

type packetBuffer struct {
	mu sync.Mutex
	size int
	last, curr, next []byte
}
func newPacketBuffer() packetBuffer {
	var pb packetBuffer

	pb.size = configCurrent.Load().ChunkSize
	pb.last = make([]byte, 0, pb.size)
	pb.curr = make([]byte, 0, pb.size)
	pb.next = make([]byte, 0, pb.size)

	return pb
}
func (pb *packetBuffer) GetLast() ([]byte, []byte) {
	pb.mu.Lock()
	defer pb.mu.Unlock()

	return pb.last, pb.curr
}
func (pb *packetBuffer) GetCurr() []byte {
	pb.mu.Lock()
	defer pb.mu.Unlock()

	return pb.curr
}
func (pb *packetBuffer) Append(buf []byte) (rotated bool) {
	pb.mu.Lock()
	defer pb.mu.Unlock()

	if len(pb.next) + len(buf) >= pb.size {
		pb.rotate()
		rotated = true
	}

	pb.next = append(pb.next, buf...)
	return rotated
}
func (pb *packetBuffer) NextLength() int {
	pb.mu.Lock()
	defer pb.mu.Unlock()

	return len(pb.next)
}
func (pb *packetBuffer) Rotate() []byte {
	pb.mu.Lock()
	defer pb.mu.Unlock()

	pb.rotate()
	return pb.curr
}
func (pb *packetBuffer) rotate() {
	pb.last, pb.curr, pb.next = pb.curr, pb.next, pb.last
	pb.next = pb.next[0:0]
}