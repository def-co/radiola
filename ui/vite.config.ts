import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  build: {
    outDir: '../public',
  },
  server: {
    proxy: {
      '/stations.json': 'https://radiola.p22.co',
      '^/discover/subscribe/': 'https://radiola.p22.co',
    },
  },
})
