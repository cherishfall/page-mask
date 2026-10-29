import { describe, expect, it } from 'vitest';
import { checkIconSource, containRect, effectiveIcon, ICON_ERROR, ICON_SIZE, MAX_ICON_SOURCE_BYTES, TRANSPARENT_PNG } from './icon';

describe('checkIconSource', () => {
  it('接受常见图片格式且不超过 5MB', () => {
    expect(checkIconSource({ type: 'image/png', size: 2 * 1024 * 1024 })).toBeNull();
    expect(checkIconSource({ type: 'image/jpeg', size: MAX_ICON_SOURCE_BYTES })).toBeNull();
    expect(checkIconSource({ type: 'image/x-icon', size: 1000 })).toBeNull();
  });
  it('超过 5MB 用人话提示', () => {
    expect(checkIconSource({ type: 'image/png', size: MAX_ICON_SOURCE_BYTES + 1 })).toBe(ICON_ERROR.tooLarge);
  });
  it('拒绝 SVG 等其它类型', () => {
    expect(checkIconSource({ type: 'image/svg+xml', size: 100 })).toBe(ICON_ERROR.type);
    expect(checkIconSource({ type: '', size: 100 })).toBe(ICON_ERROR.type);
  });
});

describe('containRect', () => {
  it('正方形铺满', () => {
    expect(containRect(512, 512)).toEqual({ dx: 0, dy: 0, dw: ICON_SIZE, dh: ICON_SIZE });
  });
  it('横图等比缩放、上下居中留白', () => {
    expect(containRect(200, 100, 32)).toEqual({ dx: 0, dy: 8, dw: 32, dh: 16 });
  });
  it('竖图等比缩放、左右居中留白', () => {
    expect(containRect(100, 400, 32)).toEqual({ dx: 12, dy: 0, dw: 8, dh: 32 });
  });
  it('小图放大到画布', () => {
    expect(containRect(16, 16, 32)).toEqual({ dx: 0, dy: 0, dw: 32, dh: 32 });
  });
  it('极端长条至少保留 1 像素', () => {
    expect(containRect(10000, 1, 32)).toEqual({ dx: 0, dy: 15, dw: 32, dh: 1 });
  });
  it('非法尺寸返回 null', () => {
    expect(containRect(0, 10)).toBeNull();
    expect(containRect(10, Number.NaN)).toBeNull();
    expect(containRect(Infinity, 10)).toBeNull();
  });
});

describe('effectiveIcon：站点自己的图标 > 插件默认图标 > 内置透明图标', () => {
  const SITE_ICON = 'data:image/png;base64,SITE';
  const DEFAULT_ICON = 'data:image/png;base64,DEFAULT';

  it('三层依次兜底', () => {
    expect(effectiveIcon({ faviconDataUrl: SITE_ICON }, { defaultIconDataUrl: DEFAULT_ICON })).toBe(SITE_ICON);
    expect(effectiveIcon({ faviconDataUrl: null }, { defaultIconDataUrl: DEFAULT_ICON })).toBe(DEFAULT_ICON);
    expect(effectiveIcon({ faviconDataUrl: null }, { defaultIconDataUrl: null })).toBe(TRANSPARENT_PNG);
  });

  it('站点自己设过图标时，改插件默认图标不影响它；没设过的跟着变', () => {
    const settings = { defaultIconDataUrl: 'data:image/png;base64,OLD' };
    const withOwn = { faviconDataUrl: SITE_ICON };
    const withoutOwn = { faviconDataUrl: null };
    expect(effectiveIcon(withOwn, settings)).toBe(SITE_ICON);
    expect(effectiveIcon(withoutOwn, settings)).not.toBe(effectiveIcon(withoutOwn, { defaultIconDataUrl: DEFAULT_ICON }));
  });

  it('坏数据不会漏进标签页：非字符串 / 空串都按没设置处理', () => {
    for (const bad of [undefined, 42, '', {}, null]) {
      expect(effectiveIcon({ faviconDataUrl: bad }, { defaultIconDataUrl: bad })).toBe(TRANSPARENT_PNG);
    }
    expect(effectiveIcon({ faviconDataUrl: '' }, null)).toBe(TRANSPARENT_PNG);
    expect(effectiveIcon({ faviconDataUrl: '' }, undefined)).toBe(TRANSPARENT_PNG);
  });
});
