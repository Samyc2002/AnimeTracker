import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    globals: true,
    coverage: {
      provider: 'v8',
      exclude: [
        'lib/providers/anilist.ts',
        'lib/providers/jikan.ts',
        'lib/providers/kitsu.ts',
        'lib/providers/cache.ts',
        'lib/providers/airing-cache.ts',
        'lib/providers/types.ts',
      ],
      thresholds: {
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
