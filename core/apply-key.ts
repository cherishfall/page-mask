/**
 * 「要不要整页重新应用」的判据（#22，REVIEW N26）：把会影响页面效果的字段拼成一个键，
 * 存储变化后键没变就只更新悬浮按钮的显示，不重新同步样式、遮罩、标题。
 *
 * 不计入：体检回写（lastHealth / lastHealthAt）、悬浮按钮坐标、修改时间——它们变化时页面效果不变；
 * 尤其体检结果是本页自己写的，计入的话每次体检都会触发一轮重应用。
 * 计入页面地址：SPA 路由变化后生效范围要重新评估。
 */
import type { GlobalSettings, SiteProfile } from './types';

export function applyKey(
  profile: SiteProfile,
  settings: Pick<GlobalSettings, 'defaultTitle' | 'defaultIconDataUrl'>,
  url: string,
): string {
  return JSON.stringify([
    url,
    profile.switchState,
    profile.disguisedTitle,
    profile.faviconDataUrl,
    settings.defaultTitle,
    settings.defaultIconDataUrl,
    profile.hideRules.map(({ lastHealth: _h, lastHealthAt: _t, ...rest }) => rest),
  ]);
}
