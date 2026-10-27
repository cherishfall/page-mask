import { beforeEach, describe, expect, it, vi } from 'vitest';
// @ts-ignore 项目不装 @types/node；vitest 跑在 Node 里，node:zlib 可用
import { inflateSync } from 'node:zlib';
import { TitleFaviconGuard, TRANSPARENT_PNG } from './disguise';

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

  it('补刀限频：站点自己的守卫与我们来回抢时，一秒内补刀次数有上限，退避后再压回一次', async () => {
    let now = 0;
    const timers: (() => void)[] = [];
    const guard = new TitleFaviconGuard(doc, {
      maxForcesPerSecond: 5,
      backoffMs: 2000,
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
    expect(timers.length).toBe(1); // 退避后只安排一次补刀

    now += 2000;
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
});
