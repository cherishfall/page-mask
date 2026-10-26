import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  // WXT 官方测试插件：注入 auto-import、@/ 路径别名，并把 `wxt/browser` 替换为内存版 fakeBrowser
  // （fakeBrowser 不实现 scripting / permissions，用到时在测试里 stub）。
  plugins: [WxtVitest()],
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
