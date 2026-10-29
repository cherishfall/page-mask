/**
 * 页内界面样式注入（悬浮按钮 / 向导 / 编辑面板 / 标题小面板共用这一份实现）。
 *
 * 可构造样式表 + adoptedStyleSheets，用 shadow root 所属 window 的 CSSStyleSheet 构造；
 * 构造不了时退回 <style>。需要 :popover-open、::backdrop、:focus-visible 这些伪类的地方
 * 行内样式做不到，所以统一走样式表。同一份 CSS 文本按文档缓存一次，多个 shadow root 共用。
 */
export function createStyleAdopter(...texts: string[]): (root: ShadowRoot) => void {
  const sheetCache = new WeakMap<Document, CSSStyleSheet[]>();
  return (root) => {
    try {
      const doc = root.ownerDocument;
      let sheets = sheetCache.get(doc);
      if (!sheets) {
        const Ctor = (doc.defaultView as (Window & typeof globalThis) | null)?.CSSStyleSheet ?? CSSStyleSheet;
        sheets = texts.map((css) => {
          const sheet = new Ctor();
          sheet.replaceSync(css);
          return sheet;
        });
        sheetCache.set(doc, sheets);
      }
      const missing = sheets.filter((sheet) => !root.adoptedStyleSheets.includes(sheet));
      if (missing.length) root.adoptedStyleSheets = [...root.adoptedStyleSheets, ...missing];
    } catch {
      for (const css of texts) {
        const style = root.ownerDocument.createElement('style');
        style.textContent = css;
        root.appendChild(style);
      }
    }
  };
}
