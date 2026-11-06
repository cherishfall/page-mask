/**
 * 向导纯逻辑：防呆阈值、层级导航（design.md 核心流程「选择」步）与两条流程的骨架（#81）。
 * 面向不懂 CSS 的用户：选大/选小解决点选中内层文字的痛点。
 */
import { DEFAULT_TITLE_EN } from './titles';
import { t } from './i18n';
import type { HideRule, Scope, ScopePattern, StrategyId, TabIcon } from './types';

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
  /** null = 这条规则在页面上找不到对应元素（可能失效），只能重选或删掉 */
  el: Element | null;
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

// ---------- 两条流程的骨架（#81） ----------
// 两条独立流程，没有「第一次设置」的特殊模式（#81）：有配置就以配置为起点，没有就当空清单。
// - editTitle：「标题和图标」——单步小表单，主按钮「保存」，没有下一步；
// - editContent：「收起内容」——选内容 → 看效果，两步；进入点选时现有规则已铺成草稿起点。

/**
 * 向导的两个入口：
 * - editTitle：「标题和图标」入口，单步表单，填完点「保存」；
 * - editContent：「收起内容」入口，停在选内容——已收起的项已进选择集（统一编号），加新的直接点。
 */
export type WizardMode = 'editTitle' | 'editContent';
export type WizardPhase = 'title' | 'pick' | 'preview';

/** 这个入口的步骤顺序：标题和图标是单步，收起内容是选内容 → 看效果 */
export function wizardPhases(mode: WizardMode): readonly WizardPhase[] {
  return mode === 'editTitle' ? ['title'] : ['pick', 'preview'];
}

/** 打开时停在哪一步 */
export function wizardInitialPhase(mode: WizardMode): WizardPhase {
  return mode === 'editContent' ? 'pick' : 'title';
}

/** 「第 N 步 / 共 M 步」里的两个数（1 起） */
export function wizardStep(mode: WizardMode, phase: WizardPhase): { index: number; total: number } {
  const phases = wizardPhases(mode);
  const i = phases.indexOf(phase);
  return { index: (i < 0 ? 0 : i) + 1, total: phases.length };
}

/** 上一步；第 1 步没有（第 1 步的退路是退出设置） */
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

/** 「标题和图标」保存时写进站点配置的字段：0 条收起规则，开关按 keepState（不传 = 清爽） */
export interface TitleOnlyPatch {
  /** 点过保存就是「设置过」(#98)：清爽态从此按这里的标题与图标显示，与输入框是否改过无关 */
  titleIconSet: true;
  disguisedTitle: string;
  icon: TabIcon;
  switchState: 'disguised' | 'original';
}

/**
 * 「标题和图标」的保存：只写标题 / 图标 / 开关，不碰已有的收起规则（新站点本来就没有规则，
 * 保存后就是合法的「0 条规则」站点配置）。
 */
export function titleOnlyPatch(input: {
  title: unknown;
  icon: TabIcon;
  fallbackTitle: unknown;
  /** 已添加网站保持它现在的开关状态（不顺手打开清爽）；新站点不给 = 清爽 */
  keepState?: 'disguised' | 'original';
}): TitleOnlyPatch {
  return {
    titleIconSet: true,
    disguisedTitle: titleFromInput(input.title, input.fallbackTitle),
    icon: input.icon,
    switchState: input.keepState ?? 'disguised',
  };
}

/**
 * 「恢复网站原来的标题和图标」（#99）：回到「没设置过」的状态。
 * 只动这三个字段——收起规则、开关状态、按钮位置一概不碰。
 */
export interface TitleIconResetPatch {
  titleIconSet: false;
  disguisedTitle: null;
  icon: TabIcon;
}

