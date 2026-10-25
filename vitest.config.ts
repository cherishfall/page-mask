import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['core/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
