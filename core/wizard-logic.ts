/**
 * 向导纯逻辑：防呆阈值与层级导航（design.md 核心流程「选择」步）。
 * 面向不懂 CSS 的用户：选大/选小解决点选中内层文字的痛点。
 */

/** 选到接近整页的元素时防呆提示（不阻止，只提示） */
export function isTooBigForPick(rect: { width: number; height: number }, viewport: { width: number; height: number }): boolean {
  const ratio = (rect.width * rect.height) / (viewport.width * viewport.height);
  return ratio >= 0.6;
}

export type LevelDir = 'bigger' | 'smaller';

/**
 * 层级导航：bigger = 父元素（到 body 为止）；smaller = 第一个元素后代（无可选子级时返回 null）。
 * body/html 不可越过：整站伪装不是向导的能力范围。
 */
export function navigateLevel(el: Element, dir: LevelDir): Element | null {
  if (dir === 'bigger') {
    const parent = el.parentElement;
    if (!parent || parent === document.documentElement) return null;
    return parent;
  }
  const child = el.firstElementChild;
  return child ?? null;
}

/** 向导里的临时草稿（保存时才转成正式 HideRule） */
export interface DraftItem {
  el: Element;
  name: string;
  strategy: 'remove' | 'blank' | 'mask';
  onlyThis: boolean;
}

/**
 * 保存门槛：每条规则至少要有 1 个候选选择器，否则保存后什么也藏不掉、体检永远报失效。
 * 返回给用户的提示；全部可保存时返回 null。
 */
export function unsavableDraftWarning(drafts: readonly { candidates: readonly string[] }[]): string | null {
  const idx = drafts.findIndex((d) => d.candidates.length === 0);
  if (idx < 0) return null;
  return `第 ${idx + 1} 个元素没法稳定识别：请把它移出本次选择，再用「选大一点」重新选`;
}
