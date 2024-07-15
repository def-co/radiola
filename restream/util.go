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

const PACKET_BUFFER_SIZE = 32 * 1024

type packetBuffer struct {
	mu sync.Mutex
	last, curr, next []byte
}
func newPacketBuffer() packetBuffer {
	var pb packetBuffer

	pb.last = make([]byte, 0, PACKET_BUFFER_SIZE)
	pb.curr = make([]byte, 0, PACKET_BUFFER_SIZE)
	pb.next = make([]byte, 0, PACKET_BUFFER_SIZE)

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
func (pb *packetBuffer) Append(buf []byte) bool {
	pb.mu.Lock()
	defer pb.mu.Unlock()

	if len(pb.next) + len(buf) >= PACKET_BUFFER_SIZE {
		return false
	}

	pb.next = append(pb.next, buf...)
	return true
}
func (pb *packetBuffer) NextLength() int {
	pb.mu.Lock()
	defer pb.mu.Unlock()

	return len(pb.next)
}
func (pb *packetBuffer) Rotate() []byte {
	pb.mu.Lock()
	defer pb.mu.Unlock()

	pb.last, pb.curr, pb.next = pb.curr, pb.next, pb.last
	pb.last = pb.last[0:0]
	return pb.curr
}