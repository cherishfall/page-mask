/**
 * 选择器生成（ADR-0002）：css-selector-generator 天然输出"从最简到兜底"的候选序列，
 * 在此基础上：
 * 1. 通过库的 blacklist 选项过滤每次构建都会变的 id / 属性 / 机器类名（B17）；
 * 2. "同类一起藏"时只去掉最后一级的 nth 位置限定，空了就补上标签名（B2）；
 * 3. 丢弃没有特征的候选（纯标签、通配、纯位置，B3），以及命中集合与主候选不一致的候选；
 * 4. 先按稳定度排序，再截断到最多 3 个（B19）。
 * 排序原则：id/aria/data-* 语义属性 > 正常类名 > 结构路径（nth 只做最后备胎）。
 *
 * 所有检测用的正则都不带 g 标志：带 g 的正则做 test() 会记住 lastIndex，复用时结果不稳定（B20）。
 */
import { cssSelectorGenerator } from 'css-selector-generator';
import { isSafeSelector } from './validate';

/** 一个片段里字母和数字交替的次数：哈希串交替频繁（y7x3p2 = 5 次），人写的词很少（primary1 = 1 次） */
function letterDigitTransitions(s: string): number {
  let n = 0;
  for (let i = 1; i < s.length; i++) {
    const a = /\d/.test(s[i - 1] as string);
    const b = /\d/.test(s[i] as string);
    if (a !== b) n++;
  }
  return n;
}

/**
 * 机器生成类名特征：CSS-in-JS 前缀（css-/sc-/emotion-/jsx-）、CSS Modules 风格的下划线开头、
 * 尾部哈希（字母数字频繁交替）、含数字的纯十六进制串。
 * 不误伤：react-select__control（库的语义类名）、btn_primary1（末尾只是编号）、
 * face / added / bead / facade（恰好全由 a-f 组成的英文单词，不含数字）。
 */
export function isMachineClassToken(token: string): boolean {
  if (token.startsWith('_')) return true;
  if (/^css-(?=[a-z0-9]*\d)[a-z0-9]{4,}(?:-|$)/i.test(token)) return true; // emotion：css-1qaz2ws、css-1abc2d-Label
  if (/(?:^|[-_])sc-[A-Za-z0-9]{4,}$/.test(token)) return true; // styled-components：sc-dIprVJ、Button__Styled-sc-1abc2d
  if (/^(?:emotion|jsx)-\d+$/.test(token)) return true; // emotion-0、styled-jsx 的 jsx-2849231
  if (/^(?:chakra|styled)-/.test(token)) return true;
  const tail = /[-_]([A-Za-z0-9]{5,})$/.exec(token)?.[1];
  if (tail && /[A-Za-z]/.test(tail) && /\d/.test(tail) && letterDigitTransitions(tail) >= 2) return true;
  return /^(?=\D*\d)[A-Fa-f0-9]{6,}$/.test(token);
}

/** 选择器里是否含机器类名（提取 .token 逐个检查） */
export function containsMachineClass(selector: string): boolean {
  for (const m of selector.matchAll(/\.([A-Za-z0-9_-]+)/g)) {
    if (isMachineClassToken(m[1] ?? '')) return true;
  }
  return false;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 每次渲染 / 构建都会变的 id：
 * - React useId：18 是 `:r1:`，19.0/19.1 是 `«r1»`，19.2 起是 `_r_1_`；常被拼进 `radix-:r5:` 之类
 * - UUID、以及看起来像哈希的片段（≥6 位、字母数字交替 ≥3 次，如 a8f3k2j9x7）
 * 人写的 id 如 main、topNav、chapter12、section-2024 不受影响。
 */
export function isUnstableId(id: string): boolean {
  if (/[:«»]/.test(id)) return true;
  if (/^_r_[0-9a-z]+_$/i.test(id)) return true;
  if (UUID_RE.test(id)) return true;
  return id
    .split(/[-_]/)
    .some((seg) => seg.length >= 6 && /[A-Za-z]/.test(seg) && /\d/.test(seg) && letterDigitTransitions(seg) >= 3);
}

/** 框架给样式隔离加的属性，名字里带构建哈希：Vue data-v-xxxx、Angular _ngcontent-* / _nghost-*、旧 React data-reactid */
export function isUnstableAttributeName(name: string): boolean {
  return /^(?:data-v-|_ngcontent-|_nghost-|data-reactid$)/i.test(name);
}

/** 还原选择器片段里的 CSS 转义（`\3A ` → `:`，`\:` → `:`），用于按原始值判断 */
function cssUnescape(s: string): string {
  return s.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g, (_m, hex: string | undefined, ch: string | undefined) =>
    hex ? String.fromCodePoint(parseInt(hex, 16)) : (ch ?? ''),
  );
}

