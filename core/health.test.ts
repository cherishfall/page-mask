import { describe, expect, it } from 'vitest';
import { countPageHits, healthMessage, probeRules, runHealthCheck, type RuleHealth } from './health';
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

describe('countPageHits 排除插件自身节点', () => {
  it('宿主（自定义元素）本身被宽泛选择器命中也不算', () => {
    document.body.innerHTML = '<div class="x"></div>';
    const host = document.createElement('pagemask-toggle');
    host.className = 'x';
    document.body.append(host);
    expect(countPageHits(document, '.x')).toBe(1);
    expect(countPageHits(document, 'pagemask-toggle')).toBe(0);
    expect(countPageHits(document, '::invalid((')).toBe(0);
    document.body.innerHTML = '';
  });
});

describe('runHealthCheck 延迟 + 两次确认', () => {
  const r1 = rule('r1');
  const r2 = rule('r2');
  const ok = (r: HideRule): RuleHealth => ({ rule: r, status: 'ok', candidateHits: [1] });
  const stale = (r: HideRule): RuleHealth => ({ rule: r, status: 'stale', candidateHits: [0] });

  function harness(probes: RuleHealth[][]) {
    const waits: number[] = [];
    const reports: { id: string; status: string }[][] = [];
    let i = 0;
    return {
      waits,
      reports,
      deps: {
        settle: async (ms: number) => (waits.push(ms), true),
        probe: () => probes[i++] ?? [],
        report: async (res: { id: string; status: 'ok' | 'stale' }[]) => void reports.push(res),
      },
    };
  }

  it('先等页面安定（宽限）再判；全部命中只体检一次', async () => {
    const h = harness([[ok(r1), ok(r2)]]);
    await runHealthCheck(h.deps, { firstDelayMs: 3000, confirmDelayMs: 5000 });
    expect(h.waits).toEqual([3000]);
    expect(h.reports).toEqual([[{ id: 'r1', status: 'ok' }, { id: 'r2', status: 'ok' }]]);
  });

  it('第一次没找到不立即判失效：隔一段时间再查一次，两次都没找到才判 stale', async () => {
    const h = harness([
      [stale(r1), stale(r2)],
      [stale(r1), ok(r2)], // r2 是懒加载内容，第二次出现了
    ]);
    await runHealthCheck(h.deps, { firstDelayMs: 3000, confirmDelayMs: 5000 });
    expect(h.waits).toEqual([3000, 5000]);
    expect(h.reports).toEqual([[{ id: 'r1', status: 'stale' }, { id: 'r2', status: 'ok' }]]);
  });

  it('等待期间被取消（路由变化 / 切原样 / 失效）就不判、不写', async () => {
    const reports: unknown[] = [];
    await runHealthCheck(
      { settle: async () => false, probe: () => [stale(r1)], report: async (r) => void reports.push(r) },
      { firstDelayMs: 1, confirmDelayMs: 1 },
    );
    expect(reports).toEqual([]);
  });

  it('第二次时规则已不在生效范围内（路由变了）：这条不下结论', async () => {
    const h = harness([[stale(r1), stale(r2)], [stale(r2)]]);
    await runHealthCheck(h.deps, { firstDelayMs: 1, confirmDelayMs: 1 });
    expect(h.reports).toEqual([[{ id: 'r2', status: 'stale' }]]);
  });
});
