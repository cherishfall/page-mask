/**
 * 失效体检（design.md）：打开页面时核对每条隐藏规则（限其生效范围内的页面）的
 * 候选选择器是否命中。任一候选命中即算找到，全部失配才判失效（ADR-0002）。
 * 仅伪装态下采集与展示（原样态规则本就不应用，体检只会假警报）——由调用方保证。
 */
import type { HideRule } from './types';
import { rulesApplicableAt } from './scope';
import { isOwnUiNode } from './host-shield';

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

/**
 * 页面里命中某选择器的元素数：插件自己的界面宿主（及其内部）不算；非法选择器算 0。
 * shadow 内的节点 querySelectorAll 本就查不到，这里主要排除宿主自身被宽泛选择器命中。
 */
export function countPageHits(doc: Document, selector: string): number {
  let els: NodeListOf<Element>;
  try {
    els = doc.querySelectorAll(selector);
  } catch {
    return 0;
  }
  let n = 0;
  for (const el of els) if (!isOwnUiNode(el)) n++;
  return n;
}

export interface HealthResult {
  id: string;
  status: 'ok' | 'stale';
}

export interface HealthCheckDeps {
  /** 等页面安定：宽限 ms 后再等一次空闲回调。返回 false = 期间被取消（路由变化、切原样、运行时失效） */
  settle(ms: number): Promise<boolean>;
  /** 按当前页面体检一次 */
  probe(): RuleHealth[];
  /** 写回结论（只写健康字段） */
  report(results: HealthResult[]): Promise<void>;
}

/**
 * 失效体检的时序（REVIEW B15）：页面刚就绪时懒加载内容常常还没出现，立即判定会误报。
 * 1. 宽限 firstDelayMs 后、页面空闲时体检一次；全部找到即结束
 * 2. 有没找到的：再隔 confirmDelayMs 空闲时查第二次，两次都没找到才判 stale；第二次找到即 ok
 * 第二次时已不在生效范围内的规则（路由变了）不下结论。
 */
export async function runHealthCheck(
  deps: HealthCheckDeps,
  { firstDelayMs = 3000, confirmDelayMs = 5000 } = {},
): Promise<void> {
  if (!(await deps.settle(firstDelayMs))) return;
  const first = deps.probe();
  let final: HealthResult[] = first.map(({ rule, status }) => ({ id: rule.id, status }));
  if (first.some((r) => r.status === 'stale')) {
    if (!(await deps.settle(confirmDelayMs))) return;
    const second = new Map(deps.probe().map(({ rule, status }) => [rule.id, status]));
    final = first.flatMap(({ rule, status }) => {
      const again = second.get(rule.id);
      if (!again) return [];
      return [{ id: rule.id, status: status === 'stale' && again === 'stale' ? 'stale' : 'ok' } as HealthResult];
    });
  }
  if (final.length) await deps.report(final);
}

/** 人话体检提醒（design.md：表达用大白话 + 「去处理」跳编辑由 UI 承担） */
export function healthMessage(rule: HideRule, scopeText: string): string {
  return `「${rule.elementName}」的隐藏规则最近在${scopeText}没找到目标，可能网站改版了`;
}