/**
 * 交给 css-selector-generator 的 blacklist：它会把每个备选片段（`#id`、`.cls`、`[name]`、`[name='value']`、标签名）
 * 逐个传进来，返回 true 的片段不会被用来组合选择器。
 */
export function isUnstableSelectorItem(item: string): boolean {
  if (item.startsWith('#')) return isUnstableId(cssUnescape(item.slice(1)));
  if (item.startsWith('.')) return isMachineClassToken(cssUnescape(item.slice(1)));
  if (item.startsWith('[')) {
    const m = /^\[((?:\\.|[^=\]\\])+)(?:='((?:\\.|[^'\\])*)')?\]$/.exec(item);
    if (!m) return false;
    const name = cssUnescape(m[1] ?? '');
    if (isUnstableAttributeName(name)) return true;
    // 引用了不稳定 id 的属性值，如 aria-labelledby=":r1:"
    return m[2] !== undefined && isUnstableId(cssUnescape(m[2]));
  }
  return false;
}

/**
 * 没有特征的选择器：只由标签名、通配符、位置伪类（:nth-child 等）和组合符构成，
 * 例如 `li`、`*`、`div > a`、`:nth-child(3)`、`div:nth-child(3) > a`。
 * 这类选择器在整页范围内命中所有同标签 / 同位置的元素，点一个小元素就会藏掉一大片（B3）。
 *
 * 算有特征（返回 false）：任一级（括号外）出现 id `#`、类名 `.` 或属性 `[...]`；
 * 或以 `:root` 开头——从页面根逐级锚定的路径（库的兜底输出），范围被限定在一个确定的父元素下。
 * `:not(.x)` 这类括号里的类名不算特征（它扩大而不是收窄命中范围）。
 */
export function isFeaturelessSelector(selector: string): boolean {
  const s = selector.trim();
  if (/^:root(?![\w-])/.test(s)) return false;
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i] as string;
    if (c === '\\') {
      i++;
      continue;
    }
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (depth === 0 && (c === '#' || c === '.' || c === '[')) return false;
  }
  return true;
}

