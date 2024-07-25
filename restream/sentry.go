package main

import (
	"bytes"
	"fmt"
	"time"
	"github.com/getsentry/sentry-go"
)

func setupSentry() error {
	return sentry.Init(sentry.ClientOptions{
		Dsn: configGet().SentryDsn,
		Transport: sentry.NewHTTPSyncTransport(),
	})
}

type sentrySessionTracer struct {
	channel string
	ev *sentry.Event
	stderr *bytes.Buffer
	bytesSent uint
	packetsSent uint
}
func sentryStartSession(channel string) *sentrySessionTracer {
	event := sentry.NewEvent()
	event.Message = "ffmpeg session"
	event.Tags["radiola.channel"] = channel

	st := &sentrySessionTracer{
		channel: channel,
		ev: event,
		stderr: new(bytes.Buffer),
	}
	st.recordEvent("start")

	return st
}

func (st *sentrySessionTracer) recordEvent(eventType string) {
	st.ev.Breadcrumbs = append(st.ev.Breadcrumbs, &sentry.Breadcrumb{
		Message: eventType,
		Timestamp: time.Now(),
	})
}

func (st *sentrySessionTracer) CapturePacketDispatched(len int) {
	st.bytesSent += uint(len)
	st.packetsSent += 1
}

func (st *sentrySessionTracer) WriteStderr(chunk []byte) {
	st.stderr.Write(chunk)
	st.stderr.Write([]byte("\n"))
}

func (st *sentrySessionTracer) Finish(ok bool) {
	if ok {
		st.ev.Level = sentry.LevelInfo
		st.ev.Message = "ffmpeg session ok"
		st.ev.Extra["stderr"] = st.stderr.String()
	} else {
		st.ev.Level = sentry.LevelWarning
		st.ev.Message = fmt.Sprintf("ffmpeg session error (%s)\n", st.channel) + st.stderr.String()
	}

	st.ev.Timestamp = time.Now()

	sentry.CaptureEvent(st.ev)
}
