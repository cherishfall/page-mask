/**
 * 标签页图标三态（#121）：纯逻辑，图片本体放在 core/icon-presets.ts。
 *
 * 三种取值各自对应「要不要接管 `<link rel="icon">`」：
 * - site：完全不接管，网站自己的图标（含 SPA 换页时改的那张）保持原样；
 * - none：写一张 1×1 真正全透明的 PNG，图标位留空；
 * - preset：写内置图标的 data URL。
 *
 * 图标是页面里的 `<link href>`，必须是 data URL：不能指向扩展包内资源
 * （那需要 web_accessible_resources，等于让任何站点都能探测到扩展）。
 */
import type { TabIcon } from './types';
import { PRESET_ICONS } from './icon-presets';

/**
 * 不显示图标用的 1×1 真正全透明 PNG（RGBA 全 0，单测解码校验）。图片能正常加载，
 * Chrome 就照常显示它——全透明即标签页图标位留空（不会变成地球；地球只在没有图标或加载失败时出现）。
 * 不使用、也不复刻任何浏览器自带图标。
 */
export const TRANSPARENT_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=';

/**
 * 三态 → 实际要写进 `<link rel="icon">` 的 href。
 * 返回 null 表示**不接管**图标（网站原来的图标）；调用方必须据此跳过图标相关的 DOM 操作。
 */
export function iconHref(icon: TabIcon): string | null {
  switch (icon.kind) {
    case 'site':
      return null;
    case 'preset':
      return PRESET_ICONS[icon.id] ?? TRANSPARENT_PNG;
    case 'none':
    default:
      return TRANSPARENT_PNG;
  }
}
