/**
 * 方案C遮罩的颜色（REVIEW N25、#23）：遮罩要和它所在的位置融为一体——取被遮元素背后实际看到的底色。
 *
 * 做法：沿被遮元素的祖先链（不含元素自身：自己的背景正是要盖住的东西）由近到远找第一个不透明的
 * backgroundColor；途中的半透明层按普通 alpha 合成逐层叠到它上面；一直到根都没有不透明的，
 * 底色是页面画布：浅色为白，页面声明了深色配色（color-scheme）时 Chrome 的画布是 #121212。
 *
 * 这里只做纯计算，读 DOM 的部分在 ui/mask-color.ts（运行时遮罩与向导预览共用）。
 * 不处理背景图 / 渐变（只看 background-color）。
 */

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };
/** Chrome 深色配色下的默认画布色 */
const DARK_CANVAS: Rgba = { r: 18, g: 18, b: 18, a: 1 };

/**
 * 解析 getComputedStyle 输出的颜色：`rgb(r, g, b)`、`rgba(r, g, b, a)`、空格写法 `rgb(r g b / a)`、`transparent`。
 * 其他写法（页面用 oklch()、color() 声明时，Chrome 的计算值保留原写法）返回 null。
 */
export function parseCssColor(input: string): Rgba | null {
  const s = input.trim().toLowerCase();
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  const m = /^rgba?\(([^)]*)\)$/.exec(s);
  if (!m?.[1]) return null;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.length > 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [r = 0, g = 0, b = 0, a = 1] = parts;
  return { r, g, b, a };
}

function over(top: Rgba, base: Rgba): Rgba {
  const mix = (t: number, b: number) => t * top.a + b * (1 - top.a);
  return { r: mix(top.r, base.r), g: mix(top.g, base.g), b: mix(top.b, base.b), a: 1 };
}

function toCss({ r, g, b }: Rgba): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

/**
 * 遮罩颜色。chain：被遮元素各级祖先的计算背景色，由近到远（父元素在前，<html> 在最后）；
 * canvasDark：页面画布是否为深色（canvasIsDark）。返回不透明的 `rgb(…)`（或认不出的原写法）。
 */
export function resolveMaskColor(chain: readonly string[], canvasDark: boolean): string {
  const layers: Rgba[] = [];
  let base: Rgba | string = canvasDark ? DARK_CANVAS : WHITE;
  for (const raw of chain) {
    const c = parseCssColor(raw);
    if (!c) {
      // 认不出的写法基本都是作者显式写的实色：按不透明处理，无法与上面的半透明层合成，原样使用
      if (raw.trim()) return raw.trim();
      continue;
    }
    if (c.a >= 1) {
      base = c;
      break;
    }
    if (c.a > 0) layers.push(c);
  }
  // 从最远（最靠近底色）的半透明层开始往近处叠
  let result = base;
  for (let i = layers.length - 1; i >= 0; i--) result = over(layers[i]!, result);
  return toCss(result);
}

/**
 * 页面画布是否为深色。rootScheme：`<html>` 的计算 color-scheme；metaScheme：`<meta name="color-scheme">` 的内容；
 * prefersDark：系统是否深色。页面没声明（normal 且没有 meta）时画布永远是白的；
 * 声明了 `light dark` 时跟随系统；只声明 dark 时总是深色。CSS 的声明优先于 meta。
 */
export function canvasIsDark(rootScheme: string, metaScheme: string | null, prefersDark: boolean): boolean {
  const css = rootScheme.trim().toLowerCase();
  const declared = css && css !== 'normal' ? css : (metaScheme ?? '').trim().toLowerCase();
  const words = declared.split(/\s+/).filter(Boolean);
  const dark = words.includes('dark');
  const light = words.includes('light');
  if (!dark) return false;
  return light ? prefersDark : true;
}
