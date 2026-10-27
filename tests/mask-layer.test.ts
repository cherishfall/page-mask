/**
 * 方案C遮罩覆盖层（ui/mask-layer.ts，#23）：后加载元素补遮罩、移除时撤掉、颜色取背后底色、
 * 遮罩拦下指针事件、清掉后不再观察 DOM。
 */
import { MaskLayer } from '@/ui/mask-layer';
import { HOST_TAGS } from '@/core/host-shield';
import type { PageHost } from '@/ui/page-host';

let hosts: PageHost[] = [];

function fakeHost(): PageHost {
  const host = document.createElement(HOST_TAGS.mask);
  const shadow = host.attachShadow({ mode: 'open' });
  const root = document.createElement('div');
  shadow.appendChild(root);
  document.documentElement.appendChild(host);
  const h = { host, shadow, root, remove: () => host.remove() };
  hosts.push(h);
  return h;
}

function newLayer(): MaskLayer {
  return new MaskLayer({
    createHost: fakeHost,
    schedule: (fn, ms) => {
      const id = setTimeout(fn, ms);
      return () => clearTimeout(id);
    },
  });
}

const boxes = () => document.querySelector(HOST_TAGS.mask)?.shadowRoot?.querySelectorAll('[data-pm-mask]') ?? [];

/** 让 MutationObserver 回调（微任务）跑完，再走完节流间隔 */
async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  vi.advanceTimersByTime(150);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  hosts = [];
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
  for (const h of hosts) h.remove();
});

describe('MaskLayer', () => {
  it('给已有的命中元素各盖一块遮罩（同一元素命中多个选择器只盖一块）', () => {
    document.body.innerHTML = '<div class="ad" id="a1"></div><div class="ad"></div><p>正文</p>';
    const layer = newLayer();
    layer.show(['.ad', '#a1']);
    expect(boxes()).toHaveLength(2);
    layer.clear();
  });

  it('之后插入的命中元素自动补遮罩，元素移除时遮罩撤掉', async () => {
    document.body.innerHTML = '<main></main>';
    const layer = newLayer();
    layer.show(['.late-ad']);
    expect(boxes()).toHaveLength(0);
    const ad = document.createElement('div');
    ad.className = 'late-ad';
    document.querySelector('main')!.appendChild(ad);
    await settle();
    expect(boxes()).toHaveLength(1);
    ad.remove();
    await settle();
    expect(boxes()).toHaveLength(0);
    layer.clear();
  });

  it('class 变化后才命中的元素也补上遮罩', async () => {
    document.body.innerHTML = '<div id="x"></div>';
    const layer = newLayer();
    layer.show(['.promo']);
    document.getElementById('x')!.className = 'promo';
    await settle();
    expect(boxes()).toHaveLength(1);
    layer.clear();
  });

  it('不遮插件自己的界面', () => {
    document.body.innerHTML = `<${HOST_TAGS.toggle}><div class="ad"></div></${HOST_TAGS.toggle}><div class="ad"></div>`;
    const layer = newLayer();
    layer.show(['.ad']);
    expect(boxes()).toHaveLength(1);
    layer.clear();
  });

  it('遮罩颜色取最近的不透明祖先背景色', () => {
    document.body.innerHTML = '<section style="background-color: rgb(30, 30, 30)"><div><a class="ad">x</a></div></section>';
    const layer = newLayer();
    layer.show(['.ad']);
    const box = boxes()[0] as HTMLElement;
    expect(box.style.background).toBe('rgb(30, 30, 30)');
    expect(box.style.pointerEvents).toBe('auto');
    layer.clear();
  });

  it('遮罩上的点击、指针事件不会传到页面', () => {
    document.body.innerHTML = '<a class="ad" href="#x">x</a>';
    const layer = newLayer();
    layer.show(['.ad']);
    const seen: string[] = [];
    for (const t of ['click', 'pointerdown', 'mousedown', 'mouseup', 'auxclick']) {
      document.addEventListener(t, () => seen.push(t));
    }
    const box = boxes()[0] as HTMLElement;
    for (const t of ['click', 'pointerdown', 'mousedown', 'mouseup', 'auxclick']) {
      box.dispatchEvent(new MouseEvent(t, { bubbles: true, composed: true }));
    }
    expect(seen).toEqual([]);
    layer.clear();
  });

  it('clear() 后撤下宿主、不再观察 DOM：再插入命中元素也不会出现遮罩', async () => {
    document.body.innerHTML = '<div class="ad"></div>';
    const layer = newLayer();
    layer.show(['.ad']);
    layer.clear();
    expect(document.querySelector(HOST_TAGS.mask)).toBeNull();
    document.body.appendChild(Object.assign(document.createElement('div'), { className: 'ad' }));
    await settle();
    expect(document.querySelector(HOST_TAGS.mask)).toBeNull();
  });

  it('没有选择器时什么都不挂（不创建宿主、不观察）', async () => {
    const layer = newLayer();
    layer.show([]);
    document.body.appendChild(Object.assign(document.createElement('div'), { className: 'ad' }));
    await settle();
    expect(document.querySelector(HOST_TAGS.mask)).toBeNull();
    expect(layer.observing).toBe(false);
  });

  it('非法选择器跳过，不影响其他选择器', () => {
    document.body.innerHTML = '<div class="ad"></div>';
    const layer = newLayer();
    layer.show(['::bad(', '.ad']);
    expect(boxes()).toHaveLength(1);
    expect(layer.observing).toBe(true);
    layer.clear();
    expect(layer.observing).toBe(false);
  });
});
