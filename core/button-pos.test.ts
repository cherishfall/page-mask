import { describe, expect, it } from 'vitest';
import { BUTTON_EDGE, clampEdgeY, clampPos } from './button-pos';

describe('clampPos（0.8.6 自由定位，#135：x/y 都夹进视口）', () => {
  const vw = 1280;
  const vh = 800;

  it('视口内原样保留', () => {
    expect(clampPos(300, 220, 137, 32, vw, vh)).toEqual({ x: 300, y: 220 });
  });

  it('左/上越界 → 夹到 BUTTON_EDGE', () => {
    expect(clampPos(-40, -10, 137, 32, vw, vh)).toEqual({ x: BUTTON_EDGE, y: BUTTON_EDGE });
  });

  it('右/下越界 → 夹到 视口 − 控件 − BUTTON_EDGE', () => {
    expect(clampPos(2000, 1500, 137, 32, vw, vh)).toEqual({
      x: vw - 137 - BUTTON_EDGE,
      y: vh - 32 - BUTTON_EDGE,
    });
  });

  it('视口比控件还窄/矮时取 BUTTON_EDGE（避免负数）', () => {
    expect(clampPos(600, 500, 137, 32, 100, 20)).toEqual({ x: BUTTON_EDGE, y: BUTTON_EDGE });
  });
});

describe('clampEdgeY（纵向夹紧，幕布恢复按钮 resize 用）', () => {
  it('顶边不小于 BUTTON_EDGE', () => {
    expect(clampEdgeY(2, 32, 800)).toBe(BUTTON_EDGE);
  });

  it('底边不出视口', () => {
    expect(clampEdgeY(2000, 32, 800)).toBe(800 - 32 - BUTTON_EDGE);
  });

  it('视口比按钮还矮时取 BUTTON_EDGE（避免负数）', () => {
    expect(clampEdgeY(100, 900, 800)).toBe(BUTTON_EDGE);
  });

  it('正常范围内不动', () => {
    expect(clampEdgeY(220, 32, 800)).toBe(220);
  });
});
