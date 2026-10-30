/**
 * 向导纯逻辑：防呆阈值、层级导航（design.md 核心流程「选择」步）与三步骨架（#51）。
 * 面向不懂 CSS 的用户：选大/选小解决点选中内层文字的痛点。
 */
import { DEFAULT_TITLE_EN } from './titles';
import { t } from './i18n';
import type { Scope, ScopePattern } from './types';

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
  return t().wizard.warnUnsavable(idx + 1);
}

// ---------- 三步骨架（#51） ----------
// 新网站第一次设置：标题与图标 → 选内容 → 看效果；已经添加过的网站只有后两步。
// 第 1 步只在这里出现，第 2 / 3 步的内容重排在 #52、#53。

export type WizardMode = 'newSite' | 'addElement';
export type WizardPhase = 'title' | 'pick' | 'preview';

/** 这个入口的步骤顺序 */
export function wizardPhases(mode: WizardMode): readonly WizardPhase[] {
  return mode === 'newSite' ? ['title', 'pick', 'preview'] : ['pick', 'preview'];
}

/** 「第 N 步 / 共 M 步」里的两个数（1 起） */
export function wizardStep(mode: WizardMode, phase: WizardPhase): { index: number; total: number } {
  const phases = wizardPhases(mode);
  const i = phases.indexOf(phase);
  return { index: (i < 0 ? 0 : i) + 1, total: phases.length };
}

/** 上一步；第 1 步没有（老站点进入就是选内容，左下角不出现「上一步」） */
export function wizardPrevPhase(mode: WizardMode, phase: WizardPhase): WizardPhase | null {
  const phases = wizardPhases(mode);
  const i = phases.indexOf(phase);
  return i > 0 ? phases[i - 1]! : null;
}

/** 下一步；最后一步（看效果）返回 null（保存由界面自己处理） */
export function wizardNextPhase(mode: WizardMode, phase: WizardPhase): WizardPhase | null {
  const phases = wizardPhases(mode);
  const i = phases.indexOf(phase);
  return i >= 0 && i < phases.length - 1 ? phases[i + 1]! : null;
}

/**
 * 标题输入框的值 → 真正会写进标签页的文字。
 * 永远不返回空白：标题为空时 Chrome 会在标签页上显示网址（design.md「标签页标题与图标」）。
 * 输入只有空白时用兜底值（全局默认 > 界面语言默认，由调用方传进来）；兜底也空白时用常量 "Reading"。
 */
export function titleFromInput(value: unknown, fallback: unknown): string {
  const typed = typeof value === 'string' ? value.trim() : '';
  if (typed) return typed;
  const fb = typeof fallback === 'string' ? fallback.trim() : '';
  return fb || DEFAULT_TITLE_EN;
}

/** 「只改标题，完成」写进站点配置的字段：0 条收起规则、清爽态 */
export interface TitleOnlyPatch {
  disguisedTitle: string;
  faviconDataUrl: string | null;
  switchState: 'disguised';
}

/**
 * 「只改标题，完成」：只写标题 / 图标 / 开关，不碰已有的收起规则（新站点本来就没有规则，
 * 保存后就是合法的「0 条规则」站点配置）。图标没上传就写 null（回到透明 / 全局默认图标）。
 */
export function titleOnlyPatch(input: {
  title: unknown;
  icon: string | null;
  fallbackTitle: unknown;
}): TitleOnlyPatch {
  return {
    disguisedTitle: titleFromInput(input.title, input.fallbackTitle),
    faviconDataUrl: input.icon || null,
    switchState: 'disguised',
  };
}

// ---------- 选择集（顺序 = 序号牌编号） ----------
// 选择集是有序列表：序号牌、预览标记、草稿清单都按它的下标编号，任何变化后整体重新编号（N6）。

/** 点一下选中、再点取消；取消后后面的项自然前移 */
export function toggleSelection<T>(list: readonly T[], el: T): T[] {
  return list.includes(el) ? list.filter((x) => x !== el) : [...list, el];
}

/**
 * 选大 / 选小一点：把 old 换成 next，留在原位（不挪到末尾，N6）；
 * next 已经在选择里时只去掉 old（同一元素不出现两次）
 */
export function replaceInSelection<T>(list: readonly T[], old: T, next: T): T[] {
  const i = list.indexOf(old);
  if (i < 0) return [...list];
  if (list.includes(next)) return list.filter((x) => x !== old);
  const out = [...list];
  out[i] = next;
  return out;
}

/** 删除这一项（N11） */
export function removeFromSelection<T>(list: readonly T[], el: T): T[] {
  return list.filter((x) => x !== el);
}

/** 已选清单的一行（#52）：序号与页面上的号码牌来自同一个数组下标，删掉某一项后两者一起重排 */
export interface SelectionRow<T> {
  /** 1 起，与号码牌上的数字一致 */
  seq: number;
  el: T;
  name: string;
}

/** 把选择集摊成清单行；selection 的顺序就是序号顺序 */
export function selectionRows<T>(selection: readonly T[], name: (el: T) => string): SelectionRow<T>[] {
  return selection.map((el, i) => ({ seq: i + 1, el, name: name(el) }));
}

// ---------- 号码牌位置（#52） ----------
// 号码牌不再画在元素左上角里面——那里正是元素自己的文字（截图里「2)出租」被盖掉一半）。
// 改成贴在元素边界外侧：优先上方，上方顶到视口边就放下方，上下都放不下（元素几乎占满一屏）
// 时才退到左上角内侧（调用方用半透明底），保证内容可读、同时看得出它对应哪个元素。

