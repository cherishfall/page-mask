import { initContentRuntime } from '@/ui/content-runtime';

export default defineContentScript({
  // 注意：matches 用一个永不命中的占位地址，仅为让 WXT 构建出
  // content-scripts/content.js 产物；真实站点由后台动态注册（见 ADR-0002）。
  matches: ['https://pagemask.invalid/*'],
  // 与动态注册（core/registration.ts）一致：页面开始解析前启动，首屏防闪
  runAt: 'document_start',
  main() {
    // 防重复初始化（启用站点时后台对已打开标签页 executeScript 可能与已注册脚本叠加）
    const w = window as unknown as { __pagemaskLoaded?: boolean };
    if (w.__pagemaskLoaded) return;
    w.__pagemaskLoaded = true;
    initContentRuntime();
  },
});
