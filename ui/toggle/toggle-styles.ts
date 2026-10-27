/**
 * 悬浮按钮自己的样式（胶囊、把手、菜单）。与向导 / 编辑面板同一套注入方式：
 * 可构造样式表 + adoptedStyleSheets，用 shadow root 所属 window 的 CSSStyleSheet 构造；
 * 失败时退回 <style>。需要 :popover-open、:focus-visible 等伪类，行内样式做不到。
 */
import toggleCss from './toggle.css?inline';

const sheetCache = new WeakMap<Document, CSSStyleSheet>();

export function adoptToggleStyles(root: ShadowRoot): void {
  try {
    const doc = root.ownerDocument;
    let sheet = sheetCache.get(doc);
    if (!sheet) {
      const Ctor = (doc.defaultView as (Window & typeof globalThis) | null)?.CSSStyleSheet ?? CSSStyleSheet;
      sheet = new Ctor();
      sheet.replaceSync(toggleCss);
      sheetCache.set(doc, sheet);
    }
    if (!root.adoptedStyleSheets.includes(sheet)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  } catch {
    const style = root.ownerDocument.createElement('style');
    style.textContent = toggleCss;
    root.appendChild(style);
  }
}
