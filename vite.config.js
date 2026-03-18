import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // <-- THIS IS THE S-TIER FIX FOR GITHUB PAGES
  // Use 'src' as the root for source files
  root: '.',
  build: {
    outDir: 'dist',
  },
  server: {
    open: true, // auto-open browser on dev
  },
});