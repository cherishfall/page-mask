// 运行时的值导入只能在 main 里用到：WXT 构建时会剥掉 main 读取入口选项，顶层还在用的导入会被
// 一起加载进那个环境（Vue 单文件组件 / ?inline 样式在那里加载不了）。类型单独用 import type
import { initContentRuntime } from '@/ui/content-runtime';
import type { ContentRuntimeHandle } from '@/ui/content-runtime';
import type { StyleRecord } from '@/core/doc-styles';

/** 隔离环境里登记的上一个实例；兼容 0.2.0 之前的句柄（只有 dispose，没有 handover） */
type RegisteredHandle = Partial<ContentRuntimeHandle> & { dispose?: () => void };

export default defineContentScript({
  // matches 只为让 WXT 构建出 content-scripts/content.js：构建钩子（wxt.config.ts）会把
  // manifest.content_scripts 整段删掉，安装时不出现任何站点权限提示（REVIEW B11）。
  // 真实站点由后台按站点配置动态注册（core/registration.ts、core/reconcile.ts）。
  matches: ['https://pagemask.invalid/*'],
  // 与动态注册（core/registration.ts）一致：页面开始解析前启动，首屏防闪
  runAt: 'document_start',
  main(ctx) {
    // 一个文档里只有一份活着的运行时。两种「旧实例」：
    // 1. 同一隔离环境（同一扩展实例再次 executeScript，例如启用站点时与已注册脚本叠加）：WXT 构造本脚本的
    //    ctx 时广播「新脚本启动」，旧实例 ctx 随之失效并收尾（撤下界面、还原标题图标、冻结样式记录）；
    //    这里从 window.__pagemask 拿到它，接过样式记录继续（用户样式表只有按原文才删得掉）
    // 2. 扩展更新 / 重载前的实例：实测新脚本在另一个隔离环境里，window.__pagemask 看不到它，
    //    WXT 的通知也收不到。由运行时自己广播接管事件让它收尾，样式按推断接手（ui/content-runtime.ts）
    // window.__pagemask 只在扩展的隔离环境里可见，网页自己的脚本看不到；后台注入后经它直接打开向导。
    const w = window as unknown as { __pagemask?: RegisteredHandle };
    const previous = w.__pagemask;
    let takeover: Promise<StyleRecord | undefined> | undefined;
    if (typeof previous?.handover === 'function') {
      takeover = previous.handover().catch(() => undefined);
    } else {
      previous?.dispose?.();
    }
    w.__pagemask = initContentRuntime(ctx, takeover);
  },
});
