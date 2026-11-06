/** #116 内容脚本侧：小图豁免、视频停播与静音、开关关掉后的还原。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MEDIA_KEEP_ATTR } from '../core/media';
import { createMediaController } from '../ui/media-controller';

// jsdom 没有实现媒体播放，替换成可观察的空实现；paused 恒 false 让停播路径每次都走到
const pause = vi.fn();
Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: pause });
Object.defineProperty(HTMLMediaElement.prototype, 'paused', { configurable: true, get: () => false });

function addImg(w: number, h: number, attrs: Record<string, string> = {}): HTMLImageElement {
  const el = document.createElement('img');
  el.setAttribute('width', String(w));
  el.setAttribute('height', String(h));
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
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
