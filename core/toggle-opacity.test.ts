import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TOGGLE_OPACITY,
  TOGGLE_OPACITY_MAX,
  TOGGLE_OPACITY_MIN,
  normalizeToggleOpacity,
} from './toggle-opacity';

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

describe('胶囊闲置不透明度（#110 滑杆）', () => {
  it('区间与默认：0.1–1，默认 1', () => {
    expect(TOGGLE_OPACITY_MIN).toBe(0.1);
    expect(TOGGLE_OPACITY_MAX).toBe(1);
    expect(DEFAULT_TOGGLE_OPACITY).toBe(1);
  });

  it('normalize：合法值原样、夹取、四舍五入到 10% 网格', () => {
    expect(normalizeToggleOpacity(1)).toBe(1);
    expect(normalizeToggleOpacity(0.1)).toBe(0.1);
    expect(normalizeToggleOpacity(0.5)).toBe(0.5);
    expect(normalizeToggleOpacity(0.55)).toBe(0.6); // 10% 网格取整
    expect(normalizeToggleOpacity(0.04)).toBe(0.1); // 低于下限夹到 0.1
    expect(normalizeToggleOpacity(1.5)).toBe(1); // 高于上限夹到 1
    expect(normalizeToggleOpacity(-2)).toBe(0.1);
  });

  it('normalize：旧三档字符串迁移（旧存储 / 旧导出文件）', () => {
    expect(normalizeToggleOpacity('full')).toBe(1);
    expect(normalizeToggleOpacity('soft')).toBe(0.9); // 旧 0.85 归到 10% 网格上的 0.9
    expect(normalizeToggleOpacity('faint')).toBe(0.7);
    expect(normalizeToggleOpacity('dim')).toBe(1); // 不认识的字符串回默认
  });

  it('normalize：非数值 / 缺失回默认 1', () => {
    expect(normalizeToggleOpacity(null)).toBe(1);
    expect(normalizeToggleOpacity(undefined)).toBe(1);
    expect(normalizeToggleOpacity(Number.NaN)).toBe(1);
    expect(normalizeToggleOpacity('0.3')).toBe(1); // 数字字符串不认（存储层不该出现）
  });

  it('100% 时文字对比度 ≥4.5（最差页面底色：纯白与纯黑）', () => {
    let worst = Infinity;
    for (let v = 0; v <= 255; v += 5) {
      const page: [number, number, number] = [v, v, v];
      worst = Math.min(worst, contrast(blend(FG, page, 1), blend(BG, page, 1)));
    }
    expect(worst).toBeGreaterThanOrEqual(4.5);
  });

  /**
   * 低档位的例外（#110 定案，不要把「每档 ≥4.5」加回来）：闲置不透明度调的是「闲置可见度」，
   * 悬停 / 键盘聚焦 / 拖动时回到 100%（那一刻满足对比度），闲置时的低对比是用户主动选择的
   * 可见度（iOS 辅助触控、OPPO 悬浮球同类）。10% 约 1.2:1 是预期。
   */
  it('10% 闲置对比度约 1.2:1——低档位例外，预期就是不达 4.5', () => {
    let worst = Infinity;
    for (let v = 0; v <= 255; v += 5) {
      const page: [number, number, number] = [v, v, v];
      worst = Math.min(worst, contrast(blend(FG, page, 0.1), blend(BG, page, 0.1)));
    }
    expect(worst).toBeLessThan(2);
    expect(worst).toBeGreaterThan(1);
  });
});
