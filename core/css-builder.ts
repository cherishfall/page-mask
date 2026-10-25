/**
 * 隐藏规则 → 用户样式表 CSS。
 * 铁律（ADR-0002）：方案 A/B 一律走 chrome.scripting.insertCSS（浏览器用户样式表通道
 * + !important），禁止行内样式、禁止 <style> 标签。方案 C 遮罩不走 CSS，由内容脚本的
 * 覆盖层元素承担（滚动跟手需要 JS）。
 */
import type { HideRule, StrategyId } from './types';
import { rulesApplicableAt } from './scope';

function ruleSelector(rule: HideRule): string {
  return rule.candidates.join(', ');
}

/** 单条规则（方案 A/B）的 CSS 片段；方案 C 返回 null（由覆盖层实现） */
export function buildRuleCss(rule: HideRule): string | null {
  const sel = ruleSelector(rule);
  if (!sel) return null;
  switch (rule.strategy) {
    case 'remove':
      return `${sel} { display: none !important; }`;
    case 'blank':
      // 全透明、不可点、位置保留（元素在无障碍树中一并隐藏）
      return `${sel} { visibility: hidden !important; pointer-events: none !important; }`;
    case 'mask':
      return null;
  }
}

/** 汇总某 URL 上应注入的 CSS 文本（仅 A/B 方案规则）；无则返回 null */
export function buildDisguiseCss(rules: HideRule[], url: string): string | null {
  const parts = rulesApplicableAt(rules, url)
    .map(buildRuleCss)
    .filter((s): s is string => s !== null);
  return parts.length ? parts.join('\n') : null;
}

/** 某页面上需要覆盖层（方案 C）的规则列表 */
export function maskRulesAt(rules: HideRule[], url: string): HideRule[] {
  return rulesApplicableAt(rules, url).filter((r) => r.strategy === 'mask');
}

/** 用于 removeCSS 的配套：按同样规则集合重建 CSS 文本（保持与 insertCSS 完全一致以幂等移除） */
export { buildRuleCss as cssForRemove };

export const STRATEGY_ORDER: StrategyId[] = ['remove', 'blank', 'mask'];

export function nextStrategy(s: StrategyId): StrategyId {
  const i = STRATEGY_ORDER.indexOf(s);
  return STRATEGY_ORDER[(i + 1) % STRATEGY_ORDER.length];
}
