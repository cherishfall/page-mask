/**
 * 元素自动命名（design.md 数据模型）：无障碍标签 > 元素自身文本 > 后代文本 > 标签名兜底。
 * 面向不懂 CSS 的用户，名字必须是人话。名字按**当前界面语言**生成（core/i18n），
 * 生成后就存进配置了——它是用户数据，之后切界面语言不会去改已经存下的名字。
 */
import { t } from './i18n';

/** 语义标签 → 人话名字的键（文案在 core/i18n 的 common.elementName） */
type TagKey = 'nav' | 'header' | 'footer' | 'aside' | 'main' | 'form' | 'button' | 'search' | 'video' | 'audio' | 'canvas';

const TAG_KEYS: Record<string, TagKey> = {
  nav: 'nav',
  header: 'header',
  footer: 'footer',
  aside: 'aside',
  main: 'main',
  form: 'form',
  button: 'button',
  search: 'search',
  video: 'video',
  audio: 'audio',
  canvas: 'canvas',
};

const MAX_TEXT_LEN = 8;

/**
 * 后代文本的上限：超过它说明这个元素装的是整段 / 整页内容（页面主区域、文章正文），
 * 拿它的前几个字当名字只会得到一句没意义的话，这时宁可退回标签名。
 */
const MAX_DESCENDANT_TEXT_LEN = 40;

export function describeElement(el: Element): string {
  // 1. 无障碍标签
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim()) return clip(ariaLabel);

  const ariaLabelledByText = ariaLabelledby(el);
  if (ariaLabelledByText) return clip(ariaLabelledByText);

  // 2. 语义化标签 → 位置描述（如"顶部导航栏"的"导航栏"部分）
  const tag = el.tagName.toLowerCase();
  const tagKey = TAG_KEYS[tag];
  if (tagKey) return t().common.elementName[tagKey];

  // 3. 图像的替代文本
  if (tag === 'img') {
    const alt = el.getAttribute('alt');
    if (alt && alt.trim()) return t().common.elementName.image(clip(alt));
  }

  // 4. 表单控件的占位/值
  if (tag === 'input' || tag === 'textarea') {
    const placeholder = el.getAttribute('placeholder');
    if (placeholder && placeholder.trim()) return clip(placeholder);
  }

  // 5. 元素自身文本前几字（只看直接文本，避免抓到整页内容）
  const ownText = ownTextOf(el);
  if (ownText) return clip(ownText);

  // 6. 文字都在子元素里（如 <div><span>首页</span><span>书架</span></div>）：取后代文本的前几字
  const nestedText = nestedTextOf(el);
  if (nestedText) return clip(nestedText);

  // 7. 兜底：标签名
  return t().common.elementName.fallback(tag);
}

function ariaLabelledby(el: Element): string | null {
  const id = el.getAttribute('aria-labelledby');
  if (!id) return null;
  const target = el.ownerDocument?.getElementById(id);
  const text = target?.textContent?.trim();
  return text || null;
}

function ownTextOf(el: Element): string {
  // 只收集直接子文本节点，拿到的是元素"自己的"文字而非整个子树
  let text = '';
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) text += node.textContent ?? '';
    if (text.trim().length >= MAX_TEXT_LEN) break;
  }
  return text.trim();
}

/**
 * 后代文本（含直接文本，但调用时元素没有直接文本）。整段 / 整页文字不采用——那样命中的是
 * 页面主区域，名字会是正文开头几个字，反而不如「div 元素」好认。
 */
function nestedTextOf(el: Element): string | null {
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (!text || text.length > MAX_DESCENDANT_TEXT_LEN) return null;
  return text;
}

function clip(s: string): string {
  const t = s.trim().replace(/\s+/g, ' ');
  return t.length > MAX_TEXT_LEN ? `${t.slice(0, MAX_TEXT_LEN)}…` : t;
}
