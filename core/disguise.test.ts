import { beforeEach, describe, expect, it, vi } from 'vitest';
import { effectiveTitle, TitleFaviconGuard } from './disguise';

describe('effectiveTitle 站点覆盖 > 全局默认', () => {
  it('未覆盖用全局默认', () => {
    expect(effectiveTitle({ disguisedTitle: null }, { defaultTitle: '新建标签页' })).toBe('新建标签页');
  });
  it('站点覆盖优先', () => {
    expect(effectiveTitle({ disguisedTitle: '工作文档' }, { defaultTitle: '新建标签页' })).toBe('工作文档');
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

  it('自定义图标生效', () => {
    const guard = new TitleFaviconGuard(doc);
    guard.apply('t', 'data:image/png;base64,CUSTOM');
    expect(doc.querySelector('link[rel~="icon"]')?.getAttribute('href')).toBe('data:image/png;base64,CUSTOM');
  });
});
