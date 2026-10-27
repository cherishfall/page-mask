/**
 * 设置向导自己的样式（工具条、浮层、页内标记）。
 * 和共享基础样式（ui/shadow-styles.ts）同一种注入方式：可构造样式表 + adoptedStyleSheets，
 * 用 shadow root 所属 window 的 CSSStyleSheet 构造；失败时退回 <style>。
 * 需要 ::backdrop、:popover-open、:focus-visible 这些伪类 / 伪元素，行内样式做不到。
 */
import wizardCss from './wizard.css?inline';

const sheetCache = new WeakMap<Document, CSSStyleSheet>();

export function adoptWizardStyles(root: ShadowRoot): void {
  try {
    const doc = root.ownerDocument;
    let sheet = sheetCache.get(doc);
    if (!sheet) {
      const Ctor = (doc.defaultView as (Window & typeof globalThis) | null)?.CSSStyleSheet ?? CSSStyleSheet;
      sheet = new Ctor();
      sheet.replaceSync(wizardCss);
      sheetCache.set(doc, sheet);
    }
    if (!root.adoptedStyleSheets.includes(sheet)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  } catch {
    const style = root.ownerDocument.createElement('style');
    style.textContent = wizardCss;
    root.appendChild(style);
  }
}
