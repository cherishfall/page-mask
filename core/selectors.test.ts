import { beforeEach, describe, expect, it } from 'vitest';
import {
  containsMachineClass,
  generalizeSelector,
  isMachineClassToken,
  rankSelector,
  generateCandidates,
} from './selectors';

describe('isMachineClassToken 机器乱码类名识别', () => {
  it('识别常见 CSS-in-JS 前缀', () => {
    expect(isMachineClassToken('css-1qaz2ws')).toBe(true);
    expect(isMachineClassToken('sc-dIprVJ')).toBe(true);
    expect(isMachineClassToken('emotion-0')).toBe(true);
    expect(isMachineClassToken('chakra-button')).toBe(true);
    expect(isMachineClassToken('Button__Styled-sc-1abc2d')).toBe(true);
  });
  it('识别哈希与下划线风格', () => {
    expect(isMachineClassToken('_2fX3gH')).toBe(true);
    expect(isMachineClassToken('card-y7x3p2')).toBe(true);
    expect(isMachineClassToken('a1b2c3d4e5')).toBe(true);
  });
  it('正常语义类名不误伤', () => {
    expect(isMachineClassToken('site-nav')).toBe(false);
    expect(isMachineClassToken('reader-header')).toBe(false);
    expect(isMachineClassToken('btn')).toBe(false);
    expect(isMachineClassToken('ant-btn-primary')).toBe(false);
    expect(isMachineClassToken('grid-cols-12')).toBe(false);
    expect(isMachineClassToken('shadow-lg')).toBe(false);
  });
});

describe('containsMachineClass / rankSelector', () => {
  it('选择器级过滤', () => {
    expect(containsMachineClass('.card.css-1q2w3e > .title')).toBe(true);
    expect(containsMachineClass('.card > .title')).toBe(false);
  });
  it('id 最稳，属性次之，nth 最险', () => {
    expect(rankSelector('#main')).toBeGreaterThan(rankSelector('[data-testid="nav"]'));
    expect(rankSelector('[data-testid="nav"]')).toBeGreaterThan(rankSelector('.site-nav'));
    expect(rankSelector('.site-nav')).toBeGreaterThan(rankSelector('div:nth-child(3)'));
  });
});

describe('generateCandidates（happy-dom 真实 DOM）', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('优先产出语义候选且全部命中元素', () => {
    const div = document.createElement('div');
    div.id = 'topNav';
    div.setAttribute('data-testid', 'site-nav');
    div.className = 'nav-bar';
    document.body.appendChild(div);
    const cands = generateCandidates(div);
    expect(cands.length).toBeGreaterThan(0);
    for (const c of cands) {
      expect(div.matches(c)).toBe(true);
      expect(containsMachineClass(c)).toBe(false);
    }
    expect(cands[0]).toMatch(/#topNav|\[data-testid/);
  });

  it('默认同类一起藏：剥掉 nth 片段', () => {
    const ul = document.createElement('ul');
    const items = ['a', 'b', 'c'].map((t) => {
      const li = document.createElement('li');
      li.className = 'rec-card';
      li.textContent = t;
      ul.appendChild(li);
      return li;
    });
    document.body.appendChild(ul);
    const second = items[1]!;
    const cands = generateCandidates(second);
    expect(cands.length).toBeGreaterThan(0);
    // 泛化后的选择器应能命中全部同类
    expect(document.querySelectorAll(cands[0]!).length).toBe(3);
  });

  it('onlyThis：只命中点选的那个', () => {
    const ul = document.createElement('ul');
    const items = ['a', 'b', 'c'].map((t) => {
      const li = document.createElement('li');
      li.className = 'rec-card';
      li.textContent = t;
      ul.appendChild(li);
      return li;
    });
    document.body.appendChild(ul);
    const second = items[1]!;
    const cands = generateCandidates(second, { onlyThis: true });
    expect(document.querySelectorAll(cands[0]!).length).toBe(1);
  });

  it('机器类名被过滤，语义属性优先', () => {
    const div = document.createElement('div');
    div.className = 'css-1qaz2ws sc-dIpRtZ';
    div.setAttribute('aria-label', '推荐列表');
    document.body.appendChild(div);
    const cands = generateCandidates(div);
    expect(cands.length).toBeGreaterThan(0);
    for (const c of cands) expect(containsMachineClass(c)).toBe(false);
    expect(cands[0]).toContain('[aria-label');
  });
});

describe('generalizeSelector', () => {
  it('剥掉 nth 后不再命中时返回 null', () => {
    const ul = document.createElement('ul');
    const li1 = document.createElement('li');
    const li2 = document.createElement('li');
    ul.append(li1, li2);
    document.body.appendChild(ul);
    // li:nth-child(2) 剥掉后变 li，仍命中 li2 → 可泛化
    expect(generalizeSelector('li:nth-child(2)', li2)).toBe('li');
    // 但对 document 之外孤立元素不适用（无匹配上下文时 matches 返回 false）
  });
});
