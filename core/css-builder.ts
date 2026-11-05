/**
 * 隐藏规则 → 用户样式表 CSS。
 * 铁律（ADR-0002）：方案 A/B 一律走 chrome.scripting.insertCSS（浏览器用户样式表通道
 * + !important），禁止行内样式、禁止 <style> 标签。方案 C 遮罩不走 CSS，由内容脚本的
 * 覆盖层元素承担（滚动跟手需要 JS）。
 */
import type { HideRule, StrategyId } from './types';
import { rulesApplicableAt } from './scope';
import { isSafeSelector } from './validate';

/** 生成 CSS 只需要"藏什么 + 怎么藏"：正式规则与向导草稿共用 */
export type CssSource = Pick<HideRule, 'candidates' | 'strategy'>;

const DECLARATIONS: Record<Exclude<StrategyId, 'mask'>, string> = {
  remove: 'display: none !important;',
  // 原地留白：位置保留；透明兜底（后代写 visibility:visible 也透不出来）；不可点；元素在无障碍树中一并隐藏
  blank: 'visibility: hidden !important; opacity: 0 !important; pointer-events: none !important;',
};

/**
 * 单条规则（方案 A/B）的 CSS 片段；方案 C 返回 null（由覆盖层实现）。
 * 每个候选独立成块：浏览器不认识的选择器只会让自己那一块失效，不连累其他候选（选择器列表里一个坏项会让整条失效）。
 * 只输出通过统一校验的候选（第二道防线：存储层已校验，这里防止旧数据或绕过存储的输入跳出规则块）。
 */
export function buildRuleCss(rule: CssSource): string | null {
  if (rule.strategy === 'mask') return null;
  const decl = DECLARATIONS[rule.strategy];
  if (!decl) return null;
  const blocks = rule.candidates.filter((c) => isSafeSelector(c)).map((c) => `${c.trim()} { ${decl} }`);
  return blocks.length ? blocks.join('\n') : null;
}

/** 向导预览草稿 → CSS（与正式样式同一实现，保证"预览所见 = 保存所得"）；无 A/B 方案草稿返回 null */
export function buildPreviewCss(items: CssSource[]): string | null {
  const parts = items.map(buildRuleCss).filter((s): s is string => s !== null);
  return parts.length ? parts.join('\n') : null;
}

/** 大组（超过子号牌档位）整片浅色描边的样子：与向导标记同一族（虚线、accent 蓝的浅色版） */
// 勾选「一起收起」时这一组的统一标记（#100）：小组与大组同一形态。
// 颜色比主选中框（橙色实线）弱一档，但要能在浅色与深色页面上都看清——0.4 的透明度在深色页上几乎消失
const OUTLINE_DECL = 'outline: 2px dashed rgb(59 130 246 / 0.9) !important; outline-offset: -2px !important;';

/**
 * 勾了「一起收起」的整组：全部候选合成**一条**样式规则（选择器列表一个块）。
 * 走用户样式表通道注入，滚动新加载的元素自动带上——不为成员逐个建 DOM（#82 防爆红线）。
 * 没有可用候选时返回 null（不注入空规则）。
 */
export function buildSameGroupOutlineCss(candidates: readonly string[]): string | null {
  const sels = candidates.filter((c) => isSafeSelector(c)).map((c) => c.trim());
  if (!sels.length) return null;
  return `${sels.join(', ')} { ${OUTLINE_DECL} }`;
}

/** 汇总某 URL 上应注入的 CSS 文本（仅 A/B 方案规则）；无则返回 null */
export function buildDisguiseCss(rules: HideRule[], url: string): string | null {
  return buildPreviewCss(rulesApplicableAt(rules, url));
}

/** 某页面上需要覆盖层（方案 C）的规则列表 */
export function maskRulesAt(rules: HideRule[], url: string): HideRule[] {
  return rulesApplicableAt(rules, url).filter((r) => r.strategy === 'mask');
}

export const STRATEGY_ORDER: StrategyId[] = ['remove', 'blank', 'mask'];

export function nextStrategy(s: StrategyId): StrategyId {
  const i = STRATEGY_ORDER.indexOf(s);
  return STRATEGY_ORDER[(i + 1) % STRATEGY_ORDER.length] ?? 'remove';
}
