import * as Sentry from '@sentry/node';

if (process.env.MINIRE_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.MINIRE_SENTRY_DSN,
    environment: process.env.NODE_ENV || 'local',
    tracesSampleRate: process.env.NODE_ENV === 'production'
      ? 0.01
      : 1.0,
  });
  console.log('Sentry initialized');
}
