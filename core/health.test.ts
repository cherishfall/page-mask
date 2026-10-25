import { describe, expect, it } from 'vitest';
import { healthMessage, probeRules } from './health';
import type { HideRule } from './types';

const rule = (id: string, scope: HideRule['scope'] = { type: 'all' }): HideRule => ({
  id,
  elementName: '顶部导航栏',
  candidates: ['.a', '.b'],
  strategy: 'remove',
  scope,
  onlyThis: false,
  createdAt: 0,
});

describe('probeRules 体检', () => {
  it('任一候选命中即 ok', () => {
    const hits: Record<string, number> = { '.a': 0, '.b': 2 };
    const res = probeRules([rule('r1')], 'https://x.com/p', (sel) => hits[sel] ?? 0);
    expect(res[0]?.status).toBe('ok');
    expect(res[0]?.candidateHits).toEqual([0, 2]);
  });
  it('全部失配判 stale', () => {
    const res = probeRules([rule('r1')], 'https://x.com/p', () => 0);
    expect(res[0]?.status).toBe('stale');
  });
  it('只体检生效范围内的规则', () => {
    const rules = [
      rule('in'),
      rule('out', { type: 'include', patterns: [{ label: '别的页面', prefix: 'https://x.com/other/' }] }),
    ];
    const res = probeRules(rules, 'https://x.com/this', () => 0);
    expect(res.map((r) => r.rule.id)).toEqual(['in']);
  });
});

describe('healthMessage 人话提醒', () => {
  it('提到元素名与范围', () => {
    const msg = healthMessage(rule('r1'), '阅读类页面');
    expect(msg).toContain('顶部导航栏');
    expect(msg).toContain('阅读类页面');
    expect(msg).toContain('网站改版');
  });
});
