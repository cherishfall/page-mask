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
  settings: Pick<GlobalSettings, 'defaultTitle'>,
  url: string,
): string {
  // 图标三态（#121）摊成扁平字符串：对象不能直接进键（引用不同会让键恒变）
  const icon = profile.icon.kind + ':' + (profile.icon.kind === 'preset' ? profile.icon.id : '');
  return JSON.stringify([
    url,
    profile.switchState,
    // 「保存过标题和图标」变了也要重应用：从没设过 → 设过（标题突然生效），反向亦然（#98）
    profile.titleIconSet === true,
    profile.disguisedTitle,
    icon,
    // 「不显示胶囊」变了胶囊要从页面上消失 / 回来（#111）：它改的是按钮的存在性，
    // 响应式更新救不了——键里不计入的话 refreshState 会在「键没变」处提前返回，跳过 mountToggle
    profile.capsuleHidden === true,
    // 图片和视频变灰（0.8.0）改的是页面效果，键里不计入就会在「键没变」处提前返回，
    // 拨了开关页面不重应用
    profile.mediaGray === true,
    settings.defaultTitle,
    profile.hideRules.map(({ lastHealth: _h, lastHealthAt: _t, ...rest }) => rest),
  ]);
}
