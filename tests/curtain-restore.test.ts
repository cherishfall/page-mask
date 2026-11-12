/**
 * 幕布恢复按钮的挂载夹取（#186）：上次大窗口拖出去的坐标，这次小窗口不能把
 * 唯一的页内出路挂到屏幕外。挂载即按当前视口夹紧（与拖动 / onResize 用同一个 clamp、
 * 同一个视口来源 window.innerWidth/innerHeight），只改显示位置、不回写存储。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCurtainRestoreButton } from '@/ui/curtain-restore';

/** jsdom 的 getBoundingClientRect 恒为 0：首帧按 FALLBACK_SIZE（62×28）夹紧 */
function setViewport(w: number, h: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: h });
}

let root: HTMLElement;
let mounted: Array<{ destroy(): void }> = [];

beforeEach(() => {
  root = document.createElement('div');
  document.body.appendChild(root);
});

afterEach(() => {
  for (const b of mounted) b.destroy();
  mounted = [];
  root.remove();
  setViewport(1024, 768);
});

function mount(position: { x: number; y: number } | null): HTMLButtonElement {
  const btn = createCurtainRestoreButton({
    root,
    position,
    onMove: () => undefined,
    onRestore: () => undefined,
  });
  mounted.push(btn);
  return btn.el;
}

describe('挂载即夹进当前视口（#186）', () => {
  it('上次大窗口拖出去的坐标，这次小窗口挂载时被夹回视口内', () => {
    setViewport(800, 600);
    const el = mount({ x: 1500, y: 900 });
    expect(el.style.left).toBe('730px'); // 800 − 按钮宽 62 − 边缘距 8
    expect(el.style.top).toBe('564px'); // 600 − 按钮高 28 − 边缘距 8
  });

  it('视口内的坐标原样保留', () => {
    setViewport(800, 600);
    const el = mount({ x: 100, y: 100 });
    expect(el.style.left).toBe('100px');
    expect(el.style.top).toBe('100px');
  });

  it('出界的负坐标夹到边缘距', () => {
    setViewport(800, 600);
    const el = mount({ x: -50, y: -50 });
    expect(el.style.left).toBe('8px');
    expect(el.style.top).toBe('8px');
  });

  it('没存过坐标仍是右下角默认位置，不走夹取', () => {
    setViewport(800, 600);
    const el = mount(null);
    expect(el.style.right).toBe('16px');
    expect(el.style.bottom).toBe('16px');
    expect(el.style.left).toBe('');
  });
});
