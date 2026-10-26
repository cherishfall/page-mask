import { beforeEach, describe, expect, it } from 'vitest';
import {
  containsMachineClass,
  generalizeSelector,
  isMachineClassToken,
  rankSelector,
  generateCandidates,
  isFeaturelessSelector,
  isUnstableId,
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

/** 选择器在当前文档里命中的元素集合 */
function hits(sel: string): Element[] {
  return Array.from(document.querySelectorAll(sel));
}
function sameSet(a: Element[], b: Element[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

describe('generateCandidates：候选必须有效、有特征、命中一致（#32）', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('无 class 元素（.side > :nth-child(3) 类结构）默认同类一起藏：非空，且只命中 .side 里的同类 div', () => {
    document.body.innerHTML = `
      <div class="side"><div>a</div><div>b</div><span>s</span><div>c</div></div>
      <div class="main"><div>x</div><div>y</div></div>`;
    const target = document.querySelectorAll('.side > div')[2]!;
    const cands = generateCandidates(target);
    expect(cands.length).toBeGreaterThan(0);
    const expected = Array.from(document.querySelectorAll('.side > div'));
    for (const c of cands) expect(sameSet(hits(c), expected)).toBe(true);
    // 主候选锚定到最近的有特征祖先，而不是从页面根数位置（页面结构一变就失效）
    expect(cands[0]).toBe('.side > div');
  });

  it('无 class 元素 onlyThis：非空且只命中它自己', () => {
    document.body.innerHTML = `<div class="side"><div>a</div><div>b</div><div>c</div></div>`;
    const target = document.querySelectorAll('.side > div')[2]!;
    const cands = generateCandidates(target, { onlyThis: true });
    expect(cands.length).toBeGreaterThan(0);
    for (const c of cands) expect(hits(c)).toEqual([target]);
  });

  it('整页都没有特征的元素：退回从页面根锚定的路径，仍非空', () => {
    document.body.innerHTML = `<div><div><p>a</p><p>b</p></div></div><p>outside</p>`;
    const target = document.querySelectorAll('div p')[1]!;
    const cands = generateCandidates(target);
    expect(cands.length).toBeGreaterThan(0);
    for (const c of cands) {
      expect(isFeaturelessSelector(c)).toBe(false);
      expect(hits(c)).toContain(target);
      expect(hits(c)).not.toContain(document.body.lastElementChild);
    }
  });

  it('<li class=rec-card> 的候选不含裸 li / 纯标签组合，且命中集合与主候选一致', () => {
    document.body.innerHTML = `
      <ul><li class="rec-card">a</li><li class="rec-card">b</li><li class="rec-card">c</li></ul>
      <ol><li>other</li></ol>`;
    const target = document.querySelectorAll('.rec-card')[1]!;
    const cands = generateCandidates(target);
    expect(cands.length).toBeGreaterThan(0);
    const primary = hits(cands[0]!);
    for (const c of cands) {
      expect(c).not.toBe('li');
      expect(isFeaturelessSelector(c)).toBe(false);
      expect(sameSet(hits(c), primary)).toBe(true);
    }
    expect(primary).not.toContain(document.querySelector('ol > li'));
  });

  it('含 data-v-xxxx 的元素：任何候选都不依赖该属性', () => {
    document.body.innerHTML = `
      <section data-v-7ba5bd90 class="card">a</section>
      <section class="card">b</section>
      <nav class="top-nav" data-v-7ba5bd90>n</nav>`;
    const target = document.querySelector('section[data-v-7ba5bd90]')!;
    const cands = generateCandidates(target, { onlyThis: true });
    expect(cands.length).toBeGreaterThan(0);
    for (const c of cands) expect(c).not.toContain('data-v-');
    const nav = generateCandidates(document.querySelector('nav')!);
    expect(nav[0]).toBe('.top-nav');
  });

  it('Angular _ngcontent/_nghost、React :r1: / «r2» 与哈希 id 不进入候选', () => {
    document.body.innerHTML = `
      <div _nghost-abc-c12 class="host"><p _ngcontent-abc-c12 id=":r1:" class="intro">a</p></div>
      <p id="«r2»" class="intro2">b</p>
      <p id="a8f3k2j9x7" class="intro3">c</p>`;
    for (const el of Array.from(document.querySelectorAll('p'))) {
      const cands = generateCandidates(el, { onlyThis: true });
      expect(cands.length).toBeGreaterThan(0);
      for (const c of cands) {
        expect(c).not.toMatch(/_ngcontent|_nghost|r1|r2|a8f3k2j9x7/);
      }
    }
  });

  it('最多 3 个候选，且按稳定度从高到低排列', () => {
    document.body.innerHTML = `<div id="main" class="nav-bar site-nav" data-testid="nav" aria-label="导航" role="navigation">x</div>`;
    const cands = generateCandidates(document.getElementById('main')!);
    expect(cands.length).toBeGreaterThan(0);
    expect(cands.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < cands.length; i++) {
      expect(rankSelector(cands[i - 1]!)).toBeGreaterThanOrEqual(rankSelector(cands[i]!));
    }
    expect(cands[0]).toBe('#main');
  });
});

describe('isFeaturelessSelector：纯标签 / 通配 / 纯位置 的选择器算没有特征', () => {
  it.each([
    ['li', true],
    ['*', true],
    ['div > a', true],
    [':nth-child(3)', true],
    ['div:nth-child(3) > a', true],
    ['.rec-card', false],
    ['#main', false],
    ['[data-testid="x"]', false],
    ['.side > div', false],
    [':root > :nth-child(2) > div', false],
    ['a[href="a.b#c"]', false],
  ])('%s → %s', (sel, expected) => {
    expect(isFeaturelessSelector(sel)).toBe(expected);
  });
});

describe('isUnstableId：每次构建都会变的 id', () => {
  it.each([
    [':r1:', true],
    [':R2a6:', true],
    ['«r1»', true],
    ['_r_3_', true],
    ['radix-:r5:', true],
    ['a8f3k2j9x7', true],
    ['3f2504e0-4f89-11d3-9a0c-0305e82c3301', true],
    ['main', false],
    ['topNav', false],
    ['chapter12', false],
    ['section-2024', false],
  ])('%s → %s', (id, expected) => {
    expect(isUnstableId(id)).toBe(expected);
  });
});

describe('isMachineClassToken 不误伤（#32）', () => {
  it.each(['react-select__control', 'btn_primary1', 'face', 'added', 'bead', 'facade', 'decade', 'h1-title', 'col-md-6'])(
    '%s 不是机器类名',
    (token) => {
      expect(isMachineClassToken(token)).toBe(false);
    },
  );
  it.each(['jsx-2849231', 'Header_title__3xK9a', 'deadbeef12'])('%s 是机器类名', (token) => {
    expect(isMachineClassToken(token)).toBe(true);
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
