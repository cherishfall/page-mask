/**
 * 整页变灰（0.8.18，#156，ADR-0018 取代媒体灰路线）：确定性 CSS 文本 + 视频压制的纯判定。
 *
 * 演进史：0.7.x 灰块（收起图片/视频）→ 0.8.0 媒体灰（img/video 灰度 + 尺寸豁免）→
 * 0.8.16 背景图打标（ADR-0017）→ 0.8.18 整页灰。媒体路线的「某类图没灰」边界
 * （背景图、canvas、iframe、SVG）修了三轮仍不断冒新缺口；用户提案整页灰，实测采纳：
 * `html { filter: grayscale(1) !important }` 一条规则覆盖一切像素（背景图、canvas、
 * iframe 内容、SVG、视频），fixed 元素不脱锚（filter 挂根元素不产生 fixed 容纳块问题，
 * 实测滚动 top 恒 0），文字保持黑字可读。iOS/macOS 系统灰度同为先例。
 *
 * 代价（ADR-0018 登记）：本扩展自己的浮层（胶囊 / 菜单 / 向导 / 幕布）也在灰度站点上
 * 变黑白——祖先 filter 无法被子元素豁免，是 CSS 物理限制；状态仍靠形状 + 明度区分，
 * 功能不受损。≤32px 小图标豁免随媒体路线退场。
 *
 * 样式走既有的用户样式表通道（insertCSS origin USER + !important，ADR-0002），站点自己的
 * !important 抢不回去。这份文本并入 buildDisguiseCss 的正式样式：注入记录、bfcache、
 * 预渲染、storage 联动、向导临时还原全部沿用现成链路。
 *
 * 视频自动播放压制是内容脚本的 JS 行为（ui/media-controller.ts）：灰度管不住「动」，
 * 站点自己让视频播起来的一律按停，用户点了视频区域就放行那一个（画面保持黑白）。
 * 整页灰下视频画面本来就是黑的，「放行」只放行动、不改颜色。
 */
import type { SiteProfile } from './types';

/** 开关的键：三处界面共用同一份键清单，避免各写一份、口径分叉 */
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

/** 内容脚本媒体行为的开关入参（视频压制随它开合） */
export type MediaFlags = Pick<SiteProfile, 'mediaGray'>;

/**
 * 生成整页灰度 CSS；开关没开时返回 null。
 * 纯函数、不碰 DOM：后台 service worker 与内容脚本共用，文本相同才能按 prev→next 精确增删。
 * 只此一条规则：整页像素级去色，不再有任何按元素类型 / 尺寸的例外（0.8.18，#156）。
 */
export function buildMediaCss(_flags: MediaFlags): string | null {
  if (_flags.mediaGray !== true) return null;
  return 'html { filter: grayscale(1) !important; }';
}
