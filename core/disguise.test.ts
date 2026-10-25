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

  it('自定义图标生效', () => {
    const guard = new TitleFaviconGuard(doc);
    guard.apply('t', 'data:image/png;base64,CUSTOM');
    expect(doc.querySelector('link[rel~="icon"]')?.getAttribute('href')).toBe('data:image/png;base64,CUSTOM');
  });
});
