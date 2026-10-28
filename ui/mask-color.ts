/**
 * 遮罩外观（读 DOM 的一侧，纯计算见 core/mask-color.ts）。运行时遮罩（ui/mask-layer.ts）与
 * 向导预览（ui/wizard/WizardApp.vue）共用，保证「预览所见 = 保存所得」（REVIEW N25）。
 */
import { curtainColor } from '@/core/curtain';
import { canvasIsDark, parseCssColor, resolveMaskColor } from '@/core/mask-color';

/** 祖先链：父元素起由近到远；跨过 shadow 边界回到宿主（页面自己的 Web Component 里的元素） */
function ancestorBackgrounds(el: Element): string[] {
  const out: string[] = [];
  let n: Element | null = el;
  for (;;) {
    const parent: Element | null =
      n.parentElement ?? (n.parentNode instanceof ShadowRoot ? n.parentNode.host : null);
    if (!parent) break;
    const bg = getComputedStyle(parent).backgroundColor;
    out.push(bg);
    // 找到不透明的就够了（resolveMaskColor 也只看到这里）
    const c = parseCssColor(bg);
    if (!c || c.a >= 1) break;
    n = parent;
  }
  return out;
}

function pageCanvasIsDark(doc: Document): boolean {
  const root = doc.documentElement;
  const css = root ? getComputedStyle(root).colorScheme : '';
  const meta = doc.querySelector('meta[name="color-scheme"]')?.getAttribute('content') ?? null;
  const prefersDark = doc.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  return canvasIsDark(css ?? '', meta, prefersDark);
}

/** 遮罩颜色：被遮元素背后实际看到的底色 */
export function maskColorFor(el: Element): string {
  return resolveMaskColor(ancestorBackgrounds(el), pageCanvasIsDark(el.ownerDocument));
}

/** 遮罩盒子的外观：颜色 + 跟随被遮元素的圆角 */
export function applyMaskAppearance(box: HTMLElement, el: Element): void {
  box.style.background = maskColorFor(el);
  box.style.borderRadius = getComputedStyle(el).borderRadius;
}

/** 幕布底色（#45）：html / body 上第一个不透明的背景色，取不到按画布兜底（core/curtain.ts） */
export function curtainBackgroundFor(doc: Document): string {
  const root = doc.documentElement;
  const htmlBg = root ? getComputedStyle(root).backgroundColor : '';
  const bodyBg = doc.body ? getComputedStyle(doc.body).backgroundColor : '';
  return curtainColor(htmlBg, bodyBg, pageCanvasIsDark(doc));
}
