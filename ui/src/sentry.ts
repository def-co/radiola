import * as Sentry from '@sentry/browser';
export * as Sentry from '@sentry/browser';

type Client = ReturnType<typeof Sentry.init>;
export let client = undefined as any as Client;

const sentryConfig: Sentry.BrowserOptions = {
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
  ],
  release: '1.30+beta',
  tracesSampleRate: 0.01,
}

if (import.meta.env.PROD) {
  sentryConfig.environment = 'production';
} else {
  sentryConfig.environment = 'local';
  sentryConfig.tracesSampleRate = 1.0;
}

client = Sentry.init(sentryConfig);

if (import.meta.env.DEV) {
  import('@spotlightjs/spotlight').then((Spotlight) => Spotlight.init());
}
