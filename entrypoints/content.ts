import { initContentRuntime, type ContentRuntimeHandle } from '@/ui/content-runtime';

export default defineContentScript({
  // matches 只为让 WXT 构建出 content-scripts/content.js：构建钩子（wxt.config.ts）会把
  // manifest.content_scripts 整段删掉，安装时不出现任何站点权限提示（REVIEW B11）。
  // 真实站点由后台按站点配置动态注册（core/registration.ts、core/reconcile.ts）。
  matches: ['https://pagemask.invalid/*'],
  // 与动态注册（core/registration.ts）一致：页面开始解析前启动，首屏防闪
  runAt: 'document_start',
  main() {
    // 同一隔离环境里只跑一份运行时（启用站点时后台对已打开标签页 executeScript 可能与已注册脚本叠加）。
    // window.__pagemask 只在扩展的隔离环境里可见，网页自己的脚本看不到；后台注入后经它直接打开向导。
    const w = window as unknown as { __pagemask?: ContentRuntimeHandle };
    const existing = w.__pagemask;
    if (existing?.alive()) return;
    // 扩展更新 / 重载后旧运行时已失联：撤掉它留在页面上的界面，再启动新的
    existing?.dispose();
    w.__pagemask = initContentRuntime();
  },
});
