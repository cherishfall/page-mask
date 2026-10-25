/**
 * 失效体检（design.md）：打开页面时核对每条隐藏规则（限其生效范围内的页面）的
 * 候选选择器是否命中。任一候选命中即算找到，全部失配才判失效（ADR-0002）。
 * 仅伪装态下采集与展示（原样态规则本就不应用，体检只会假警报）——由调用方保证。
 */
import type { HideRule } from './types';
import { rulesApplicableAt } from './scope';

export type HitCounter = (selector: string) => number;

export interface RuleHealth {
  rule: HideRule;
  status: 'ok' | 'stale';
  /** 每个候选各自的命中数，供诊断展示 */
  candidateHits: number[];
}

export function probeRules(rules: HideRule[], url: string, countHits: HitCounter): RuleHealth[] {
  return rulesApplicableAt(rules, url).map((rule) => {
    const candidateHits = rule.candidates.map(countHits);
    return {
      rule,
      candidateHits,
      status: candidateHits.some((n) => n > 0) ? 'ok' : 'stale',
    };
  });
}

/** 人话体检提醒（design.md：表达用大白话 + 「去处理」跳编辑由 UI 承担） */
export function healthMessage(rule: HideRule, scopeText: string): string {
  return `「${rule.elementName}」的隐藏规则最近在${scopeText}没找到目标，可能网站改版了`;
}
