import { on } from 'svelte/events';

export const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

let immediateQueued: Array<() => void> = [];
let channel = new MessageChannel();
channel.port2.onmessage = () => {
  immediateQueued.forEach((fn) => {
    fn();
  });
  immediateQueued.splice(0, immediateQueued.length);
};
export const immediate = (fn: () => void) => {
  if (immediateQueued.length === 0) {
    channel.port1.postMessage(true);
  }
  immediateQueued.push(fn);
};
export const tick = () => new Promise<void>((res) => immediate(res));

type Subscriptions = { [eventName: string]: (ev: Event) => void };
export function subscribe(ref: EventTarget, subs: Subscriptions): () => void {
  let unsubscribe: Array<() => void> = [];

  Object.entries(subs).forEach(([eventName, handler]) => {
    unsubscribe.push(on(ref, eventName, handler));
  });

  return () => {
    unsubscribe.forEach((fn) => fn());
  };
}
