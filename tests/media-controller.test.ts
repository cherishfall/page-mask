/** 0.8.0 内容脚本侧：小图豁免、自动播放压制与点击放行。媒体层不写任何声音状态（ADR-0013）。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MEDIA_KEEP_ATTR } from '../core/media';
import { createMediaController } from '../ui/media-controller';

// jsdom 没有实现媒体播放，替换成可观察的空实现；paused 恒 false 让「按停」路径每次都走到
const pause = vi.fn();
Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: pause });
Object.defineProperty(HTMLMediaElement.prototype, 'paused', { configurable: true, get: () => false });

/** jsdom 没有布局：手动给出渲染尺寸，模拟真实浏览器里已经排好版的图片 */
function rect(w: number, h: number): DOMRect {
  return { width: w, height: h, x: 0, y: 0, top: 0, left: 0, right: w, bottom: h, toJSON: () => ({}) } as DOMRect;
}

function addImg(w: number, h: number, attrs: Record<string, string> = {}): HTMLImageElement {
  const el = document.createElement('img');
  el.setAttribute('width', String(w));
  el.setAttribute('height', String(h));
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.getBoundingClientRect = () => rect(w, h);
  document.body.appendChild(el);
  return el;
}

function addVideo(): HTMLVideoElement {
  const el = document.createElement('video');
  document.body.appendChild(el);
  return el;
}

/**
 * 按真实信息流的嵌套深度挂一个视频（section > div > div > video）：
 * 放行判定向上找三层祖先，真实站点的视频都埋在多层容器里——裸挂在 body 下时
 * 三层就到 body，任何点击都会被当成「点在播放器里」，那不是真实形态。
 */
function mountVideo(): HTMLVideoElement {
  const section = document.createElement('section');
  const outer = document.createElement('div');
  const inner = document.createElement('div');
  const el = document.createElement('video');
  section.appendChild(outer);
  outer.appendChild(inner);
  inner.appendChild(el);
  document.body.appendChild(section);
  return el;
}

/** 模拟用户在某个元素上按下（pointerdown 走 document 捕获，jsdom 用 Event 冒泡到 document 即可） */
function tap(el: Element, type: 'pointerdown' | 'keydown' = 'pointerdown'): void {
  el.dispatchEvent(new Event(type, { bubbles: true }));
}

beforeEach(() => {
  document.body.innerHTML = '';
  pause.mockClear();
  vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
  // jsdom 默认不跑 rAF：用 setTimeout 让增量扫描在测试里也能推进
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number);
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
});

afterEach(() => {
  vi.mocked(Date.now).mockRestore();
  vi.unstubAllGlobals();
});

