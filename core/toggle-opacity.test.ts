import { describe, expect, it } from 'vitest';
import { TOGGLE_OPACITY, TOGGLE_OPACITY_LEVELS, isToggleOpacity } from './toggle-opacity';

/** 与 tests/tokens-contrast.test.ts 同一套相对亮度公式 */
function linear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
function luminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}
function contrast(a: [number, number, number], b: [number, number, number]): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function blend(c: [number, number, number], page: [number, number, number], alpha: number): [number, number, number] {
  return c.map((v, i) => Math.round(alpha * v + (1 - alpha) * page[i]!)) as [number, number, number];
}

const FG: [number, number, number] = [0x1f, 0x23, 0x29]; // --pm-fg-light
const BG: [number, number, number] = [0xff, 0xff, 0xff]; // --pm-bg-light

describe('胶囊不透明度三档（#102）', () => {
  it('取值是约定的 100% / 85% / 70%，且只有这三档', () => {
    expect(TOGGLE_OPACITY_LEVELS).toEqual(['full', 'soft', 'faint']);
    expect(TOGGLE_OPACITY.full).toBe(1);
    expect(TOGGLE_OPACITY.soft).toBe(0.85);
    expect(TOGGLE_OPACITY.faint).toBe(0.7);
  });

  it('三档下文字对比度都 ≥4.5（最差页面底色：纯白与纯黑）', () => {
    for (const level of TOGGLE_OPACITY_LEVELS) {
      const alpha = TOGGLE_OPACITY[level];
      let worst = Infinity;
      // 从纯黑到纯白扫一遍页面底色，取最差
      for (let v = 0; v <= 255; v += 5) {
        const page: [number, number, number] = [v, v, v];
        worst = Math.min(worst, contrast(blend(FG, page, alpha), blend(BG, page, alpha)));
      }
      expect(worst, `${level} 的最差文字对比度`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('只认三个字符串；存储里的坏值回落由 readSettings 负责', () => {
    expect(isToggleOpacity('full')).toBe(true);
    expect(isToggleOpacity('soft')).toBe(true);
    expect(isToggleOpacity('faint')).toBe(true);
    expect(isToggleOpacity('dim')).toBe(false);
    expect(isToggleOpacity(0.5)).toBe(false);
    expect(isToggleOpacity(undefined)).toBe(false);
  });
});
