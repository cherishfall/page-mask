import { beforeEach, describe, expect, it } from 'vitest';
import { describeElement } from './naming';

describe('describeElement 人话命名', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('无障碍标签最优先', () => {
    const el = document.createElement('div');
    el.setAttribute('aria-label', '推荐卡片列表');
    expect(describeElement(el)).toBe('推荐卡片列表');
  });

  it('语义标签映射', () => {
    expect(describeElement(document.createElement('nav'))).toBe('导航栏');
    expect(describeElement(document.createElement('header'))).toBe('页头');
    expect(describeElement(document.createElement('aside'))).toBe('侧栏');
  });

  it('图片用替代文本', () => {
    const img = document.createElement('img');
    img.alt = '课程封面图';
    expect(describeElement(img)).toBe('图片：课程封面图');
  });

  it('元素自身文本前几字', () => {
    const el = document.createElement('span');
    el.textContent = '電子書籍トップへ戻る長いテキスト';
    expect(describeElement(el)).toContain('…');
    expect(describeElement(el).length).toBeLessThanOrEqual(9);
  });

  it('只取自身文本，不被深层子树污染', () => {
    const outer = document.createElement('div');
    const child = document.createElement('p');
    child.textContent = '很长的子元素文本内容不应该被采用';
    outer.appendChild(child);
    // outer 自身无直接文本 → 兜底到标签名
    expect(describeElement(outer)).toBe('div 元素');
  });

  it('兜底：标签名', () => {
    expect(describeElement(document.createElement('section'))).toBe('section 元素');
  });

  it('aria-labelledby 引用元素文本', () => {
    const label = document.createElement('span');
    label.id = 'lbl1';
    label.textContent = '搜索';
    document.body.appendChild(label);
    const el = document.createElement('div');
    el.setAttribute('aria-labelledby', 'lbl1');
    expect(describeElement(el)).toBe('搜索');
  });
});
