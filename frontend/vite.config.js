import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig(({ mode }) => ({
  plugins: [svelte()],
  base: mode === 'mobile' ? '/' : '/LLMC/',
  server: {
    port: 5173,
  },
  build: {
    target: 'es2020',
  },
}));
