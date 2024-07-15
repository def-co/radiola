package main

import (
	"sync"
)

type mgrProcess struct {
	s *stream
	refcount uint
}

type manager struct {
	mu sync.Mutex
	procs map[string]mgrProcess
}

type mgrHandle struct {
	mgr *manager
	name string
	s *stream
}

func newManager() *manager {
	mgr := new(manager)
	mgr.procs = make(map[string]mgrProcess)

	return mgr
}

func (mgr *manager) Get(name, source string) (mgrHandle, error) {
	mgr.mu.Lock()
	defer mgr.mu.Unlock()

	proc := mgr.procs[name]
	defer func() {
		mgr.procs[name] = proc
	}()

	if proc.s == nil {
		var err error
		proc.s, err = startStream(name, source)
		if err != nil {
			return mgrHandle{}, err
		}

		proc.refcount = 1
	} else {
		proc.refcount += 1
	}

	return mgrHandle{
		mgr: mgr,
		name: name,
		s: proc.s,
	}, nil
}

func (mh *mgrHandle) Release() {
	mgr := mh.mgr

	mgr.mu.Lock()
	defer mgr.mu.Unlock()

	proc := mgr.procs[mh.name]
	defer func() {
		mgr.procs[mh.name] = proc
	}()

	proc.refcount -= 1
	if proc.refcount == 0 {
		proc.s.Stop()
	}
}