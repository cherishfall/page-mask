import { beforeEach, describe, expect, it, vi } from 'vitest';
// @ts-ignore 项目不装 @types/node；vitest 跑在 Node 里，node:zlib 可用
import { inflateSync } from 'node:zlib';
import { TitleFaviconGuard } from './disguise';
import { TRANSPARENT_PNG } from './icon';

/**
 * 最小 PNG 解码：只支持本项目默认图标用到的 8 位 RGBA、非隔行格式。
 * 拼接全部 IDAT → zlib 解压 → 按行去掉 filter（仅图标用到的 None/Sub/Up）→ RGBA 像素。
 */
function decodeRgbaPng(dataUrl: string): { width: number; height: number; pixels: Uint8Array } {
  const bin = atob(dataUrl.replace(/^data:image\/png;base64,/, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  expect(Array.from(bytes.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  let width = 0;
  let height = 0;
  const idat: number[] = [];
  for (let off = 8; off < bytes.length; ) {
    const len = view.getUint32(off);
    const type = String.fromCharCode(...bytes.slice(off + 4, off + 8));
    const data = bytes.slice(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = view.getUint32(off + 8);
      height = view.getUint32(off + 12);
      expect([data[8], data[9], data[12]]).toEqual([8, 6, 0]); // 8 位深、RGBA、非隔行
    } else if (type === 'IDAT') idat.push(...data);
    off += 12 + len;
  }
  const raw = new Uint8Array(inflateSync(Uint8Array.from(idat)));
  const stride = width * 4;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x]!;
      const left = x >= 4 ? pixels[y * stride + x - 4]! : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x]! : 0;
      if (filter === 0) pixels[y * stride + x] = v;
      else if (filter === 1) pixels[y * stride + x] = (v + left) & 255;
      else if (filter === 2) pixels[y * stride + x] = (v + up) & 255;
      else throw new Error(`测试解码器不支持 PNG filter ${filter}`);
    }
  }
  return { width, height, pixels };
}

describe('默认图标 TRANSPARENT_PNG', () => {
  it('解码后每个像素 alpha=0（真正全透明，不是半透明色块）', () => {
    const { width, height, pixels } = decodeRgbaPng(TRANSPARENT_PNG);
    expect(width * height).toBeGreaterThan(0);
    expect(pixels).toHaveLength(width * height * 4);
    for (let i = 3; i < pixels.length; i += 4) expect(pixels[i]).toBe(0);
  });
});

/** 可推进的假时钟：定时器按到期顺序执行，每次执行后清空微任务（MutationObserver 回调在这里面） */
function createClock() {
  let now = 0;
  let seq = 0;
  const timers: { at: number; fn: () => void; id: number; cancelled: boolean }[] = [];
  const flush = () => new Promise<void>((r) => setTimeout(r, 0));
  return {
    now: () => now,
    setTimer: (fn: () => void, ms: number) => {
      const timer = { at: now + ms, fn, id: ++seq, cancelled: false };
      timers.push(timer);
      return () => {
        timer.cancelled = true;
      };
    },
    /** 推进假时钟；期间到期的定时器逐个执行，并等微任务（观察器）跑完再继续 */
    async advance(ms: number) {
      await flush(); // 先把当前这一拍里站点写入引发的观察器回调跑完（补刀排期在这里产生）
      const target = now + ms;
      for (;;) {
        timers.sort((a, b) => a.at - b.at || a.id - b.id);
        const next = timers.find((t) => !t.cancelled && t.at <= target);
        if (!next) break;
        timers.splice(timers.indexOf(next), 1);
        now = next.at;
        next.fn();
        await flush();
      }
      now = target;
      await flush();
    },
  };
}

/** 模拟真实 SPA 的标题守卫：一发现标题不是自己的就立刻改回（每轮都反抗，永不放弃） */
function watchTitle(doc: Document, siteTitle: string): MutationObserver {
  const guard = new MutationObserver(() => {
    if (doc.title !== siteTitle) doc.title = siteTitle;
  });
  guard.observe(doc.head, { childList: true, subtree: true, characterData: true });
  return guard;
}

const ICONS = 'link[rel~="icon"]';

