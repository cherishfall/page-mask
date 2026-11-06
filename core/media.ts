/**
 * 媒体收起（#116）：灰块样式的确定性文本 + 小图豁免的纯判定。
 *
 * 为什么是「灰块」而不是 display:none / visibility:hidden：
 * - 调研存档 docs/dev/research-media-hiding.md：微博 / X / Reddit / Telegram 的「无图模式」都是
 *   不加载 + 灰色占位保布局；空洞与裂图是同类扩展的两大差评形态。
 * - `filter: brightness(0) invert(N)` 把任意图片 / 视频压成均匀灰，布局不动、链接可点穿、
 *   走合成器、一条规则覆盖无限滚动新增的元素——不需要逐元素遮罩。
 * - 叠加 `background-color` 让透明 PNG 也落成一整块灰，而不是只剩一层灰色轮廓。
 *
 * 样式走既有的用户样式表通道（insertCSS origin USER + !important，ADR-0002），站点自己的
 * !important 抢不回去。这份文本并入 buildDisguiseCss 的正式样式：注入记录、bfcache、预渲染、
 * storage 联动、向导临时还原全部沿用现成链路。
 *
 * 边界（如实写给用户，不夸大）：这只是「看起来收起」，请求照发；background-image、
 * iframe 内嵌播放器、canvas、内联 SVG 本期不收；CSS 路线不需要任何新权限。
 */
import type { SiteProfile } from './types';

/** 三个开关的键：界面三处渲染同一组开关时用它，避免各写一份清单、漏掉某一个或换了顺序 */
export const MEDIA_FLAG_KEYS = ['hideImages', 'hideVideos', 'mutePage'] as const;
export type MediaFlagKey = (typeof MEDIA_FLAG_KEYS)[number];
export type MediaToggles = Pick<SiteProfile, MediaFlagKey>;

/** 每个开关对应的那句白话说明（站点设置页逐行显示；弹窗只留一行总说明） */
export const MEDIA_HINT_KEYS = {
  hideImages: 'hideImagesHint',
  hideVideos: 'hideVideosHint',
  mutePage: 'mutePageHint',
} as const satisfies Record<MediaFlagKey, string>;

/**
 * 拨动一个开关时只改那一个字段。关掉写 undefined（字段从存储里消失），
 * 与 sanitizeProfile「显式 true 才落字段」同口径——不留一个要额外解释的 false。
 * 三处界面 + 内容脚本共用，避免各自写一套。
 */
export function mediaFlagPatch(key: MediaFlagKey, on: boolean): Partial<MediaToggles> {
  return { [key]: on ? true : undefined } as Partial<MediaToggles>;
}

/** 三个开关里只影响页面媒体的两个（静音由后台单独对账） */
export type MediaFlags = Pick<SiteProfile, 'hideImages' | 'hideVideos'>;

/** 内容脚本给「不收起的小图」打的属性；CSS 选择器据此放行 */
export const MEDIA_KEEP_ATTR = 'data-pm-media-keep';

/** 渲染尺寸 ≤32px 的图标、表情不收（HoverBlurr / 微博无图模式的做法） */
export const SMALL_MEDIA_MAX_PX = 32;

/** 浅色页面与深色页面各一套灰度：prefers-color-scheme 是 Chrome 116 就支持的稳妥判据 */
const LIGHT_GRAY = '#d1d1d1';
const LIGHT_INVERT = 0.82; // 255 × 0.82 ≈ 209 = #d1d1d1
const DARK_GRAY = '#3a3a3a';
const DARK_INVERT = 0.23; // 255 × 0.23 ≈ 59 = #3b3b3b

/**
 * 图片选择器：把明显是表情 / 小图标来源的图也直接放行，减轻内容脚本的标记负担。
 * 多个 :not() 串联而不是 :not(a, b) 列表——后者要 Selectors 4，串联在旧内核上也稳。
 * `i` 标志让 class="Emoji"、alt="EMOJI" 一并命中。
 */
const IMG_SELECTOR =
  `img:not([${MEDIA_KEEP_ATTR}])` +
  ':not([class*="emoji" i]):not([alt*="emoji" i]):not([src*="emoji" i])';

function declarations(gray: string, invert: number): string {
  return `background-color: ${gray} !important; filter: brightness(0) invert(${invert}) !important;`;
}

/**
 * 生成媒体灰块 CSS；两个开关都没开时返回 null。
 * 纯函数、不碰 DOM：后台 service worker 与内容脚本共用，文本相同才能按 prev→next 精确增删。
 */
export function buildMediaCss(flags: MediaFlags): string | null {
  const selectors: string[] = [];
  if (flags.hideImages === true) selectors.push(IMG_SELECTOR);
  if (flags.hideVideos === true) selectors.push('video');
  if (selectors.length === 0) return null;
  const sel = selectors.join(', ');
  return [
    `${sel} { ${declarations(LIGHT_GRAY, LIGHT_INVERT)} }`,
    `@media (prefers-color-scheme: dark) { ${sel} { ${declarations(DARK_GRAY, DARK_INVERT)} } }`,
  ].join('\n');
}

/** 判定「小图」所需的尺寸与属性快照：DOM 采集在内容脚本，判定留在这里便于单测 */
export interface MediaSizeFacts {
  /** 实际渲染尺寸（getBoundingClientRect / clientWidth） */
  renderedWidth?: number;
  renderedHeight?: number;
  /** HTML width / height 属性（图片还没加载时的线索） */
  widthAttr?: number;
  heightAttr?: number;
  /** 已加载资源的原始尺寸 */
  naturalWidth?: number;
  naturalHeight?: number;
  className?: string;
  alt?: string;
  src?: string;
}

/**
 * 该不该放行（= 不收起）。只有「能确定它很小」才放行：
 * 尺寸未知时返回 false，先按灰块处理，等 load 事件后重新判定——宁可多灰一帧，也不让大图露出来。
 */
export function shouldKeepMedia(facts: MediaSizeFacts): boolean {
  const text = `${facts.className ?? ''} ${facts.alt ?? ''} ${facts.src ?? ''}`.toLowerCase();
  if (text.includes('emoji')) return true;
  const candidates: [number | undefined, number | undefined][] = [
    [facts.renderedWidth, facts.renderedHeight],
    [facts.widthAttr, facts.heightAttr],
    [facts.naturalWidth, facts.naturalHeight],
  ];
  for (const [w, h] of candidates) {
    if (typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0) {
      return w <= SMALL_MEDIA_MAX_PX && h <= SMALL_MEDIA_MAX_PX;
    }
  }
  return false;
}
