/**
 * 元素自动命名（design.md 数据模型）：无障碍标签 > 元素文本前几字 > 位置描述。
 * 面向不懂 CSS 的用户，名字必须是人话。
 */

const TAG_NAMES: Record<string, string> = {
  nav: '导航栏',
  header: '页头',
  footer: '页脚',
  aside: '侧栏',
  main: '主内容区',
  form: '表单',
  button: '按钮',
  search: '搜索框',
  video: '视频',
  audio: '音频',
  canvas: '画布',
};

const MAX_TEXT_LEN = 8;

export function describeElement(el: Element): string {
  // 1. 无障碍标签
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim()) return clip(ariaLabel);

  const ariaLabelledByText = ariaLabelledby(el);
  if (ariaLabelledByText) return clip(ariaLabelledByText);

  // 2. 语义化标签 → 位置描述（如"顶部导航栏"的"导航栏"部分）
  const tag = el.tagName.toLowerCase();
  if (TAG_NAMES[tag]) return TAG_NAMES[tag];

  // 3. 图像的替代文本
  if (tag === 'img') {
    const alt = el.getAttribute('alt');
    if (alt && alt.trim()) return `图片：${clip(alt)}`;
  }

  // 4. 表单控件的占位/值
  if (tag === 'input' || tag === 'textarea') {
    const placeholder = el.getAttribute('placeholder');
    if (placeholder && placeholder.trim()) return clip(placeholder);
  }

  // 5. 元素自身文本前几字（只看直接文本，避免抓到整页内容）
  const ownText = ownTextOf(el);
  if (ownText) return clip(ownText);

  // 6. 兜底：标签名
  return `${tag} 元素`;
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

function clip(s: string): string {
  const t = s.trim().replace(/\s+/g, ' ');
  return t.length > MAX_TEXT_LEN ? `${t.slice(0, MAX_TEXT_LEN)}…` : t;
}
