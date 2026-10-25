/**
 * 选择器生成（ADR-0002）：css-selector-generator 天然输出"从最简到兜底"的候选序列，
 * 在此基础上过滤 CSS-in-JS 机器乱码类名并按稳定度排序。
 * 排序原则：id/aria/data-* 语义属性 > 正常类名 > 结构路径（nth 只做最后备胎）。
 */
import { cssSelectorGenerator } from 'css-selector-generator';

/** 机器生成类名特征：css-/sc-/emotion- 等前缀、下划线开头、尾部 base62 哈希 */
export function isMachineClassToken(token: string): boolean {
  if (token.startsWith('_')) return true;
  if (/(?:^|[-_])(?:css|emotion|sc|chakra|styled|jsx|react)(?:[-_][a-z0-9]+)+/i.test(token)) return true;
  // 尾部哈希：分隔符后 5 位以上字母数字混合（同时含字母与数字才算哈希，避免误伤语义词）
  const tail = token.match(/[-_]([A-Za-z0-9]{5,})$/);
  if (tail) {
    const t = tail[1] ?? '';
    if (/[A-Za-z]/.test(t) && /[0-9]/.test(t)) return true;
  }
  return /^[A-Fa-f0-9]{6,}$/.test(token);
}

/** 选择器里是否含机器类名（提取 .token 逐个检查） */
export function containsMachineClass(selector: string): boolean {
  const tokens = selector.match(/\.([A-Za-z0-9_-]+)/g) ?? [];
  return tokens.some((t) => typeof t === 'string' && isMachineClassToken(t.slice(1)));
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

const NTH_SEGMENT = /:nth-(?:child|of-type)\(\d+\)/g;

/**
 * 泛化选择器：剥掉 :nth-child(n)/:nth-of-type(n) 片段，让"同类元素一起"命中。
 * 返回 null 表示剥掉后不再命中该元素（不能安全泛化）。
 */
export function generalizeSelector(selector: string, el: Element): string | null {
  if (!NTH_SEGMENT.test(selector)) return selector;
  NTH_SEGMENT.lastIndex = 0;
  const generalized = selector.replace(NTH_SEGMENT, '');
  try {
    return el.matches(generalized) ? generalized : null;
  } catch {
    return null;
  }
}

export interface GenerateOptions {
  /** true = 只藏点选的那个元素（唯一选择器）；false（默认）= 同类一起藏（泛化选择器） */
  onlyThis?: boolean;
  max?: number;
}

/**
 * 为元素生成候选选择器列表（由稳到险排序，任一命中即算找到）。
 */
export function generateCandidates(el: Element, opts: GenerateOptions = {}): string[] {
  const { onlyThis = false, max = 5 } = opts;
  const raw: string[] = [];
  const iter = cssSelectorGenerator(el, {
    selectors: ['id', 'attribute', 'class', 'tag', 'nthoftype', 'nthchild'],
    combineWithinSelector: true,
    combineBetweenSelectors: true,
    maxResults: 24,
  });
  // 逐个取值并容错：个别 DOM 实现差异导致的异常不中断整个候选收集
  while (raw.length < 24) {
    let step: IteratorResult<string>;
    try {
      step = iter.next();
    } catch {
      break;
    }
    if (step.done) break;
    raw.push(step.value);
  }

  const clean = raw.filter((s) => !containsMachineClass(s));
  const source = clean.length ? clean : raw; // 全被过滤时退回原始（保底可用）

  const out: string[] = [];
  const seen = new Set<string>();
  for (const sel of source) {
    let candidate: string | null = sel;
    if (!onlyThis) {
      candidate = generalizeSelector(sel, el);
    }
    if (!candidate || seen.has(candidate)) continue;
    // 每个候选必须仍然命中该元素
    try {
      if (!el.matches(candidate)) continue;
    } catch {
      continue;
    }
    seen.add(candidate);
    out.push(candidate);
    if (out.length >= max) break;
  }
  return out.sort((a, b) => rankSelector(b) - rankSelector(a));
}

/** 高级后门保存门槛（uBlock 同款）：选择器文本必须现场命中至少一个元素 */
export function selectorHitsElement(selector: string, root: ParentNode = document): number {
  try {
    return root.querySelectorAll(selector).length;
  } catch {
    return 0;
  }
}
