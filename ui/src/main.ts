import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';

import './sentry';

const app = mount(App, {
  target: document.getElementById('app')!,
});

if (import.meta.env.PROD) {
  let sc = document.createElement('script');
  sc.src = 'https://st.p22.co/c.js';
  sc.async = true;
  document.body.appendChild(sc);
}
