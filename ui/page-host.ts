/**
 * 页内界面宿主（#22）：自定义元素宿主 + open shadow root + 带 lang 的根容器 + 按键隔离 + 随 ctx 收尾。
 *
 * 等效于 WXT `createShadowRootUi`（同样是自定义元素宿主、shadow 内重置、`isolateEvents`、
 * `ctx.onInvalidated(remove)`），没有直接用它的原因：
 * - 它是 async 的，而运行时的挂载 / 卸载在同一条串行链里同步完成，改成异步会引入"卸载早于挂载完成"的竞态
 * - 它往 shadow 里塞 `<style>`；这里沿用共享的可构造样式表（adoptedStyleSheets，ui/shadow-styles.ts）
 * - 遮罩覆盖层不是 Vue 应用，也要同一套宿主
 *
 * 宿主自身的 !important 保护来自后台注入的用户样式表（core/host-shield.ts），这里的行内样式
 * 只是那份样式到位前的兜底。shadow 用 open 模式：调试与 E2E 能看到内部（modern-web-guidance「shadow-dom」）。
 */
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { HOST_TAGS, HOST_Z_INDEX, type HostKind } from '@/core/host-shield';
import { adoptPageMaskStyles } from './shadow-styles';

/** 在 shadow root 上拦下的按键事件：输入框里打字不会冒泡到页面，触发站点快捷键（REVIEW N27） */
const ISOLATED_EVENTS = ['keydown', 'keyup', 'keypress'] as const;

export interface PageHost {
  host: HTMLElement;
  shadow: ShadowRoot;
  /** shadow 内的根容器（lang="zh-CN"，界面基准字体 / 颜色的起点），Vue 应用挂在这里 */
  root: HTMLElement;
  /** 移除宿主（可重复调用） */
  remove(): void;
}

export function createPageHost(ctx: ContentScriptContext, kind: HostKind): PageHost {
  const host = document.createElement(HOST_TAGS[kind]);
  Object.assign(host.style, {
    display: 'block',
    position: 'fixed',
    top: '0',
    left: '0',
    width: '0',
    height: '0',
    overflow: 'visible',
    zIndex: String(HOST_Z_INDEX[kind]),
  } as Partial<CSSStyleDeclaration>);
  const shadow = host.attachShadow({ mode: 'open' });
  adoptPageMaskStyles(shadow);
  const root = document.createElement('div');
  root.className = 'pm-root';
  // 界面文案是中文：英文页面上读屏也按中文念（REVIEW N35）
  root.lang = 'zh-CN';
  shadow.appendChild(root);
  // 冒泡阶段在 shadow root 上截住：shadow 内自己的监听（Vue @keydown 等）照常先收到；
  // 向导的 Esc 监听挂在 window 捕获阶段（pick-controller），先于这里执行，不受影响
  for (const type of ISOLATED_EVENTS) {
    shadow.addEventListener(type, (e) => e.stopPropagation(), { signal: ctx.signal });
  }
  document.documentElement.appendChild(host);
  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    host.remove();
  };
  const off = ctx.onInvalidated(remove);
  return {
    host,
    shadow,
    root,
    remove() {
      off();
      remove();
    },
  };
}
