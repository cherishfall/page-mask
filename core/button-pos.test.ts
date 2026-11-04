import { describe, expect, it } from 'vitest';
import { BUTTON_EDGE, clampEdgeY, isLeftDock, snapXToEdge } from './button-pos';

describe('isLeftDock（#84 停靠侧判定）', () => {
  it('x ≤ BUTTON_EDGE 判左停靠', () => {
    expect(isLeftDock(BUTTON_EDGE)).toBe(true);
    expect(isLeftDock(0)).toBe(true);
  });
  it('右停靠的边缘坐标判右', () => {
    expect(isLeftDock(BUTTON_EDGE + 1)).toBe(false);
    expect(isLeftDock(1200)).toBe(false);
  });
});

describe('snapXToEdge（#84 松手贴最近边）', () => {
  const vw = 1280;

  it('按钮中心在左半视口 → 贴左缘', () => {
    expect(snapXToEdge(300, 145, vw)).toBe(BUTTON_EDGE);
  });

  it('按钮中心在右半视口 → 贴右缘', () => {
    expect(snapXToEdge(900, 145, vw)).toBe(vw - 145 - BUTTON_EDGE);
  });

  it('中心正好落在视口中点 → 贴左（≤ 判定）', () => {
    expect(snapXToEdge(vw / 2 - 145 / 2, 145, vw)).toBe(BUTTON_EDGE);
  });

  it('窄视口右缘夹紧不越界', () => {
    expect(snapXToEdge(600, 145, 100)).toBe(BUTTON_EDGE);
  });
});

describe('clampEdgeY（#84 纵向夹紧）', () => {
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
