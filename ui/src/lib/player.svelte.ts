import { getContext, setContext } from 'svelte';
import { type IStation } from './types';

import { Sentry } from '../sentry';
type Span = Sentry.Span;

export enum EState {
  STOPPED = 'stopped',
  BUFFERING = 'buffering',
  PLAYING = 'playing',
  STALLED = 'stalled',
  ERROR = 'error',
}

const average = () => {
  let measurements = [] as number[];
  let timestamps = [] as number[];

  return {
    measure: (val: number) => {
      measurements.push(val);
      timestamps.push(performance.now());
    },
    end: () => {
      if (timestamps.length === 0) {
        return NaN;
      }

      let sum = 0, count = 0;

      for (let i = 0, l = measurements.length - 2; i <= l; i += 1) {
        let val = measurements[i];
        let duration = timestamps[i + 1] - timestamps[i];

        sum += val * duration;
        count += duration;
      }

      return sum / count;
    },
  };
};

export class Player {
  public el: HTMLAudioElement;
  public state: EState = $state(EState.STOPPED);
  public currentStation: IStation | null = $state(null);

  #playbackSpan: Span | null = null;
  #lastProgressSpan: Span | null = null;
  #advanceTracker: ReturnType<typeof average> | null = null;

  constructor() {
    this.el = document.createElement('audio');
    this.#attachListeners();
  }

  #trace(eventName: string, capturePosition = false) {
    if (capturePosition) {
      const now = this.el.currentTime;
      if (this.el.buffered.length > 0) {
        const end = this.el.buffered.end(this.el.buffered.length - 1);
        const remainder = end - now;
        console.log('[player] %s (%.4f / %.4f / %.4fs)', eventName, now, end, remainder);
        return;
      }
      console.log('[player] %s (%.4f)', eventName, now);
      return;
    }
    console.log('[player] %s', eventName);
  }

  #attachListeners() {
    const { el } = this;
    el.addEventListener('playing', () => {
      this.#trace('playing');
      this.state = EState.PLAYING;
    });
    el.addEventListener('waiting', () => {
      this.#trace('waiting', true);
      this.state = EState.BUFFERING;
    });
    el.addEventListener('stalled', () => {
      this.#trace('stalled', true);
      this.state = EState.STALLED;
    });
    el.addEventListener('error', () => {
      if (this.state === EState.STOPPED) {
        // given that we replace the src with the empty string,
        // browsers attempt to play it anyway and encounter an
        // error upon first fetch – don't treat this as an
        // attempt to play
        return;
      }
      console.log('[player] error: %o', el.error);
      this.state = EState.ERROR;
    });
    // el.addEventListener('timeupdate', () => {
    //   this.#trace('timeupdate', true);
    // });
    el.addEventListener('progress', () => {
      if (el.buffered.length) {
        const now = el.currentTime;
        const end = el.buffered.end(el.buffered.length - 1);
        const advance = end - now;
        this.#advanceTracker?.measure(advance);
      }

      this.#trace('progress', true);
    });
    el.addEventListener('pause', () => {
      this.#trace('pause');
    });
  }

  play(station: IStation) {
    if (this.state !== EState.STOPPED) {
      this.stop();
    }

    this.currentStation = station;

    let url = new URL(station.streamUrl);
    url.searchParams.append(Math.random().toString(36).slice(2), '');

    this.el.src = url.toString();
    this.el.play().then(() => {
      Sentry.startSpanManual({
        op: 'radiola.playback',
        name: station.id,
        attributes: {
          'station.stream_url': station.streamUrl,
        },
      }, (span) => {
        this.#playbackSpan = span;
      });
      this.#advanceTracker = average();
    }, (err: Error) => {
      console.warn('[player] play failed: %o', err);

      Sentry.captureException(err, {
        tags: {
          'station.id': station.id,
        },
        fingerprint: ['{{ default }}', station.id],
      });
    });
    this.state = EState.BUFFERING;

    if (('goatcounter' in window) && typeof window.goatcounter !== 'undefined') {
      window.goatcounter.count({
        event: true,
        path: `radiola:station:${station.id}`,
      });
    }
  }

  stop() {
    if (this.state === EState.STOPPED) {
      return;
    }

    this.el.pause();
    this.el.src = '';
    this.state = EState.STOPPED;

    this.currentStation = null;

    if (this.#playbackSpan) {
      Sentry.setMeasurement(
        'radiola.playback_advance',
        this.#advanceTracker!.end(),
        'second',
        this.#playbackSpan!,
      );
      this.#playbackSpan.end();
      this.#playbackSpan = null;
      this.#advanceTracker = null;
    }
  }
}

const contextKey = Symbol('Player');

export function getInstance(): Player {
  return getContext(contextKey);
}

export function setInstance(instance: Player): void {
  setContext(contextKey, instance);
}
