import { fileURLToPath } from 'node:url';

import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // SWC rather than Vite's esbuild: Nest's dependency injection needs the
  // decorator metadata that only SWC emits.
  plugins: [swc.vite({ module: { type: 'es6' } })],

  resolve: {
    alias: {
      // The contracts' source, so tests never run against a stale build.
      '@smart-restaurant/contracts': fileURLToPath(
        new URL('../contracts/src/index.ts', import.meta.url),
      ),
    },
  },

  test: {
    environment: 'node',

    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.spec.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['test/**/*.int-spec.ts'],
          setupFiles: ['test/support/setup-env.ts'],
          globalSetup: ['test/global-setup.ts'],
          // Every file resets the one test database, so files run one at a time.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