export interface MarkerRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** above / below = 号码牌完全在元素外面；inside = 实在没地方时的兜底 */
export type BadgeSide = 'above' | 'below' | 'inside';

export interface BadgePlace {
  left: number;
  top: number;
  side: BadgeSide;
}

/** 号码牌与元素之间留的空隙 */
const BADGE_GAP = 2;

/**
 * 号码牌左上角的视口坐标。左右夹紧在视口里（元素贴着视口边、半个元素在屏幕外时也不会跑出去）。
 */
export function badgePlacement(
  rect: MarkerRect,
  badge: { width: number; height: number },
  viewport: { width: number; height: number },
  gap = BADGE_GAP,
): BadgePlace {
  const left = Math.max(0, Math.min(rect.left, viewport.width - badge.width));
  const above = rect.top - badge.height - gap;
  if (above >= 0) return { left, top: above, side: 'above' };
  const below = rect.top + rect.height + gap;
  if (below + badge.height <= viewport.height) return { left, top: below, side: 'below' };
  return { left, top: Math.max(0, rect.top + gap), side: 'inside' };
}

/**
 * 进入（或回到）预览时按选择集重算草稿（N12）：还在选择里的元素沿用已有草稿（改过的名称、方案、
 * 同类设置都保留），新选的元素才新建，已取消的丢弃；结果按选择集顺序排列。
 */
export function reconcileDrafts<T, D>(selection: readonly T[], existing: ReadonlyMap<T, D>, make: (el: T) => D): Map<T, D> {
  const out = new Map<T, D>();
  for (const el of selection) out.set(el, existing.get(el) ?? make(el));
  return out;
}

// ---------- 预览这一步的两个数（#53） ----------
// 每行第二行的那对选项说的是「收起什么」：只这一个 / 同类一起（N）。
// N 是「同类一起」时页面上会收起几个，必须实时算——页面可能滚动加载过，也可能刚从第 2 步回来。

/** 算这两个数只需要草稿的这几项 */
export interface DraftCountInput {
  el: Element;
  /** 当前选的是「只这一个」 */
  onlyThis: boolean;
  /** 当前这一项实际会用的候选选择器 */
  candidates: readonly string[];
}

export interface DraftHits {
  /** 当前设置实际会收起的个数 */
  hits: number;
  /** 「同类一起」会收起的个数（N）；与当前设置无关，切换选项前后都一样 */
  sameHits: number;
}

/**
 * 重算每行的两个数。`sameCandidates` 给某个元素生成「同类一起」的候选，
 * `count` 数这组候选在页面上命中几个——两个都注入进来，这里保持纯函数、可单测。
 */
export function draftHitCounts(
  drafts: readonly DraftCountInput[],
  sameCandidates: (el: Element) => readonly string[],
  count: (selectors: readonly string[]) => number,
): DraftHits[] {
  return drafts.map((d) => {
    const sameHits = count(sameCandidates(d.el));
    return { sameHits, hits: d.onlyThis ? count(d.candidates) : sameHits };
  });
}

// ---------- 保存（#53：底部三选一 + 保存即完成） ----------

/** 这一步底部的「在哪些页面收起」三选一 */
export type ScopeChoice = 'all' | 'include' | 'exclude';

/**
 * 三选一 → 落库的生效范围。整批规则共用一份（design.md 核心流程第 4 步）；
 * 推不出「这类页面」时只能整站，界面上另外给一句说明。
 */
export function scopeFromChoice(choice: ScopeChoice, pattern: ScopePattern | null): Scope {
  if (choice === 'all' || !pattern) return { type: 'all' };
  return { type: choice, patterns: [pattern] };
}

/**
 * 保存后给用户的轻提示：这次一条规则都没有（只改了标题 / 图标）时，
 * 说清楚生效的是标签页名字，否则用户会以为保存没起作用（#53）。
 */
export function zeroRuleSavedNotice(title: string): string {
  return t().wizard.zeroRuleNotice(title);
}

// ---------- 键盘 ----------

export interface EscKey {
  key: string;
  isComposing: boolean;
  keyCode: number;
}

/**
 * 向导级 Esc（N9）：只有在没有任何浮层时才请求退出（退出前有选择还会二次确认）。
 * 有浮层（调整弹片、确认框）时交给浮层自己按原生行为关闭，向导不处理、也不能 preventDefault
 * （否则浏览器不再把这次 Esc 当作关闭请求）。
 * 输入法组字时按 Esc 是取消候选词：isComposing，或 Safari 等事件顺序异常时的 keyCode 229。
 */
export function wizardEscAction(e: EscKey, state: { overlayOpen: boolean }): 'none' | 'requestExit' {
  if (e.key !== 'Escape' || e.isComposing || e.keyCode === 229) return 'none';
  return state.overlayOpen ? 'none' : 'requestExit';
}

// ---------- 工具条位置 ----------

/** 拖动 / 方向键移动工具条后夹紧到可视区内（指针和键盘共用，窗口变化后也重新夹紧） */
export function clampToViewport(
  pos: { left: number; top: number },
  size: { width: number; height: number },
  viewport: { width: number; height: number },
): { left: number; top: number } {
  const maxLeft = Math.max(0, viewport.width - size.width);
  const maxTop = Math.max(0, viewport.height - size.height);
  return {
    left: Math.max(0, Math.min(pos.left, maxLeft)),
    top: Math.max(0, Math.min(pos.top, maxTop)),
  };
}
