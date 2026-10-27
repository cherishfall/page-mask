import { describe, expect, it } from 'vitest';
import { HOST_SHIELD_CSS, HOST_TAGS, isOwnUiNode } from './host-shield';

describe('宿主保护样式 HOST_SHIELD_CSS', () => {
  it('覆盖全部页内界面宿主', () => {
    for (const tag of Object.values(HOST_TAGS)) expect(HOST_SHIELD_CSS).toContain(tag);
  });

  it('每条声明都带 !important（用户样式表层的 !important 才压得过页面作者的 !important）', () => {
    const decls = HOST_SHIELD_CSS.replace(/[^{]*\{([^}]*)\}/g, '$1;')
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean);
    expect(decls.length).toBeGreaterThan(5);
    for (const d of decls) expect(d).toMatch(/!important$/);
  });

  it('宿主名都是合法的自定义元素名（含连字符），页面的 div 选择器匹配不到', () => {
    for (const tag of Object.values(HOST_TAGS)) expect(tag).toMatch(/^[a-z]+-[a-z-]+$/);
  });

  it('带标记属性，新实例能探测到本文档里已有的保护样式', () => {
    expect(HOST_SHIELD_CSS).toMatch(/--pagemask-shield:\s*1\s*!important/);
  });

  it('切断会穿过宿主继承进 shadow 的属性：all 不管 direction，必须单独写', () => {
    expect(HOST_SHIELD_CSS).toMatch(/all:\s*initial\s*!important/);
    expect(HOST_SHIELD_CSS).toMatch(/direction:\s*ltr\s*!important/);
    expect(HOST_SHIELD_CSS).toMatch(/display:\s*block\s*!important/);
  });
});

describe('isOwnUiNode', () => {
  it('宿主自身与宿主内的节点算插件自己的，页面元素不算', () => {
    const host = document.createElement(HOST_TAGS.toggle);
    const inner = document.createElement('span');
    host.appendChild(inner);
    document.body.append(host);
    const page = document.createElement('div');
    document.body.append(page);
    expect(isOwnUiNode(host)).toBe(true);
    expect(isOwnUiNode(inner)).toBe(true);
    expect(isOwnUiNode(page)).toBe(false);
    host.remove();
    page.remove();
  });
});
