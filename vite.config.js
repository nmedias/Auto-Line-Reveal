import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    minify: 'terser',
    lib: {
      entry: 'src/index.ts',
      name: 'AutoLineReveal',
      formats: ['es', 'cjs'],
      fileName: (format) =>
        format === 'cjs' ? 'auto-line-reveal.cjs' : 'auto-line-reveal.js',
    },
    rollupOptions: {
      output: {
        exports: 'named',
      },
    },
  },
});
