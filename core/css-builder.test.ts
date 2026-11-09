import { describe, expect, it } from 'vitest';
import { buildDisguiseCss, buildPreviewCss, buildRuleCss, buildSameGroupOutlineCss, maskRulesAt, nextStrategy } from './css-builder';
import { createEmptyProfile, type HideRule, type SiteProfile } from './types';

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

const profileOf = (over: Partial<SiteProfile> = {}): SiteProfile => ({
  ...createEmptyProfile('https://x.com', 0),
  switchState: 'disguised',
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

describe('buildDisguiseCss 按页面范围与两态汇总（0.8.3）', () => {
  it('清爽态：只输出该页面上生效的 A/B 方案规则', () => {
    const rules = [
      baseRule({ id: 'a', strategy: 'remove' }),
      baseRule({ id: 'm', strategy: 'mask' }),
      baseRule({
        id: 'other',
        scope: { type: 'include', patterns: [{ label: '书架', prefix: 'https://x.com/shelf/' }] },
      }),
    ];
    const css = buildDisguiseCss(profileOf({ hideRules: rules }), 'https://x.com/reader/1')!;
    expect(css).toContain('display: none');
    expect(css).not.toContain('visibility'); // mask 与范围外规则都不在
  });
  it('清爽态无可用规则、灰度没开：返回 null', () => {
    expect(buildDisguiseCss(profileOf(), 'https://x.com/')).toBeNull();
  });
  it('原样态：规则不输出（主开关只管收起与标题图标这组定制）', () => {
    const css = buildDisguiseCss(profileOf({ hideRules: [baseRule({})], switchState: 'original' }), 'https://x.com/');
    expect(css).toBeNull();
  });
  it('灰度独立于两态：原样态 mediaGray 开着也输出媒体块', () => {
    const css = buildDisguiseCss(profileOf({ switchState: 'original', mediaGray: true }), 'https://x.com/')!;
    expect(css).toContain('img:not(');
    expect(css).toContain('filter: grayscale(1)');
    expect(css).not.toContain('display: none');
  });
  it('清爽态 + 灰度：规则与媒体拼在同一份文本里，swapCss 只需维护一份记录', () => {
    const css = buildDisguiseCss(profileOf({ hideRules: [baseRule({})], mediaGray: true }), 'https://x.com/')!;
    expect(css).toContain('display: none');
    expect(css).toContain(', video, [data-pm-media-bg]:not([data-pm-media-keep]) {');
  });
  it('原样态 + 灰度关：返回 null', () => {
    expect(buildDisguiseCss(profileOf({ switchState: 'original' }), 'https://x.com/')).toBeNull();
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
    expect(buildPreviewCss(drafts)).toBe(buildDisguiseCss(profileOf({ hideRules: saved }), 'https://x.com/'));
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
