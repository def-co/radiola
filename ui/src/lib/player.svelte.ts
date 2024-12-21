import { getContext, setContext } from 'svelte';
import { type IStation } from './types';

export enum EState {
  STOPPED = 'stopped',
  BUFFERING = 'buffering',
  PLAYING = 'playing',
  STALLED = 'stalled',
  ERROR = 'error',
}

export class Player {
  public el: HTMLAudioElement;
  public state: EState = $state(EState.STOPPED);
  public currentStation: IStation | null = $state(null);

  constructor() {
    this.el = document.createElement('audio');
    // this.state = $state(EState.STOPPED);
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
      console.log('[player] error: %o', this.el.error);
      this.state = EState.ERROR;
    });
    // el.addEventListener('timeupdate', () => {
    //   this.#trace('timeupdate', true);
    // });
    // el.addEventListener('progress', () => {
    //   this.#trace('progress', true);
    // });
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
    this.el.play();
    this.state = EState.BUFFERING;
  }

  stop() {
    if (this.state === EState.STOPPED) {
      return;
    }

    this.el.pause();
    this.el.src = '';
    this.state = EState.STOPPED;

    this.currentStation = null;
  }
}

const contextKey = Symbol('Player');

export function getInstance(): Player {
  return getContext(contextKey);
}

export function setInstance(instance: Player): void {
  setContext(contextKey, instance);
}
