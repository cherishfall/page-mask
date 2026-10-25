/**
 * 生效范围匹配：整站（默认）/ 仅某类页面 / 排除某类页面。
 * 范围属于规则，不属于站点配置（GLOSSARY.md「生效范围」）。
 */
import type { HideRule, Scope } from './types';
import { urlMatchesPrefix } from './origin';

export function scopeMatches(scope: Scope, url: string): boolean {
  switch (scope.type) {
    case 'all':
      return true;
    case 'include':
      return scope.patterns.some((p) => urlMatchesPrefix(url, p.prefix));
    case 'exclude':
      return !scope.patterns.some((p) => urlMatchesPrefix(url, p.prefix));
  }
}

/** 取在某 URL 上应当生效的隐藏规则（含范围判断） */
export function rulesApplicableAt(rules: HideRule[], url: string): HideRule[] {
  return rules.filter((r) => scopeMatches(r.scope, url));
}

export function scopeLabel(scope: Scope): string {
  switch (scope.type) {
    case 'all':
      return '整站';
    case 'include':
      return `仅 ${scope.patterns.map((p) => p.label).join('、')}`;
    case 'exclude':
      return `除 ${scope.patterns.map((p) => p.label).join('、')} 外`;
  }
}
