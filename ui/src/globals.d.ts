/// <reference types="svelte" />
/// <reference types="vite/client" />

declare global {
  namespace GoatCounter {
    type Item<T> = T | ((original: T) => T);

    type Data = {
      path?: Item<string>,
      title?: Item<string>,
      referrer?: Item<string>,
      event?: Item<boolean>,
    };

    type Global = {
      no_onload?: boolean;
      no_events?: boolean;
      allow_local?: boolean;
      allow_frame?: boolean;
      endpoint?: string;

      count(data?: Data): void;
      url(Data?: Data): string;
      filter(): string | false;
      bind_events(): void;
      get_query(param: name): string | undefined;
    } & Data;
  }

  interface Window {
    goatcounter?: GoatCounter.Global;
  }
}
