/**
 * 在扩展页面里注入胶囊样式（#102 / #103）。
 *
 * 胶囊平时的样式走 shadow root（ui/toggle/toggle-styles.ts 的 adoptedStyleSheets）。
 * 设置页的预览和欢迎页的示意图是在普通页面里渲染同一个组件，需要把同一份 CSS 注入文档一次；
 * 重复调用是幂等的（用 data 属性占位）。
 */
import toggleCss from './toggle.css?inline';

export function ensureTogglePreviewStyles(doc: Document = document): void {
  if (doc.querySelector('style[data-pm-toggle-preview]')) return;
  const style = doc.createElement('style');
  style.dataset.pmTogglePreview = '';
  style.textContent = toggleCss;
  doc.head.appendChild(style);
}
