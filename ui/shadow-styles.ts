/**
 * 页内 shadow root 的共享样式（tokens + 继承隔离 + 表单控件字体）。
 *
 * 注入方式的结论（#33 调研 + 实测）：
 *
 * 1. 采用 adoptedStyleSheets + 一份共享的 CSSStyleSheet（constructable stylesheet）。
 *    modern-web-guidance「shadow-dom」：多个 shadow root 共用一份已解析的样式表，不必每处重复解析。
 *    CSS 文本由 Vite 的 `?inline` 在构建期内联（含 @import 的 tokens.css），因此
 *    replaceSync 不支持 @import 这一限制不影响我们。
 *
 * 2. 跨 realm：内容脚本跑在「隔离世界」，与网页共享同一个 DOM / document，只是 JS 全局对象不同。
 *    规范要求被采纳的样式表的「构造文档」等于 shadow root 所在文档。Chrome 中隔离世界里的
 *    `new CSSStyleSheet()` 关联的正是该页面 document，可以直接赋给网页里的 shadow root；
 *    为了不依赖这一点，这里用 shadow root 所属 window 的 CSSStyleSheet 构造（ownerDocument.defaultView）。
 *    Firefox 的内容脚本 Xray 包装下需要 `window.wrappedJSObject.CSSStyleSheet`，本项目只面向 Chrome，
 *    若将来移植需另行处理。构造失败时回退到 <style> 元素。
 *
 * 3. CSP：网页的 style-src 管的是 <style>/<link> 元素和 style 属性；通过 CSSOM 构造/替换样式表
 *    （replaceSync）不受 style-src 约束。Chrome 对扩展内容脚本插入的 <style> 同样不套用网页 CSP，
 *    但 Firefox 长期存在「网页 CSP 拦截扩展注入样式」的问题。adoptedStyleSheets 两边都不受影响，
 *    因此是更稳的首选。tests/e2e/check-dark-mode.mjs 在带 `style-src 'none'` 的页面上实测通过。
 */
import shadowCss from '../styles/shadow-base.css?inline';

/** 构建后的完整 CSS 文本（tokens + shadow 基础） */
export const SHADOW_CSS: string = shadowCss;

const sheetCache = new WeakMap<Document, CSSStyleSheet>();

function sheetFor(doc: Document): CSSStyleSheet {
  let sheet = sheetCache.get(doc);
  if (!sheet) {
    const Ctor = (doc.defaultView as (Window & typeof globalThis) | null)?.CSSStyleSheet ?? CSSStyleSheet;
    sheet = new Ctor();
    sheet.replaceSync(SHADOW_CSS);
    sheetCache.set(doc, sheet);
  }
  return sheet;
}

/** 把共享样式加到 shadow root 最前面（组件自己的样式可在其后覆盖） */
export function adoptPageMaskStyles(root: ShadowRoot): void {
  try {
    const sheet = sheetFor(root.ownerDocument);
    if (!root.adoptedStyleSheets.includes(sheet)) {
      root.adoptedStyleSheets = [sheet, ...root.adoptedStyleSheets];
    }
  } catch {
    const style = root.ownerDocument.createElement('style');
    style.textContent = SHADOW_CSS;
    root.prepend(style);
  }
}
