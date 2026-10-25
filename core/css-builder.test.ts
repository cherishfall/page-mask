import { describe, expect, it } from 'vitest';
import { buildDisguiseCss, buildRuleCss, maskRulesAt, nextStrategy } from './css-builder';
import type { HideRule } from './types';

const baseRule = (over: Partial<HideRule>): HideRule => ({
  id: 'r1',
  elementName: '顶部导航栏',
  candidates: ['#nav', '.site-nav'],
  strategy: 'remove',
  scope: { type: 'all' },
  onlyThis: false,
  createdAt: 0,
  ...over,
});

describe('buildRuleCss 三方案', () => {
  it('方案A 彻底移除：display none + !important', () => {
    expect(buildRuleCss(baseRule({ strategy: 'remove' }))).toBe('#nav, .site-nav { display: none !important; }');
  });
  it('方案B 原地留白：visibility hidden + 不可点', () => {
    const css = buildRuleCss(baseRule({ strategy: 'blank' }))!;
    expect(css).toContain('visibility: hidden !important');
    expect(css).toContain('pointer-events: none !important');
  });
  it('方案C 遮罩不走 CSS，返回 null', () => {
    expect(buildRuleCss(baseRule({ strategy: 'mask' }))).toBeNull();
  });
});

describe('buildDisguiseCss 按页面范围汇总', () => {
  it('只输出该页面上生效的 A/B 方案规则', () => {
    const rules = [
      baseRule({ id: 'a', strategy: 'remove' }),
      baseRule({ id: 'm', strategy: 'mask' }),
      baseRule({
        id: 'other',
        scope: { type: 'include', patterns: [{ label: '书架', prefix: 'https://x.com/shelf/' }] },
      }),
    ];
    const css = buildDisguiseCss(rules, 'https://x.com/reader/1')!;
    expect(css).toContain('display: none');
    expect(css).not.toContain('visibility'); // mask 与范围外规则都不在
  });
  it('无可用规则返回 null', () => {
    expect(buildDisguiseCss([], 'https://x.com/')).toBeNull();
  });
});

describe('maskRulesAt 方案C清单', () => {
  it('只返回当前页面上的遮罩规则', () => {
    const rules = [
      baseRule({ id: 'm1', strategy: 'mask' }),
      baseRule({ id: 'a1', strategy: 'remove' }),
    ];
    const masks = maskRulesAt(rules, 'https://x.com/');
    expect(masks.map((r) => r.id)).toEqual(['m1']);
  });
});

describe('nextStrategy A→B→C 循环', () => {
  it('预览中换下一个方案', () => {
    expect(nextStrategy('remove')).toBe('blank');
    expect(nextStrategy('blank')).toBe('mask');
    expect(nextStrategy('mask')).toBe('remove');
  });
});
