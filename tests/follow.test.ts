/**
 * 遮罩跟随（ui/follow.ts，#23 / REVIEW N42）：事件驱动，静止后不再逐帧回调。
 * 动画帧与 ResizeObserver 在 jsdom 里没有真实实现，这里换成可手动推进的替身。
 */
import { ElementFollower } from '@/ui/follow';

let frames: FrameRequestCallback[] = [];
let resizeCallbacks: ResizeObserverCallback[] = [];

function flushFrame(): void {
  const run = frames;
  frames = [];
  for (const cb of run) cb(performance.now());
}
/** 一直推进到没有待执行的帧（最多 50 帧，防止死循环），返回推进了几帧 */
function flushUntilIdle(): number {
  let n = 0;
  while (frames.length && n < 50) {
    flushFrame();
    n++;
  }
  return n;
}

function makeEl(rect: { left: number; top: number; width: number; height: number }) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const state = { ...rect };
  el.getBoundingClientRect = () =>
    ({ ...state, right: state.left + state.width, bottom: state.top + state.height, x: state.left, y: state.top }) as DOMRect;
  return { el, state };
}

beforeEach(() => {
  frames = [];
  resizeCallbacks = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    frames = [];
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: ResizeObserverCallback) {
        resizeCallbacks.push(cb);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('ElementFollower：事件驱动跟随', () => {
  it('开始跟随时立即定位，跑几帧确认静止后不再请求动画帧', () => {
    const f = new ElementFollower();
    const { el } = makeEl({ left: 10, top: 20, width: 100, height: 50 });
    const box = document.createElement('div');
    f.trackLive(el, box);
    expect(box.style.top).toBe('20px');
    expect(box.style.width).toBe('100px');
    const n = flushUntilIdle();
    expect(n).toBeLessThanOrEqual(5);
    expect(frames).toHaveLength(0);
    f.stop();
  });

  it('页面滚动后恢复跟随，跟到新位置后再次停帧', () => {
    const f = new ElementFollower();
    const { el, state } = makeEl({ left: 0, top: 300, width: 100, height: 50 });
    const box = document.createElement('div');
    f.trackLive(el, box);
    flushUntilIdle();
    state.top = 120;
    window.dispatchEvent(new Event('scroll'));
    expect(frames.length).toBeGreaterThan(0);
    flushUntilIdle();
    expect(box.style.top).toBe('120px');
    expect(frames).toHaveLength(0);
    f.stop();
  });

  it('页面里的滚动容器滚动（事件不冒泡，靠捕获阶段）也触发跟随', () => {
    const f = new ElementFollower();
    const { el, state } = makeEl({ left: 0, top: 300, width: 100, height: 50 });
    const scroller = document.createElement('div');
    document.body.appendChild(scroller);
    const box = document.createElement('div');
    f.trackLive(el, box);
    flushUntilIdle();
    state.top = 250;
    scroller.dispatchEvent(new Event('scroll', { bubbles: false }));
    flushUntilIdle();
    expect(box.style.top).toBe('250px');
    f.stop();
  });

  it('被遮元素尺寸变化（ResizeObserver 回调）触发跟随', () => {
    const f = new ElementFollower();
    const { el, state } = makeEl({ left: 0, top: 0, width: 100, height: 50 });
    const box = document.createElement('div');
    f.trackLive(el, box);
    flushUntilIdle();
    state.height = 80;
    for (const cb of resizeCallbacks) cb([], {} as ResizeObserver);
    flushUntilIdle();
    expect(box.style.height).toBe('80px');
    f.stop();
  });

  it('check()：位置没变不启动逐帧；变了才启动', () => {
    const f = new ElementFollower();
    const { el, state } = makeEl({ left: 0, top: 0, width: 100, height: 50 });
    const box = document.createElement('div');
    f.trackLive(el, box);
    flushUntilIdle();
    expect(f.check()).toBe(false);
    expect(frames).toHaveLength(0);
    state.left = 40;
    expect(f.check()).toBe(true);
    expect(box.style.left).toBe('40px');
    expect(frames.length).toBeGreaterThan(0);
    f.stop();
  });

  it('元素不再占位（矩形为 0）时隐藏盒子', () => {
    const f = new ElementFollower();
    const { el, state } = makeEl({ left: 0, top: 0, width: 100, height: 50 });
    const box = document.createElement('div');
    f.trackLive(el, box);
    state.width = 0;
    state.height = 0;
    f.check();
    expect(box.style.display).toBe('none');
    f.stop();
  });

  it('stop() 后滚动不再请求动画帧（监听已撤）', () => {
    const f = new ElementFollower();
    const { el } = makeEl({ left: 0, top: 0, width: 100, height: 50 });
    f.trackLive(el, document.createElement('div'));
    flushUntilIdle();
    f.stop();
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('resize'));
    expect(frames).toHaveLength(0);
  });

  it('位置修正回调：每帧按真实矩形算出盒子位置（号码牌放到元素外面，#52）', () => {
    const f = new ElementFollower();
    const { el, state } = makeEl({ left: 10, top: 100, width: 100, height: 50 });
    const box = document.createElement('div');
    // 号码牌：贴在元素上方 24px 处
    f.trackLive(el, box, (r) => ({ left: r.left, top: r.top - 24, width: 24, height: 24 }));
    expect(box.style.left).toBe('10px');
    expect(box.style.top).toBe('76px');
    expect(box.style.height).toBe('24px');
    flushUntilIdle();
    // 页面滚动使元素顶到视口顶部：修正函数继续生效，盒子不会停在旧位置
    state.top = 0;
    window.dispatchEvent(new Event('scroll'));
    flushUntilIdle();
    expect(box.style.top).toBe('-24px');
    f.stop();
  });
});
