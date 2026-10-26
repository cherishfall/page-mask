import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['core/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text-summary', 'html', 'lcov'],
      // 显式列出被统计的源码，未被测试引用的文件也计入（覆盖率缺口一目了然）。
      include: ['core/**/*.ts', 'ui/**/*.{ts,vue}', 'entrypoints/**/*.{ts,vue}'],
      exclude: ['**/*.test.ts', '**/*.d.ts'],
    },
  },
});