export function titleIconResetPatch(): TitleIconResetPatch {
  return { titleIconSet: false, disguisedTitle: null, icon: { kind: 'site' } };
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

/** above / below = 号码牌完全在元素外面；left = 密行时放在元素左侧、垂直居中；corner = 左边没地方时跨在左上角；inside = 实在没地方时的兜底 */
export type BadgeSide = 'above' | 'below' | 'left' | 'corner' | 'inside';

export interface BadgePlace {
  left: number;
  top: number;
  side: BadgeSide;
}

/** 号码牌与元素之间留的空隙 */
const BADGE_GAP = 2;

/**
 * 号码牌左上角的视口坐标。左右夹紧在视口里（元素贴着视口边、半个元素在屏幕外时也不会跑出去）。
 *
 * 密行（元素比一块牌还矮，例如 24 像素高的列表行）：牌浮在元素**上方**时视觉上落在**上一行**里——
 * 读起来像上一行的编号，最后一行看着像漏了牌子（#82 标记语言）。这类改为放在元素**左侧**、
 * 垂直居中：与该行文字同一行高，归属一眼确定，也不遮住行首文字。左边实在没地方（元素贴着视口左缘）
 * 才跨在左上角，一半在元素内、一半在元素外。
 */
export function badgePlacement(
  rect: MarkerRect,
  badge: { width: number; height: number },
  viewport: { width: number; height: number },
  gap = BADGE_GAP,
): BadgePlace {
  const left = Math.max(0, Math.min(rect.left, viewport.width - badge.width));
  // 密行：元素装不下一整块牌
  if (rect.height < badge.height + gap) {
    // 左边放得下：放在元素左侧、垂直居中（不遮行首文字）
    if (rect.left >= badge.width + gap) {
      return {
        left: rect.left - badge.width - gap,
        top: rect.top + (rect.height - badge.height) / 2,
        side: 'left',
      };
    }
    // 左边没地方：跨在左上角（牌的垂直中线与元素的上边相接）
    return { left, top: rect.top - badge.height / 2, side: 'corner' };
  }
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

/**
 * 「编辑收起的内容」回到看效果时的草稿合并（#69）。
 * 与 reconcileDrafts 的区别：这里的选择集只装「本次新点选 / 重选过」的元素，
 * 从旧规则带进来的草稿不在选择集里，不能因此被丢掉。
 * - 从旧规则带进来的草稿（sourceOf 非空）全部保留、顺序不变（含页面上找不到元素的失效项）；
 * - 本次新点选的元素：已有同元素草稿就沿用，没有就新建，追加在后面；
 * - 本次新点选、后来又取消了的新草稿丢弃（只对没有旧规则来源的草稿生效）。
 */
export function mergeEditDrafts<T, D>(
  drafts: readonly D[],
  selection: readonly T[],
  sourceOf: (d: D) => string | null | undefined,
  elOf: (d: D) => T | null,
  make: (el: T) => D,
): D[] {
  const selected = new Set(selection);
  const out: D[] = [];
  const covered = new Set<T>();
  for (const d of drafts) {
    const el = elOf(d);
    if (!sourceOf(d) && !(el !== null && selected.has(el))) continue;
    out.push(d);
    if (el !== null) covered.add(el);
  }
  for (const el of selection) {
    if (covered.has(el)) continue;
    covered.add(el);
    out.push(make(el));
  }
  return out;
}

// ---------- 预览这一步的两个数（#53） ----------
// 每行第二行的那对选项说的是「收起什么」：只这一个 / 同类一起（N）。
// N 是「同类一起」时页面上会收起几个，必须实时算——页面可能滚动加载过，也可能刚从第 2 步回来。

/** 算这两个数只需要草稿的这几项 */
export interface DraftCountInput {
  /** null = 页面上找不到对应元素（可能失效）：没有「同类」概念，两个数都按候选命中数算 */
  el: Element | null;
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
 * 找不到元素的草稿（el === null）没有同类可言：两个数都按它自己的候选命中数算。
 */
export function draftHitCounts(
  drafts: readonly DraftCountInput[],
  sameCandidates: (el: Element) => readonly string[],
  count: (selectors: readonly string[]) => number,
): DraftHits[] {
  return drafts.map((d) => {
    if (!d.el) {
      const hits = count(d.candidates);
      return { sameHits: hits, hits };
    }
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

/** 保存时一条草稿要落库的内容（id 由合并算法决定：有来源就原地更新，没有就新建） */
export interface DraftRuleInput {
  /** 对应的旧规则 id：有就原地更新它（保留 id 与体检记录），没有就新增一条 */
  sourceRuleId?: string | null;
  elementName: string;
  candidates: readonly string[];
  strategy: StrategyId;
  scope: Scope;
  onlyThis: boolean;
}

/**
 * 「编辑收起的内容」保存时的规则合并（#69）——纯函数，便于单测：
 * 1. sourceRuleId 命中现有规则的草稿 → 原地更新（保留 id、createdAt、lastHealth / lastHealthAt，位置不动）；
 * 2. 没有来源（或来源已被别处删掉）的草稿 → 追加一条新规则（新 id）；
 * 3. editIds（本次打开时属于这个页面的规则 id）里有、但草稿里没有的 → 从列表移除。
 *    只动 editIds 里的 id，页面上不适用的规则绝不碰。
 */
export function mergeSavedRules(
  existing: readonly HideRule[],
  incoming: readonly DraftRuleInput[],
  opts: { editIds?: readonly string[] | null; now: number; makeId: () => string },
): HideRule[] {
  const updates = new Map<string, DraftRuleInput>();
  for (const d of incoming) if (d.sourceRuleId) updates.set(d.sourceRuleId, d);
  const deleting = opts.editIds ? new Set(opts.editIds) : null;
  const present = new Set(existing.map((r) => r.id));
  const out: HideRule[] = [];
  for (const rule of existing) {
    const update = updates.get(rule.id);
    if (update) {
      out.push({
        ...rule,
        elementName: update.elementName,
        candidates: [...update.candidates],
        strategy: update.strategy,
        scope: update.scope,
        onlyThis: update.onlyThis,
      });
      continue;
    }
    if (deleting?.has(rule.id)) continue;
    out.push(rule);
  }
  for (const d of incoming) {
    if (d.sourceRuleId && present.has(d.sourceRuleId)) continue;
    out.push({
      id: opts.makeId(),
      elementName: d.elementName,
      candidates: [...d.candidates],
      strategy: d.strategy,
      scope: d.scope,
      onlyThis: d.onlyThis,
      createdAt: opts.now,
    });
  }
  return out;
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
