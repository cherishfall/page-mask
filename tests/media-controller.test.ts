/** 整页灰度下内容脚本只剩一件事（0.8.18，#156）：视频自动播放压制与点击放行。
 *  媒体层不写任何声音状态（ADR-0013），也不再认识任何 DOM 元素（打标/豁免随媒体路线退场）。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMediaController } from '../ui/media-controller';

// jsdom 没有实现媒体播放，替换成可观察的空实现；paused 恒 false 让「按停」路径每次都走到
const pause = vi.fn();
Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: pause });
Object.defineProperty(HTMLMediaElement.prototype, 'paused', { configurable: true, get: () => false });

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

function play(video: HTMLVideoElement): void {
  video.dispatchEvent(new Event('play', { bubbles: false }));
}

beforeEach(() => {
  document.body.innerHTML = '';
  pause.mockClear();
  vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
});

afterEach(() => {
  vi.mocked(Date.now).mockRestore();
});

describe('自动播放压制与点击放行（0.8.0 建立压制；0.8.18 起是媒体层唯一职责）', () => {
  it('站点自己触发的 play 被按停；用户点击视频区域后放行（synthetic play 不再被按停）', () => {
    const controller = createMediaController(document);
    controller.sync({ mediaGray: true });
    const vid = mountVideo();
    play(vid);
    expect(pause).toHaveBeenCalled();
    // 用户点播放器区域（video 的三层祖先以内）→ 10 秒窗口内放行
    tap(vid.parentElement!.parentElement!);
    play(vid);
    expect(pause).toHaveBeenCalledTimes(1); // 放行后不再按停
    controller.dispose();
  });

  it('点击放行按文档生命周期记忆：同一视频之后随便播', () => {
    const controller = createMediaController(document);
    controller.sync({ mediaGray: true });
    const vid = mountVideo();
    tap(vid.parentElement!.parentElement!);
    play(vid);
    play(vid);
    play(vid);
    expect(pause).not.toHaveBeenCalled();
    controller.dispose();
  });

  it('10 秒窗口外的点击不放行', () => {
    const controller = createMediaController(document);
    controller.sync({ mediaGray: true });
    const vid = mountVideo();
    tap(vid.parentElement!.parentElement!);
    vi.mocked(Date.now).mockReturnValue(1_000_000 + 10_001);
    play(vid);
    expect(pause).toHaveBeenCalled();
    controller.dispose();
  });

  it('键盘 Enter / 空格算用户意图（WCAG 2.1.1）；其余按键不记账', () => {
    const controller = createMediaController(document);
    controller.sync({ mediaGray: true });
    const vid = mountVideo();
    vid.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    play(vid);
    expect(pause).not.toHaveBeenCalled();
    controller.dispose();
  });

  it('点我们自己的界面不算「想看视频」：胶囊上的按下不给浅层视频背书', () => {
    const controller = createMediaController(document);
    controller.sync({ mediaGray: true });
    const vid = mountVideo();
    const ownHost = document.createElement('pagemask-toggle');
    const ownBtn = document.createElement('button');
    ownHost.appendChild(ownBtn);
    document.body.appendChild(ownHost);
    tap(ownBtn);
    play(vid);
    expect(pause).toHaveBeenCalled();
    controller.dispose();
  });

  it('开关打开的这一刻：已在播放的视频当场按停（压制对存量视频生效）', () => {
    const playing = addVideo();
    const controller = createMediaController(document);
    controller.sync({ mediaGray: true });
    expect(pause).toHaveBeenCalledWith(); // applyVideo(playing) → pause()
    expect(pause).toHaveBeenCalledTimes(1);
    controller.dispose();
  });

  it('关掉：不再压制（正在播的让它继续播，不替网站恢复播放）', () => {
    const controller = createMediaController(document);
    controller.sync({ mediaGray: true });
    controller.sync({ mediaGray: false });
    pause.mockClear();
    const vid = mountVideo();
    play(vid);
    expect(pause).not.toHaveBeenCalled();
    controller.dispose();
  });

  it('幂等：重复 sync 不重复挂监听（同一 play 只压一次）', () => {
    const controller = createMediaController(document);
    controller.sync({ mediaGray: true });
    controller.sync({ mediaGray: true });
    const vid = mountVideo();
    play(vid);
    expect(pause).toHaveBeenCalledTimes(1);
    controller.dispose();
  });
});
