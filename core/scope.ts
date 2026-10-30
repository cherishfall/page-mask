/**
 * 生效范围匹配：整站（默认）/ 仅某类页面 / 排除某类页面。
 * 范围属于规则，不属于站点配置（GLOSSARY.md「生效范围」）。
 */
import type { HideRule, Scope } from './types';
import { urlMatchesPattern } from './origin';
import { t } from './i18n';

export function scopeMatches(scope: Scope, url: string): boolean {
  switch (scope.type) {
    case 'all':
      return true;
    case 'include':
      return scope.patterns.some((p) => urlMatchesPattern(url, p));
    case 'exclude':
      return !scope.patterns.some((p) => urlMatchesPattern(url, p));
  }
}

/** 取在某 URL 上应当生效的隐藏规则（含范围判断） */
export function rulesApplicableAt(rules: HideRule[], url: string): HideRule[] {
  return rules.filter((r) => scopeMatches(r.scope, url));
}

/** 一句话里的短范围（失效提示用：「最近在 … 没找到目标」） */
export function scopeLabel(scope: Scope): string {
  const s = t().common.scopeShort;
  const labels = (patterns: { label: string }[]) => patterns.map((p) => p.label).join(t().common.listSeparator);
  switch (scope.type) {
    case 'all':
      return s.all;
    case 'include':
      return s.include(labels(scope.patterns));
    case 'exclude':
      return s.exclude(labels(scope.patterns));
  }
}

/**
 * 给用户看的生效范围（管理页的收起项清单用）：与向导同一套说法，
 * 「整个网站 / 只在这类页面 / 除了这类页面」，不用「整站」「仅」「除外」这类缩写。
 */
export function scopeHumanLabel(scope: Scope): string {
  const s = t().common.scope;
  const labels = (patterns: { label: string }[]) => patterns.map((p) => p.label).join(t().common.listSeparator);
  switch (scope.type) {
    case 'all':
      return s.all;
    case 'include':
      return s.include(labels(scope.patterns));
    case 'exclude':
      return s.exclude(labels(scope.patterns));
  }
}
