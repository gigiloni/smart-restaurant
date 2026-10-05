import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['apps/gastro-ui/tests/*.test.ts', 'backend/tests/*.test.ts'],
  },
});