/** 候选稳定度评分，越高越稳 */
export function rankSelector(selector: string): number {
  let score = 0;
  if (/^#[A-Za-z0-9_-]/.test(selector)) score += 100;
  if (/\[(?:data-|aria-|role=|name=|title=|alt=|id=)/.test(selector)) score += 80;
  if (/^\.[A-Za-z0-9_-]/.test(selector)) score += 50;
  if (selector.includes('.')) score += 20;
  if (selector.includes(':nth-')) score -= 40;
  if (/^[a-z]+$/i.test(selector)) score -= 30; // 纯标签名
  score -= Math.min(selector.length / 10, 20); // 越长越险
  return score;
}

/** 把选择器切成"前面的祖先部分"和"最后一级（目标元素自身）"。跳过引号、括号、方括号和转义 */
function splitLastCompound(selector: string): { head: string; last: string } {
  let depth = 0;
  let quote: string | null = null;
  let boundary = 0;
  for (let i = 0; i < selector.length; i++) {
    const c = selector[i] as string;
    if (c === '\\') {
      const hex = /^[0-9a-fA-F]{1,6}\s?/.exec(selector.slice(i + 1));
      i += hex ? hex[0].length : 1;
      continue;
    }
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (depth === 0 && (c === ' ' || c === '>' || c === '+' || c === '~')) boundary = i + 1;
  }
  return { head: selector.slice(0, boundary), last: selector.slice(boundary) };
}

/**
 * 泛化选择器：只去掉最后一级的 :nth-child(n)/:nth-of-type(n)，让"同一个父元素下的同类元素"一起命中；
 * 祖先级的位置限定保留（它们把范围锚定在点选的那个容器里）。最后一级去空了就补上标签名，
 * 例如 `.side > :nth-child(3)` → `.side > div`。
 * 返回 null 表示泛化后不再命中该元素（不能安全泛化）。
 */
export function generalizeSelector(selector: string, el: Element): string | null {
  const { head, last } = splitLastCompound(selector);
  const stripped = last.replace(/:nth-(?:child|of-type)\(\d+\)/g, '');
  if (stripped === last) return selector;
  const generalized = head + (stripped || el.localName);
  try {
    return el.matches(generalized) ? generalized : null;
  } catch {
    return null;
  }
}

export interface GenerateOptions {
  /** true = 只藏点选的那个元素（唯一选择器）；false（默认）= 同类一起藏（泛化选择器） */
  onlyThis?: boolean;
  /** 最多保留几个候选，默认 3 */
  max?: number;
}

const RAW_LIMIT = 24;

/** 从库里取原始候选（每个都只命中该元素）。逐个取值并容错：个别 DOM 实现差异导致的异常不中断收集 */
function collectRaw(el: Element): string[] {
  const raw: string[] = [];
  const iter = cssSelectorGenerator(el, {
    selectors: ['id', 'attribute', 'class', 'tag', 'nthoftype', 'nthchild'],
    blacklist: [isUnstableSelectorItem],
    combineWithinSelector: true,
    combineBetweenSelectors: true,
    maxResults: RAW_LIMIT,
  });
  while (raw.length < RAW_LIMIT) {
    let step: IteratorResult<string>;
    try {
      step = iter.next();
    } catch {
      break;
    }
    if (step.done) break;
    raw.push(step.value);
  }
  return raw;
}

/** 有特征、且不是从页面根数位置的兜底路径 —— 适合当锚点 */
function isGoodAnchor(sel: string): boolean {
  return !isFeaturelessSelector(sel) && !sel.startsWith(':root') && !containsMachineClass(sel) && isSafeSelector(sel);
}

function nthChildIndex(el: Element): number {
  let i = 1;
  for (let s = el.previousElementSibling; s; s = s.previousElementSibling) i++;
  return i;
}

const MAX_ANCHOR_DEPTH = 4;

/**
 * 元素自身没有特征时（库只能给出 `div:nth-child(4)` 这类纯位置写法），向上找最近的有特征祖先，
 * 拼成 `.side > div:nth-child(4)`；中间没特征的层级用 `标签:nth-child(n)` 逐级连起来。
 * 这些候选只命中该元素，后续再按模式泛化（同类模式下变成 `.side > div`）。
 */
function anchoredCandidates(el: Element): string[] {
  let path = `${el.localName}:nth-child(${nthChildIndex(el)})`;
  let cur = el.parentElement;
  for (let depth = 0; cur && cur !== el.ownerDocument.documentElement && depth < MAX_ANCHOR_DEPTH; depth++) {
    const anchors = collectRaw(cur).filter(isGoodAnchor);
    if (anchors.length) {
      anchors.sort((a, b) => rankSelector(b) - rankSelector(a));
      return anchors.slice(0, 3).map((a) => `${a} > ${path}`);
    }
    path = `${cur.localName}:nth-child(${nthChildIndex(cur)}) > ${path}`;
    cur = cur.parentElement;
  }
  return [];
}

function queryAll(root: ParentNode, selector: string): Element[] {
  try {
    return Array.from(root.querySelectorAll(selector));
  } catch {
    return [];
  }
}

/**
 * 为元素生成候选选择器列表（由稳到险排序，任一命中即算找到）。
 * 返回空数组表示找不到可靠的写法（调用方应提示用户"选大一点"，不能保存空规则）。
 */
export function generateCandidates(el: Element, opts: GenerateOptions = {}): string[] {
  const { onlyThis = false, max = 3 } = opts;
  const usable = (sel: string): boolean => {
    if (!isSafeSelector(sel) || isFeaturelessSelector(sel) || containsMachineClass(sel)) return false;
    try {
      return el.matches(sel);
    } catch {
      return false;
    }
  };

  // preferred：符合用户意图的候选（同类模式下 = 泛化成功的）；fallback：泛化失败时退回的唯一候选
  const preferred: string[] = [];
  const fallback: string[] = [];
  const raw = collectRaw(el);
  if (!raw.some(isGoodAnchor)) raw.unshift(...anchoredCandidates(el));
  for (const sel of raw) {
    const g = onlyThis ? sel : generalizeSelector(sel, el);
    if (g && usable(g)) preferred.push(g);
    else if (usable(sel)) fallback.push(sel);
  }
  const pool = [...new Set(preferred.length ? preferred : fallback)];
  if (pool.length === 0) return [];

  // 先排序（稳定排序，同分保持库给的顺序），再选主候选、比对命中集合，最后截断
  pool.sort((a, b) => rankSelector(b) - rankSelector(a));
  const rootNode = el.getRootNode() as Node & Partial<ParentNode>;
  const root: ParentNode = typeof rootNode.querySelectorAll === 'function' ? (rootNode as ParentNode) : el.ownerDocument;
  const primaryHits = queryAll(root, pool[0] as string);
  const sameAsPrimary = (sel: string): boolean => {
    const h = queryAll(root, sel);
    return h.length === primaryHits.length && h.every((x, i) => x === primaryHits[i]);
  };
  return pool.filter(sameAsPrimary).slice(0, max);
}

/** 高级后门保存门槛（uBlock 同款）：选择器文本必须现场命中至少一个元素 */
export function selectorHitsElement(selector: string, root: ParentNode = document): number {
  try {
    return root.querySelectorAll(selector).length;
  } catch {
    return 0;
  }
}
