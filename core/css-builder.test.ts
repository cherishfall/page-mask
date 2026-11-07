import { describe, expect, it } from 'vitest';
import { buildDisguiseCss, buildPreviewCss, buildRuleCss, buildSameGroupOutlineCss, maskRulesAt, nextStrategy } from './css-builder';
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
  it('方案A 彻底移除：每个候选一个独立块，display none + !important', () => {
    expect(buildRuleCss(baseRule({ strategy: 'remove' }))).toBe(
      '#nav { display: none !important; }\n.site-nav { display: none !important; }',
    );
  });
  it('方案B 原地留白：透明 + 隐藏 + 不可点（后代写 visibility:visible 也透不出来）', () => {
    const css = buildRuleCss(baseRule({ strategy: 'blank', candidates: ['#nav'] }))!;
    expect(css).toBe(
      '#nav { visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; }',
    );
  });
  it('词法不安全的候选被丢弃，其余照常输出', () => {
    expect(buildRuleCss(baseRule({ candidates: ['#nav', 'a{}'] }))).toBe('#nav { display: none !important; }');
  });
  it('全部候选都不可用时返回 null', () => {
    expect(buildRuleCss(baseRule({ candidates: ['a{}'] }))).toBeNull();
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

describe('buildDisguiseCss 并入媒体灰度（0.8.0，#131）', () => {
  it('0 条收起规则但开了媒体开关：也要有正式样式，不能返回 null', () => {
    const css = buildDisguiseCss([], 'https://x.com/', { mediaGray: true })!;
    expect(css).toContain('img:not(');
    expect(css).toContain('filter: grayscale(1)');
  });

  it('规则 CSS 与媒体 CSS 拼在同一份文本里：swapCss 只需维护一份记录', () => {
    const css = buildDisguiseCss([baseRule({})], 'https://x.com/', { mediaGray: true })!;
    expect(css).toContain('display: none');
    expect(css).toContain(', video {');
  });

  it('不传 media（向导预览 / 草稿）：不带媒体块，临时还原后看得清页面', () => {
    const css = buildDisguiseCss([baseRule({})], 'https://x.com/')!;
    expect(css).not.toContain('grayscale');
    expect(css).toContain('display: none');
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

describe('buildPreviewCss 向导预览与正式样式同一实现', () => {
  it('草稿与保存后的规则生成完全相同的 CSS 文本', () => {
    const drafts = [
      { candidates: ['#nav'], strategy: 'remove' as const },
      { candidates: ['.ad'], strategy: 'blank' as const },
      { candidates: ['.x'], strategy: 'mask' as const },
    ];
    const saved = drafts.map((d, i) => baseRule({ id: `r${i}`, ...d }));
    expect(buildPreviewCss(drafts)).toBe(buildDisguiseCss(saved, 'https://x.com/'));
    expect(buildPreviewCss(drafts)).toBe(
      '#nav { display: none !important; }\n' +
        '.ad { visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; }',
    );
  });
  it('没有 A/B 方案草稿时返回 null（= 清除预览）', () => {
    expect(buildPreviewCss([{ candidates: ['.x'], strategy: 'mask' }])).toBeNull();
    expect(buildPreviewCss([])).toBeNull();
  });
});

describe('buildSameGroupOutlineCss 同类组统一描边（#100）', () => {
  it('全部候选合成一条样式规则（一个块），虚线描边 + !important', () => {
    expect(buildSameGroupOutlineCss(['.post', 'div.post'])).toBe(
      '.post, div.post { outline: 2px dashed rgb(59 130 246 / 0.9) !important; outline-offset: -2px !important; }',
    );
  });
  it('不安全的候选被丢弃，其余照常输出', () => {
    expect(buildSameGroupOutlineCss(['.post', 'a{}'])).toBe(
      '.post { outline: 2px dashed rgb(59 130 246 / 0.9) !important; outline-offset: -2px !important; }',
    );
  });
  it('全部候选都不可用时返回 null', () => {
    expect(buildSameGroupOutlineCss(['a{}'])).toBeNull();
    expect(buildSameGroupOutlineCss([])).toBeNull();
  });
});
