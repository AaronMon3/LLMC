import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig(({ command, mode }) => ({
  plugins: [svelte()],
  base: command === 'build' && mode !== 'mobile' ? '/LLMC/' : '/',
  server: {
    port: 5173,
  },
  build: {
    target: 'es2020',
  },
}));
