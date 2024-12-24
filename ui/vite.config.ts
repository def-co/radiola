import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { sentryVitePlugin as sentry } from '@sentry/vite-plugin';

export default defineConfig({
  plugins: [
    svelte(),
    process.env.NODE_ENV === 'production'
      ? sentry({
        org: process.env.VITE_SENTRY_ORG,
        project: process.env.VITE_SENTRY_PROJECT,
        authToken: process.env.VITE_SENTRY_AUTH_TOKEN,
      })
      : undefined,
  ],
  build: {
    outDir: '../public',
    sourcemap: true,
  },
  server: {
    proxy: {
      '/stations.json': 'https://radiola.p22.co',
      '^/discover/subscribe/': 'https://radiola.p22.co',
    },
  },
});