describe('小图豁免（#116 起）', () => {
  it('只给 ≤32px 的图打放行标记，大图不动', () => {
    const icon = addImg(16, 16);
    const photo = addImg(900, 600);
    const c = createMediaController(document);
    c.sync({ mediaGray: true });
    expect(icon.hasAttribute(MEDIA_KEEP_ATTR)).toBe(true);
    expect(photo.hasAttribute(MEDIA_KEEP_ATTR)).toBe(false);
    c.dispose();
  });

  it('class / alt 里带 emoji 的图也放行', () => {
    const emoji = addImg(400, 400, { class: 'Emoji', alt: 'grinning face' });
    const c = createMediaController(document);
    c.sync({ mediaGray: true });
    expect(emoji.hasAttribute(MEDIA_KEEP_ATTR)).toBe(true);
    c.dispose();
  });

  it('无限滚动后新插入的小图也会补上标记', async () => {
    const c = createMediaController(document);
    c.sync({ mediaGray: true });
    const late = addImg(24, 24);
    expect(late.hasAttribute(MEDIA_KEEP_ATTR)).toBe(false);
    await vi.waitFor(() => expect(late.hasAttribute(MEDIA_KEEP_ATTR)).toBe(true), { timeout: 500, interval: 5 });
    c.dispose();
  });

  it('属性写着 16×16、被 CSS 放大的图不算小图标（#126：渲染尺寸优先）', () => {
    const enlarged = addImg(16, 16);
    enlarged.getBoundingClientRect = () => rect(600, 340);
    const c = createMediaController(document);
    c.sync({ mediaGray: true });
    expect(enlarged.hasAttribute(MEDIA_KEEP_ATTR), '不能被属性尺寸短路放行').toBe(false);
    c.dispose();
  });

  it('大图被 CSS 缩小到图标大小：仍按它实际占的地方放行', () => {
    const shrunk = addImg(900, 600);
    shrunk.getBoundingClientRect = () => rect(16, 16);
    const c = createMediaController(document);
    c.sync({ mediaGray: true });
    expect(shrunk.hasAttribute(MEDIA_KEEP_ATTR)).toBe(true);
    c.dispose();
  });

  it('还没布局（rect=0）：属性小也先灰一帧，加载后按真实尺寸补上标记（#128）', async () => {
    const icon = addImg(16, 16);
    icon.getBoundingClientRect = () => rect(0, 0);
    const c = createMediaController(document);
    c.sync({ mediaGray: true });
    expect(icon.hasAttribute(MEDIA_KEEP_ATTR), '不能回退到属性尺寸就放行').toBe(false);

    icon.getBoundingClientRect = () => rect(16, 16);
    icon.dispatchEvent(new Event('load'));
    await vi.waitFor(() => expect(icon.hasAttribute(MEDIA_KEEP_ATTR)).toBe(true), { timeout: 500, interval: 5 });
    c.dispose();
  });

  it('改 class / style 把隐藏的图显示成大图：重新判定，不沿用旧的放行标记（#128）', async () => {
    const icon = addImg(16, 16);
    const c = createMediaController(document);
    c.sync({ mediaGray: true });
    expect(icon.hasAttribute(MEDIA_KEEP_ATTR)).toBe(true);

    icon.getBoundingClientRect = () => rect(600, 340);
    icon.setAttribute('class', 'hero-image');
    await vi.waitFor(() => expect(icon.hasAttribute(MEDIA_KEEP_ATTR)).toBe(false), { timeout: 500, interval: 5 });
    c.dispose();
  });

  it('关掉开关 / 收尾时把标记清干净，不给页面留垃圾属性', () => {
    const icon = addImg(16, 16);
    const c = createMediaController(document);
    c.sync({ mediaGray: true });
    expect(icon.hasAttribute(MEDIA_KEEP_ATTR)).toBe(true);
    c.sync({});
    expect(icon.hasAttribute(MEDIA_KEEP_ATTR)).toBe(false);

    c.sync({ mediaGray: true });
    c.dispose();
    expect(icon.hasAttribute(MEDIA_KEEP_ATTR)).toBe(false);
  });
});

