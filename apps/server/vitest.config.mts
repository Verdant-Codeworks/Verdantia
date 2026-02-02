import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      include: ['src/game/engine/**', 'src/game/game.service.ts'],
    },
  },
  resolve: {
    alias: {
      '@verdantia/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
});
