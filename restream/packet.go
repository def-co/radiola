package main

import "bytes"

type packet interface {
	Raw() []byte
	Length() uint
	Name() string
}

type packetRaw []byte
func (p packetRaw) Raw() []byte {
	return []byte(p)
}
func (p packetRaw) Length() uint {
	return uint(len(p))
}
func (p packetRaw) Name() string {
	return "unknown"
}

// packet is nil if `p` is empty.
// packetRaw is nil if no remainder remains.
func (p packetRaw) Cast() (packet, packetRaw) {
	if len(p) == 0 {
		return nil, nil
	}

	if len(p) >= 3 && p[0] == 0xFF && p[1] == 0xFB {
		mp3Len := packetMp3(p).Length()
		mp3 := packetMp3(p[0:mp3Len])
		var rest packetRaw
		if len(p) > int(mp3Len) {
			rest = p[mp3Len:]
		}
		return mp3, rest
	}

	if len(p) >= 10 && bytes.Equal(p[0:5], []byte{'I', 'D', '3', 0x04, 0x00}) {
		id3Len := packetId3(p).Length()
		id3 := packetId3(p[0:id3Len])
		var rest packetRaw
		if len(p) > int(id3Len) {
			rest = p[id3Len:]
		}
		return id3, rest
	}

	return p, nil
}

var MP3_BITRATE = [16]uint{0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0}
var MP3_SAMPLE_RATE = [4]uint{44100, 48000, 32000, 0}

type packetMp3 []byte
func (p packetMp3) Raw() []byte {
	return []byte(p)
}
func (p packetMp3) Length() uint {
	b2 := p[2]
	bitrate := b2 >> 4
	sampleRate := (b2 >> 2) & 0b11
	padding := (b2 >> 1) & 0b1

	return 144 * MP3_BITRATE[bitrate] * 1000 / MP3_SAMPLE_RATE[sampleRate] + uint(padding)
}
func (p packetMp3) Name() string {
	return "mp3"
}

type packetId3 []byte
func (p packetId3) Raw() []byte {
	return []byte(p)
}
func (p packetId3) Length() uint {
	if len(p) < 10 {
		return 0
	}

	if !bytes.Equal(p[0:5], []byte{'I', 'D', '3', 0x04, 0x00}) {
		return 0
	}
	
	size := uint(p[6]) << 21 | uint(p[7]) << 14 | uint(p[8]) << 7 | uint(p[9])
	return size + 10
}
func (p packetId3) Name() string {
	return "id3"
}