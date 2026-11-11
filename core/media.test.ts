import { describe, expect, it } from 'vitest';
import { buildMediaCss } from './media';

describe('buildMediaCss 整页灰度（0.8.18，#156，ADR-0018）', () => {
  it('开关没开 / 缺省：没有样式（旧数据、原样态都不注入）', () => {
    expect(buildMediaCss({})).toBeNull();
    expect(buildMediaCss({ mediaGray: false })).toBeNull();
  });

  it('打开：一条 html{filter} 规则整页去色，不再有任何按元素类型/尺寸的例外', () => {
    const css = buildMediaCss({ mediaGray: true })!;
    expect(css).toBe('html { filter: grayscale(1) !important; }');
  });

  it('灰度保布局、可点穿：不加 display / visibility / pointer-events，也不再需要明暗两套灰度', () => {
    const css = buildMediaCss({ mediaGray: true })!;
    expect(css).not.toContain('display:');
    expect(css).not.toContain('visibility:');
    expect(css).not.toContain('pointer-events:');
    expect(css).not.toContain('brightness');
    expect(css).not.toContain('@media');
    // 0.8.16 的打标选择器随媒体路线退场（#156）：不再依赖任何 data-pm-media-* 属性
    expect(css).not.toContain('data-pm-media');
  });
});
