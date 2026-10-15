import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    // Monaco (about 850 kB gzipped) is the only chunk this large. It loads lazily after the
    // room is on screen, so the warning would only be noise.
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: {
        // Vendor code changes rarely; separate chunks stay cached across app deploys.
        // React gets its own chunk too; otherwise Rollup can place it inside the Monaco chunk
        // (which also imports React) and the home page would preload the whole editor.
        // The same goes for Vite's tiny dynamic-import helper, which Monaco uses as well.
        manualChunks(id) {
          if (id.includes('vite/preload-helper')) return 'runtime';
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
          if (id.includes('node_modules/monaco-editor') || id.includes('node_modules/@monaco-editor')) return 'monaco';
          if (id.includes('node_modules/yjs') || id.includes('node_modules/y-protocols') || id.includes('node_modules/lib0')) return 'yjs';
          return undefined;
        },
      },
    },
  },
});
