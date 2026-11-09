/**
 * 媒体变灰（0.8.0，#131，ADR-0013）：灰度样式的确定性文本 + 小图豁免的纯判定。
 *
 * 为什么是「灰度」而不是 0.7.x 的灰块，也不是 display:none / visibility:hidden：
 * - 产品所有者实测后的取舍（ADR-0013）：信息流里的图片大多是要看的内容，灰块把页面变成盲盒，
 *   「看 100 张图要点 100 下」；灰度保留构图与截图里的字（可读、可点、零交互），
 *   只去掉最抓眼球的色彩，整页从花花绿绿降到像一篇图文资料。
 * - 视频与图片同一条规则：封面帧 / 暂停首帧一起变灰；站点自动播放的压制是内容脚本的
 *   JS 行为（ui/media-controller.ts），CSS 只管画面。
 * - 纯 `filter: grayscale(1)` 走合成器、布局不动、链接可点穿、一条规则覆盖无限滚动新增的
 *   元素，且与明暗主题无关（不再需要 0.7.x 的深浅两套灰度）。
 *
 * 样式走既有的用户样式表通道（insertCSS origin USER + !important，ADR-0002），站点自己的
 * !important 抢不回去。这份文本并入 buildDisguiseCss 的正式样式：注入记录、bfcache、预渲染、
 * storage 联动、向导临时还原全部沿用现成链路。
 *
 * 边界（如实写给用户，不夸大）：这只是「看起来变灰」，请求照发。0.8.16（#154，ADR-0017）起
 * 背景图（CSS background-image）一并变灰——由内容脚本扫描打标记；iframe 内嵌播放器、canvas、
 * 内联 SVG 仍不变灰；声音完全不参与（ADR-0013）。
 * CSS 路线不需要任何新权限。
 */
import type { SiteProfile } from './types';

/** 媒体开关的键：三处界面共用同一份键清单，避免各写一份、口径分叉 */
export const MEDIA_FLAG_KEYS = ['mediaGray'] as const;
export type MediaFlagKey = (typeof MEDIA_FLAG_KEYS)[number];
export type MediaToggles = Pick<SiteProfile, MediaFlagKey>;

/** 开关对应的那句白话说明（站点设置页行下显示；弹窗只留一行总说明） */
export const MEDIA_HINT_KEYS = {
  mediaGray: 'mediaGrayHint',
} as const satisfies Record<MediaFlagKey, string>;

/**
 * 拨动开关时只改那一个字段。关掉写 undefined（字段从存储里消失），
 * 与 sanitizeProfile「显式 true 才落字段」同口径——不留一个要额外解释的 false。
 * 三处界面 + 内容脚本共用，避免各自写一套。
 */
export function mediaFlagPatch(key: MediaFlagKey, on: boolean): Partial<MediaToggles> {
  return { [key]: on ? true : undefined } as Partial<MediaToggles>;
}

/** 内容脚本媒体行为的开关入参（视频压制、小图豁免都随它开合） */
export type MediaFlags = Pick<SiteProfile, 'mediaGray'>;

/** 内容脚本给「不变灰的小图」打的属性；CSS 选择器据此放行 */
export const MEDIA_KEEP_ATTR = 'data-pm-media-keep';

/**
 * 内容脚本给「有背景图（CSS background-image 带 url）的元素」打的属性（0.8.16，#154）。
 * 多抓鱼等站点的书封 / 封面全走背景图，纯 img/video 选择器盖不住（ADR-0017 收窄这个边界）；
 * 内容脚本扫描后打标记，CSS 据此灰度。豁免（小图 / 表情 / 自家 UI）同样打 MEDIA_KEEP_ATTR 放行。
 */
export const MEDIA_BG_ATTR = 'data-pm-media-bg';

/** 渲染尺寸 ≤32px 的图标、表情不变灰（HoverBlurr / 电子书模式的做法：页面自己的按钮不跟着变） */
export const SMALL_MEDIA_MAX_PX = 32;

/**
 * 图片选择器：把明显是表情 / 小图标来源的图也直接放行，减轻内容脚本的标记负担。
 * 多个 :not() 串联而不是 :not(a, b) 列表——后者要 Selectors 4，串联在旧内核上也稳。
 * `i` 标志让 class="Emoji"、alt="EMOJI" 一并命中。
 * 末段是背景图元素（#154）：带 MEDIA_BG_ATTR 且未被豁免的才灰。
 */
const IMG_SELECTOR =
  `img:not([${MEDIA_KEEP_ATTR}])` +
  ':not([class*="emoji" i]):not([alt*="emoji" i]):not([src*="emoji" i])';

/**
 * 生成媒体灰度 CSS；开关没开时返回 null。
 * 纯函数、不碰 DOM：后台 service worker 与内容脚本共用，文本相同才能按 prev→next 精确增删。
 */
export function buildMediaCss(flags: MediaFlags): string | null {
  if (flags.mediaGray !== true) return null;
  return `${IMG_SELECTOR}, video, [${MEDIA_BG_ATTR}]:not([${MEDIA_KEEP_ATTR}]) { filter: grayscale(1) !important; }`;
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
 * 该不该放行（= 不变灰）。只有「能确定它很小」才放行：
 * 尺寸未知时返回 false，先按灰图处理，等 load 事件后重新判定——宁可多灰一帧，也不让大图露出来。
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
