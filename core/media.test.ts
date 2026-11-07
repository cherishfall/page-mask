import { describe, expect, it } from 'vitest';
import { buildMediaCss, MEDIA_KEEP_ATTR, SMALL_MEDIA_MAX_PX, shouldKeepMedia } from './media';

describe('buildMediaCss 灰度样式（0.8.0，#131）', () => {
  it('开关没开 / 缺省：没有样式（旧数据、原样态都不注入）', () => {
    expect(buildMediaCss({})).toBeNull();
    expect(buildMediaCss({ mediaGray: false })).toBeNull();
  });

  it('打开：img（放行小图标记与 emoji）与 video 一条规则，grayscale 去色', () => {
    const css = buildMediaCss({ mediaGray: true })!;
    expect(css).toContain(`img:not([${MEDIA_KEEP_ATTR}])`);
    expect(css).toContain('[class*="emoji" i]');
    expect(css).toContain('[alt*="emoji" i]');
    expect(css).toContain('[src*="emoji" i]');
    expect(css).toContain(', video {');
    expect(css).toContain('filter: grayscale(1) !important;');
  });

  it('灰度保布局、可点穿：不加 display / visibility / pointer-events，也不再需要明暗两套灰度', () => {
    const css = buildMediaCss({ mediaGray: true })!;
    expect(css).not.toContain('display:');
    expect(css).not.toContain('visibility:');
    expect(css).not.toContain('pointer-events:');
    expect(css).not.toContain('background-color:');
    expect(css).not.toContain('brightness');
    expect(css).not.toContain('@media');
  });
});

describe('shouldKeepMedia 小图豁免判定（#116）', () => {
  it('渲染尺寸小的图标放行，大的收起', () => {
    expect(shouldKeepMedia({ renderedWidth: 16, renderedHeight: 16 })).toBe(true);
    expect(shouldKeepMedia({ renderedWidth: 600, renderedHeight: 400 })).toBe(false);
    expect(shouldKeepMedia({ renderedWidth: 24, renderedHeight: 400 })).toBe(false);
  });

  it('渲染尺寸优先：CSS 把大图缩到图标大小时按看到的尺寸放行', () => {
    expect(shouldKeepMedia({ renderedWidth: 24, renderedHeight: 24, naturalWidth: 1200, naturalHeight: 800 })).toBe(true);
  });

  it('还没排版时退回 HTML 属性 / 原始尺寸', () => {
    expect(shouldKeepMedia({ renderedWidth: 0, renderedHeight: 0, widthAttr: 20, heightAttr: 20 })).toBe(true);
    expect(shouldKeepMedia({ naturalWidth: 16, naturalHeight: 16 })).toBe(true);
    expect(shouldKeepMedia({ naturalWidth: 900, naturalHeight: 600 })).toBe(false);
  });

  it('尺寸完全未知：不豁免（先灰着，load 后重新判定，避免漏收大图）', () => {
    expect(shouldKeepMedia({})).toBe(false);
    expect(shouldKeepMedia({ renderedWidth: 0, renderedHeight: 0 })).toBe(false);
  });

  it('emoji 无论大小写、出现在 class / alt / src 都放行', () => {
    expect(shouldKeepMedia({ className: 'Emoji twemoji', renderedWidth: 400, renderedHeight: 400 })).toBe(true);
    expect(shouldKeepMedia({ alt: 'EMOJI', renderedWidth: 400, renderedHeight: 400 })).toBe(true);
    expect(shouldKeepMedia({ src: '/static/emoji/1f600.png' })).toBe(true);
  });

  it('边界：恰好 32px 放行，33px 收起', () => {
    expect(shouldKeepMedia({ renderedWidth: SMALL_MEDIA_MAX_PX, renderedHeight: SMALL_MEDIA_MAX_PX })).toBe(true);
    expect(shouldKeepMedia({ renderedWidth: SMALL_MEDIA_MAX_PX + 1, renderedHeight: 20 })).toBe(false);
  });
});
