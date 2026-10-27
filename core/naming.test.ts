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

  it('文字都在子元素里的容器：取后代文本前几字', () => {
    const bar = document.createElement('div');
    for (const t of ['首页', '书架', '发现']) {
      const a = document.createElement('a');
      a.textContent = t;
      bar.appendChild(a);
    }
    expect(describeElement(bar)).toBe('首页书架发现');
  });

  it('自身有直接文本时优先用它，不拼接后代文本', () => {
    const el = document.createElement('div');
    el.appendChild(document.createTextNode('通知'));
    const child = document.createElement('span');
    child.textContent = '有 3 条新消息';
    el.appendChild(child);
    expect(describeElement(el)).toBe('通知');
  });

  it('后代文本过长（整段 / 整页内容）不采用，退回标签名', () => {
    const main = document.createElement('div');
    const p = document.createElement('p');
    p.textContent = '这是一整段正文，前几个字并不能说明这个区域是什么，不应该被拿来当名字。'.repeat(2);
    main.appendChild(p);
    expect(describeElement(main)).toBe('div 元素');
  });

  it('真·空元素：兜底到标签名', () => {
    expect(describeElement(document.createElement('div'))).toBe('div 元素');
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