describe('自动播放压制与点击放行（0.8.0，ADR-0013）', () => {
  it('开启后立刻按停播放中的视频；声音状态一个字都不碰', () => {
    const video = addVideo();
    video.muted = true; // 网站自己的静音状态
    const c = createMediaController(document);
    c.sync({ mediaGray: true });
    expect(pause).toHaveBeenCalled();
    expect(video.muted).toBe(true); // 不写 muted：音量归播放器与用户
    c.dispose();
  });

  it('网站脚本再调 play 也被压住（捕获阶段拦 play 事件）', () => {
    const video = addVideo();
    const c = createMediaController(document);
    c.sync({ mediaGray: true });
    pause.mockClear();
    video.dispatchEvent(new Event('play'));
    expect(pause).toHaveBeenCalled();
    c.dispose();
  });

  it('点了视频本身再 play：放行这一个视频，之后随便播', () => {
    const video = mountVideo();
    const other = mountVideo();
    const c = createMediaController(document);
    c.sync({ mediaGray: true });
    pause.mockClear();
    tap(video);
    video.dispatchEvent(new Event('play'));
    expect(pause, '用户主动看的视频不压').not.toHaveBeenCalled();
    other.dispatchEvent(new Event('play'));
    expect(pause, '没点过的视频照旧压制').toHaveBeenCalled();
    c.dispose();
  });

  it('点的是播放器覆盖层（视频的兄弟节点、同一容器）：也算放行（X 的播放钮长这样）', () => {
    const video = addVideo();
    const overlay = document.createElement('button');
    const box = document.createElement('div');
    box.append(video, overlay);
    document.body.appendChild(box);
    const c = createMediaController(document);
    c.sync({ mediaGray: true });
    pause.mockClear();
    tap(overlay);
    video.dispatchEvent(new Event('play'));
    expect(pause, '点播放钮 = 想看这个视频').not.toHaveBeenCalled();
    c.dispose();
  });

  it('键盘 Enter / 空格也算意图（WCAG 2.1.1）；别的按键不算', () => {
    const video = mountVideo();
    const c = createMediaController(document);
    c.sync({ mediaGray: true });
    pause.mockClear();
    video.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    video.dispatchEvent(new Event('play'));
    expect(pause).not.toHaveBeenCalled();

    const video2 = mountVideo();
    video2.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    video2.dispatchEvent(new Event('play'));
    expect(pause, '无关按键不构成放行').toHaveBeenCalled();
    c.dispose();
  });

  it('点击太久之前（窗口外）不放行：旧点击不能给后来的自动播放背书', () => {
    const video = addVideo();
    const c = createMediaController(document);
    c.sync({ mediaGray: true });
    pause.mockClear();
    tap(video);
    vi.mocked(Date.now).mockReturnValue(1_000_000 + 11_000); // 超过 10 秒窗口
    video.dispatchEvent(new Event('play'));
    expect(pause).toHaveBeenCalled();
    c.dispose();
  });

  it('点了别处（不在视频区域）不放行', () => {
    const video = mountVideo();
    const header = document.createElement('header');
    const far = document.createElement('button');
    header.appendChild(far);
    document.body.appendChild(header);
    const c = createMediaController(document);
    c.sync({ mediaGray: true });
    pause.mockClear();
    tap(far);
    video.dispatchEvent(new Event('play'));
    expect(pause).toHaveBeenCalled();
    c.dispose();
  });

  it('关掉再开：放行集合清空，自动播放重新被压；muted 全程没人动', () => {
    const video = addVideo();
    video.muted = true;
    const c = createMediaController(document);
    c.sync({ mediaGray: true });
    tap(video);
    video.dispatchEvent(new Event('play'));
    c.sync({});
    c.sync({ mediaGray: true });
    pause.mockClear();
    video.dispatchEvent(new Event('play'));
    expect(pause, '新一轮重新压制（放行是文档内的一次性授权，开关重开即作废）').toHaveBeenCalled();
    expect(video.muted).toBe(true);
    c.dispose();
  });

  it('视频被页面移除又插回：再自动播放仍被压住（没有声音账目要还原，#126 场景的新语义）', async () => {
    const video = addVideo();
    const c = createMediaController(document);
    c.sync({ mediaGray: true });
    pause.mockClear();

    video.remove(); // 信息流 / 轮播把这一格换掉
    await new Promise((r) => setTimeout(r, 30));
    document.body.appendChild(video); // 网站又把同一个元素插回来
    video.dispatchEvent(new Event('play'));
    expect(pause, '没有意图的播放照旧按停').toHaveBeenCalled();
    c.dispose();
  });

  it('同一个视频在页面里挪位置：不影响压制与放行状态（#129 场景的新语义）', async () => {
    const video = mountVideo();
    const c = createMediaController(document);
    c.sync({ mediaGray: true });
    pause.mockClear(); // 开启瞬间会按停播放中的视频，这里只看放行之后的事
    tap(video);
    video.dispatchEvent(new Event('play'));
    expect(pause).not.toHaveBeenCalled();

    // appendChild 一个已在文档里的节点：既有 removed 也有 added 记录（jsdom 会拆成两条）
    pause.mockClear();
    document.body.appendChild(video);
    await new Promise((r) => setTimeout(r, 30));
    video.dispatchEvent(new Event('play'));
    expect(pause, '放行状态不因挪位置丢失').not.toHaveBeenCalled();
    c.dispose();
  });

  it('dispose 后不再监听任何事件', () => {
    const video = addVideo();
    const c = createMediaController(document);
    c.sync({ mediaGray: true });
    c.dispose();
    pause.mockClear();
    video.dispatchEvent(new Event('play'));
    expect(pause).not.toHaveBeenCalled();
  });

  it('没开开关时零监听：play / pointerdown 都不碰', () => {
    const video = addVideo();
    const c = createMediaController(document);
    c.sync({});
    pause.mockClear();
    video.dispatchEvent(new Event('play'));
    expect(pause).not.toHaveBeenCalled();
    c.dispose();
  });
});
