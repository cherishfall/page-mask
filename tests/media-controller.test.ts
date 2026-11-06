/** #116 内容脚本侧：小图豁免、视频停播与静音、开关关掉后的还原。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MEDIA_KEEP_ATTR } from '../core/media';
import { createMediaController } from '../ui/media-controller';

// jsdom 没有实现媒体播放，替换成可观察的空实现；paused 恒 false 让停播路径每次都走到
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

function addVideo(muted = false): HTMLVideoElement {
  const el = document.createElement('video');
  el.muted = muted;
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  document.body.innerHTML = '';
  pause.mockClear();
  // jsdom 默认不跑 rAF：用 setTimeout 让增量扫描在测试里也能推进
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number);
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
});

afterEach(() => vi.unstubAllGlobals());

describe('小图豁免（#116）', () => {
  it('只给 ≤32px 的图打放行标记，大图不动', () => {
    const icon = addImg(16, 16);
    const photo = addImg(900, 600);
    const c = createMediaController(document);
    c.sync({ hideImages: true });
    expect(icon.hasAttribute(MEDIA_KEEP_ATTR)).toBe(true);
    expect(photo.hasAttribute(MEDIA_KEEP_ATTR)).toBe(false);
    c.dispose();
  });

  it('class / alt 里带 emoji 的图也放行', () => {
    const emoji = addImg(400, 400, { class: 'Emoji', alt: 'grinning face' });
    const c = createMediaController(document);
    c.sync({ hideImages: true });
    expect(emoji.hasAttribute(MEDIA_KEEP_ATTR)).toBe(true);
    c.dispose();
  });

  it('无限滚动后新插入的小图也会补上标记', async () => {
    const c = createMediaController(document);
    c.sync({ hideImages: true });
    const late = addImg(24, 24);
    expect(late.hasAttribute(MEDIA_KEEP_ATTR)).toBe(false);
    await vi.waitFor(() => expect(late.hasAttribute(MEDIA_KEEP_ATTR)).toBe(true), { timeout: 500, interval: 5 });
    c.dispose();
  });

  it('属性写着 16×16、被 CSS 放大的图不算小图标（#126：渲染尺寸优先）', () => {
    const enlarged = addImg(16, 16);
    enlarged.getBoundingClientRect = () => rect(600, 340);
    const c = createMediaController(document);
    c.sync({ hideImages: true });
    expect(enlarged.hasAttribute(MEDIA_KEEP_ATTR), '不能被属性尺寸短路放行').toBe(false);
    c.dispose();
  });

  it('大图被 CSS 缩小到图标大小：仍按它实际占的地方放行', () => {
    const shrunk = addImg(900, 600);
    shrunk.getBoundingClientRect = () => rect(16, 16);
    const c = createMediaController(document);
    c.sync({ hideImages: true });
    expect(shrunk.hasAttribute(MEDIA_KEEP_ATTR)).toBe(true);
    c.dispose();
  });

  it('还没布局（rect=0）：属性小也先灰一帧，加载后按真实尺寸补上标记（#128）', async () => {
    const icon = addImg(16, 16);
    icon.getBoundingClientRect = () => rect(0, 0);
    const c = createMediaController(document);
    c.sync({ hideImages: true });
    expect(icon.hasAttribute(MEDIA_KEEP_ATTR), '不能回退到属性尺寸就放行').toBe(false);

    icon.getBoundingClientRect = () => rect(16, 16);
    icon.dispatchEvent(new Event('load'));
    await vi.waitFor(() => expect(icon.hasAttribute(MEDIA_KEEP_ATTR)).toBe(true), { timeout: 500, interval: 5 });
    c.dispose();
  });

  it('改 class / style 把隐藏的图显示成大图：重新判定，不沿用旧的放行标记（#128）', async () => {
    const icon = addImg(16, 16);
    const c = createMediaController(document);
    c.sync({ hideImages: true });
    expect(icon.hasAttribute(MEDIA_KEEP_ATTR)).toBe(true);

    icon.getBoundingClientRect = () => rect(600, 340);
    icon.setAttribute('class', 'hero-image');
    await vi.waitFor(() => expect(icon.hasAttribute(MEDIA_KEEP_ATTR)).toBe(false), { timeout: 500, interval: 5 });
    c.dispose();
  });

  it('只关「收起图片」、保留「收起视频」：豁免标记也要清掉（#126）', () => {
    const icon = addImg(16, 16);
    const video = addVideo(false);
    const c = createMediaController(document);
    c.sync({ hideImages: true, hideVideos: true });
    expect(icon.hasAttribute(MEDIA_KEEP_ATTR)).toBe(true);

    c.sync({ hideVideos: true });
    expect(icon.hasAttribute(MEDIA_KEEP_ATTR), 'observer 还在，但标记不能留在页面上').toBe(false);
    expect(video.muted, '视频开关没动，仍在生效').toBe(true);

    c.sync({});
    expect(video.muted).toBe(false);
    c.dispose();
  });

  it('关掉开关 / 收尾时把标记清干净，不给页面留垃圾属性', () => {
    const icon = addImg(16, 16);
    const c = createMediaController(document);
    c.sync({ hideImages: true });
    expect(icon.hasAttribute(MEDIA_KEEP_ATTR)).toBe(true);
    c.sync({});
    expect(icon.hasAttribute(MEDIA_KEEP_ATTR)).toBe(false);

    c.sync({ hideImages: true });
    c.dispose();
    expect(icon.hasAttribute(MEDIA_KEEP_ATTR)).toBe(false);
  });

  it('没开「收起图片」时不挂标记，也不碰页面上的图', () => {
    const icon = addImg(16, 16);
    const c = createMediaController(document);
    c.sync({ hideVideos: true });
    expect(icon.hasAttribute(MEDIA_KEEP_ATTR)).toBe(false);
    c.dispose();
  });
});

describe('视频停播与静音（#116）', () => {
  it('开启后立刻停播 + 静音；关掉后把原来的静音状态放回去', () => {
    const video = addVideo(false);
    const c = createMediaController(document);
    c.sync({ hideVideos: true });
    expect(video.muted).toBe(true);
    expect(pause).toHaveBeenCalled();
    c.sync({});
    expect(video.muted).toBe(false);
    c.dispose();
  });

  it('网站本来就静音的视频，关掉后仍是静音（不替网站打开声音）', () => {
    const video = addVideo(true);
    const c = createMediaController(document);
    c.sync({ hideVideos: true });
    c.sync({});
    expect(video.muted).toBe(true);
    c.dispose();
  });

  it('反复开关：每一轮关掉都能还原（原值记录不能残留，E2E 抓到的回归）', () => {
    const video = addVideo(false);
    const c = createMediaController(document);
    for (let i = 1; i <= 3; i++) {
      c.sync({ hideVideos: true });
      expect(video.muted, `第 ${i} 轮开启`).toBe(true);
      c.sync({});
      expect(video.muted, `第 ${i} 轮关掉`).toBe(false);
    }
    c.dispose();
  });

  it('两轮之间网站自己改了静音状态：还原到这一轮开始时的值', () => {
    const video = addVideo(false);
    const c = createMediaController(document);
    c.sync({ hideVideos: true });
    c.sync({});
    video.muted = true; // 网站脚本自己把声音关了
    c.sync({ hideVideos: true });
    c.sync({});
    expect(video.muted).toBe(true); // 不硬置 false，也不沿用上一轮的原值
    c.dispose();
  });

  it('网站脚本再调 play 也被压住（捕获阶段拦 play 事件）', () => {
    const video = addVideo(false);
    const c = createMediaController(document);
    c.sync({ hideVideos: true });
    pause.mockClear();
    video.dispatchEvent(new Event('play'));
    expect(pause).toHaveBeenCalled();
    expect(video.muted).toBe(true);
    c.dispose();
  });

  it('视频被页面移除又插回：一轮一清，不在已替换的元素上留下哑状态（#126）', async () => {
    const video = addVideo(false);
    const c = createMediaController(document);
    c.sync({ hideVideos: true });
    expect(video.muted).toBe(true);

    video.remove(); // 信息流 / 轮播把这一格换掉
    await vi.waitFor(() => expect(video.muted, '移出文档时按原值还原').toBe(false), { timeout: 500, interval: 5 });

    document.body.appendChild(video); // 网站又把同一个元素插回来
    await vi.waitFor(() => expect(video.muted, '重新插入后按新的一轮重新压住').toBe(true), { timeout: 500, interval: 5 });

    c.sync({});
    expect(video.muted, '关开关仍能还原到这一轮开始时的值').toBe(false);
    c.dispose();
  });

  it('同一个视频在页面里挪位置：静音不闪断，关开关仍能还原（#129）', async () => {
    const video = addVideo(false);
    const c = createMediaController(document);
    c.sync({ hideVideos: true });
    expect(video.muted).toBe(true);

    // 盯住 muted 的赋值：移动不是移除，中途不该出现「先还原、下一帧再压回去」这一下
    let value = video.muted;
    let unMuted = 0;
    Object.defineProperty(video, 'muted', {
      configurable: true,
      get: () => value,
      set: (next: boolean) => {
        if (value && !next) unMuted += 1;
        value = next;
      },
    });

    // appendChild 一个已在文档里的节点：既有 removed 也有 added 记录（浏览器常合成一条，
    // jsdom 会拆成两条），两种排法都不许把它当成真移除
    document.body.appendChild(video);
    await new Promise((r) => setTimeout(r, 30));
    expect(video.muted, '移动后仍然是被压住的状态').toBe(true);
    expect(unMuted, '移动不等于移除，不该把静音还原一帧').toBe(0);

    c.sync({});
    expect(video.muted, '关开关仍能还原到这一轮开始时的值').toBe(false);
    c.dispose();
  });

  it('dispose 会还原静音并停止后续监听', () => {
    const video = addVideo(false);
    const c = createMediaController(document);
    c.sync({ hideVideos: true });
    c.dispose();
    expect(video.muted).toBe(false);
    pause.mockClear();
    video.dispatchEvent(new Event('play'));
    expect(pause).not.toHaveBeenCalled();
  });
});