describe('TitleFaviconGuard（jsdom）', () => {
  let doc: Document;

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument('原站点标题');
    const link = doc.createElement('link');
    link.rel = 'icon';
    link.href = 'https://site.com/favicon.ico';
    doc.head.appendChild(link);
  });

  it('伪装：标题改写、站点图标被替换为一张', () => {
    const guard = new TitleFaviconGuard(doc);
    guard.apply('新建标签页', null);
    expect(doc.title).toBe('新建标签页');
    const icons = doc.querySelectorAll('link[rel~="icon"]');
    expect(icons).toHaveLength(1);
    expect(icons[0]?.getAttribute('href')).toMatch(/^data:image\/png/);
  });

  it('自动补刀：站点改回标题时被压回', async () => {
    const guard = new TitleFaviconGuard(doc);
    guard.apply('新建标签页', null);
    doc.title = '微信读书-电子书';
    await vi.waitFor(() => {
      expect(doc.title).toBe('新建标签页');
    });
  });

  it('原样态：标题与图标完全还原', () => {
    const guard = new TitleFaviconGuard(doc);
    guard.apply('新建标签页', null);
    guard.restore();
    expect(doc.title).toBe('原站点标题');
    const icons = doc.querySelectorAll('link[rel~="icon"]');
    expect(icons).toHaveLength(1);
    expect(icons[0]?.getAttribute('href')).toBe('https://site.com/favicon.ico');
  });

  it('伪装参数更新（改伪装标题）', () => {
    const guard = new TitleFaviconGuard(doc);
    guard.apply('新建标签页', null);
    guard.update('公司Wiki', null);
    expect(doc.title).toBe('公司Wiki');
  });

  it('document_start：head 还没解析出来时不抛错；head 与站点标题/图标出现后立即压住，还原时回到站点的', async () => {
    const early = document.implementation.createHTMLDocument('');
    early.documentElement.replaceChildren(); // 解析刚开始：只有 <html>，没有 <head>
    const guard = new TitleFaviconGuard(early);

    expect(() => guard.apply('新建标签页', null)).not.toThrow();

    // 模拟解析器随后插入 <head><title>站点标题</title><link rel=icon></head>
    const head = early.createElement('head');
    const title = early.createElement('title');
    title.textContent = '站点标题';
    const siteIcon = early.createElement('link');
    siteIcon.rel = 'icon';
    siteIcon.href = 'https://site.com/favicon.ico';
    head.append(title, siteIcon);
    early.documentElement.appendChild(head);

    await vi.waitFor(() => {
      expect(early.title).toBe('新建标签页');
      const icons = early.querySelectorAll('link[rel~="icon"]');
      expect(icons).toHaveLength(1);
      expect(icons[0]?.getAttribute('href')).toMatch(/^data:image\/png/);
      expect(icons[0]?.parentElement).toBe(early.head);
    });

    guard.restore();
    expect(early.title).toBe('站点标题');
    expect(Array.from(early.querySelectorAll('link[rel~="icon"]')).map((l) => l.getAttribute('href'))).toEqual([
      'https://site.com/favicon.ico',
    ]);
  });

  it('只观察 <head>（外加 <html> 的直接子节点，用来发现 head 出现 / 被替换），不观察整页 subtree', () => {
    const spy = vi.spyOn(MutationObserver.prototype, 'observe');
    const guard = new TitleFaviconGuard(doc);
    guard.apply('t', null);
    const calls = spy.mock.calls.map(([target, opts]) => ({ target, opts }));
    spy.mockRestore();
    expect(calls.length).toBeGreaterThan(0);
    for (const { target, opts } of calls) {
      if (target === doc.head) continue;
      expect(target).toBe(doc.documentElement);
      expect(opts).toEqual({ childList: true });
    }
    expect(calls.some((c) => c.target === doc.head)).toBe(true);
    guard.restore();
  });

  it('正文里的大量变化不会让守卫重写标题', async () => {
    const guard = new TitleFaviconGuard(doc);
    guard.apply('t', null);
    const setter = vi.spyOn(doc, 'title', 'set');
    for (let i = 0; i < 20; i++) doc.body.appendChild(doc.createElement('p'));
    await new Promise((r) => setTimeout(r, 0));
    expect(setter).not.toHaveBeenCalled();
    setter.mockRestore();
    guard.restore();
  });

  it('SPA 翻页：伪装期间站点写入的最新标题，在还原时生效', async () => {
    const guard = new TitleFaviconGuard(doc);
    guard.apply('阅读', null);
    doc.title = '第 2 章';
    await vi.waitFor(() => expect(doc.title).toBe('阅读'));
    doc.title = '第 3 章';
    await vi.waitFor(() => expect(doc.title).toBe('阅读'));
    guard.restore();
    expect(doc.title).toBe('第 3 章');
  });

  it('补刀限频：站点自己的守卫与我们来回抢时，一秒内补刀次数有上限，且同一拍只安排一次补刀', async () => {
    let now = 0;
    const timers: (() => void)[] = [];
    const guard = new TitleFaviconGuard(doc, {
      maxForcesPerSecond: 5,
      now: () => now,
      setTimer: (fn) => {
        timers.push(fn);
        return () => undefined;
      },
    });
    guard.apply('阅读', null);
    const setter = vi.spyOn(doc, 'title', 'set');
    // 站点的守卫：每次被改都立即改回自己的标题
    const siteGuard = new MutationObserver(() => {
      if (doc.title !== '站点') doc.title = '站点';
    });
    siteGuard.observe(doc.head, { childList: true, subtree: true, characterData: true });
    doc.title = '站点';
    await new Promise((r) => setTimeout(r, 20));
    siteGuard.disconnect();
    const ours = setter.mock.calls.filter(([v]) => v === '阅读').length;
    expect(ours).toBeLessThanOrEqual(5);
    expect(timers.length).toBe(1); // 同一拍只安排一次补刀

    now += 16; // 合并窗口到期
    timers[0]!();
    expect(doc.title).toBe('阅读');
    setter.mockRestore();
    guard.restore();
    expect(doc.title).toBe('站点');
  });

  it('运行时已失效（扩展被更新 / 重载）：不再补刀，标题保持站点写入的值', async () => {
    let alive = true;
    const guard = new TitleFaviconGuard(doc, { isAlive: () => alive });
    guard.apply('阅读', null);
    alive = false;
    doc.title = '第 5 章';
    await new Promise((r) => setTimeout(r, 0));
    expect(doc.title).toBe('第 5 章');
    guard.restore();
    expect(doc.title).toBe('第 5 章');
  });

  it('自定义图标生效', () => {
    const guard = new TitleFaviconGuard(doc);
    guard.apply('t', 'data:image/png;base64,CUSTOM');
    expect(doc.querySelector('link[rel~="icon"]')?.getAttribute('href')).toBe('data:image/png;base64,CUSTOM');
  });

  describe('会反抗的网站（#49）', () => {
    /** 装一个"永不放弃"的站点标题守卫，并用假时钟驱动插件 */
    function setupFight(maxForcesPerSecond: number) {
      const clock = createClock();
      const guard = new TitleFaviconGuard(doc, {
        maxForcesPerSecond,
        debounceMs: 10,
        now: clock.now,
        setTimer: clock.setTimer,
      });
      const setter = vi.spyOn(doc, 'title', 'set');
      guard.apply('阅读', null);
      const siteGuard = watchTitle(doc, '站点');
      doc.title = '站点';
      const writes = () => setter.mock.calls.filter(([v]) => v === '阅读').length;
      return { clock, guard, setter, siteGuard, writes };
    }

    it('网站连续写 3 次标题：合并成一拍，只补刀一次', async () => {
      const clock = createClock();
      const guard = new TitleFaviconGuard(doc, { now: clock.now, setTimer: clock.setTimer, debounceMs: 10 });
      guard.apply('阅读', null);
      const setter = vi.spyOn(doc, 'title', 'set');
      doc.title = '站点 1';
      doc.title = '站点 2';
      doc.title = '站点 3';
      await clock.advance(10);
      expect(setter.mock.calls.filter(([v]) => v === '阅读')).toHaveLength(1);
      expect(doc.title).toBe('阅读');
      setter.mockRestore();
      guard.restore();
      expect(doc.title).toBe('站点 3'); // 还原成站点最后一次写入的值
    });

    it('长期对抢：第一秒内的标题写入有硬上限', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { clock, guard, setter, siteGuard, writes } = setupFight(4);
      await clock.advance(1000);
      // 进入时写过 1 次，补刀 3 次后到上限就熔断，不会出现每秒十几次的重写
      expect(writes()).toBe(4);
      expect(writes()).toBeLessThanOrEqual(4);
      expect(doc.title).toBe('站点');
      siteGuard.disconnect();
      setter.mockRestore();
      guard.restore();
      warn.mockRestore();
    });

    it('到达上限后彻底停手：页面停在网站标题上，重复 apply 也不会重置熔断', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { clock, guard, setter, siteGuard, writes } = setupFight(4);
      await clock.advance(1000);
      const settled = writes();
      expect(settled).toBe(4);

      // 熔断要留下可查的记录（判断是网站太顽固还是我们写错了）
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]![0])).toContain('已停止改写');

      // 上层每次存储变化都会重复调 apply：不能因此把熔断计数清零
      guard.apply('阅读', null);
      await clock.advance(5000);
      expect(writes()).toBe(settled);
      expect(doc.title).toBe('站点');

      siteGuard.disconnect();
      setter.mockRestore();
      guard.restore();
      warn.mockRestore();
    });

    it('熔断后只有目标标题真的变了才解封', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { clock, guard, setter, siteGuard } = setupFight(3);
      await clock.advance(1000);
      expect(doc.title).toBe('站点');

      siteGuard.disconnect();
      guard.update('公司Wiki', null);
      expect(doc.title).toBe('公司Wiki');
      expect(setter.mock.calls.filter(([v]) => v === '公司Wiki')).toHaveLength(1);

      setter.mockRestore();
      guard.restore();
      warn.mockRestore();
    });

    it('图标只建一次：多次补刀与站点重新插入自己的图标都不删我们的那张', async () => {
      const clock = createClock();
      const guard = new TitleFaviconGuard(doc, {
        maxForcesPerSecond: 10,
        debounceMs: 10,
        now: clock.now,
        setTimer: clock.setTimer,
      });
      guard.apply('阅读', null);
      const ours = doc.querySelector(ICONS)!;
      expect(ours).not.toBeNull();

      const create = vi.spyOn(doc, 'createElement');
      for (const title of ['站点 1', '站点 2', '站点 3']) {
        doc.title = title;
        await clock.advance(10);
        expect(doc.title).toBe('阅读');
        expect(doc.querySelectorAll(ICONS)).toHaveLength(1);
        expect(doc.querySelector(ICONS)).toBe(ours); // 还是同一个元素，没有删了重建
      }
      expect(create.mock.calls.filter(([tag]) => String(tag).toLowerCase() === 'link')).toHaveLength(0);
      create.mockRestore();

      // 站点重新插回自己的图标：只移除站点的，我们那张原地保留
      const siteIcon = doc.createElement('link');
      siteIcon.rel = 'icon';
      siteIcon.href = 'https://site.com/other.ico';
      doc.head.appendChild(siteIcon);
      doc.title = '站点 4';
      await clock.advance(10);
      expect(doc.querySelectorAll(ICONS)).toHaveLength(1);
      expect(doc.querySelector(ICONS)).toBe(ours);
      expect(ours.isConnected).toBe(true);
      guard.restore();
    });

    it('图标没有真的不一致时不动 DOM：重复 apply 不删不插', () => {
      const guard = new TitleFaviconGuard(doc);
      guard.apply('阅读', null);
      const ours = doc.querySelector(ICONS);
      const append = vi.spyOn(doc.head, 'appendChild');
      const remove = vi.spyOn(Element.prototype, 'remove');
      guard.apply('阅读', null); // 每次存储变化都会重复调用
      guard.apply('阅读', TRANSPARENT_PNG); // 显式传默认图标，等价于空
      expect(append).not.toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();
      expect(doc.querySelector(ICONS)).toBe(ours);
      append.mockRestore();
      remove.mockRestore();
      guard.restore();
    });

    it('慢速改回不会被熔断：每秒一次仍然每次都压回', async () => {
      const clock = createClock();
      const guard = new TitleFaviconGuard(doc, { now: clock.now, setTimer: clock.setTimer, debounceMs: 10 });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      guard.apply('阅读', null);
      for (let i = 1; i <= 6; i++) {
        doc.title = `第 ${i} 章`;
        await clock.advance(1000);
        expect(doc.title).toBe('阅读');
      }
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
      guard.restore();
    });
  });
});
