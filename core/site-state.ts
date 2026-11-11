/**
 * 一个网站的设置与「按你的设置显示」这个开关的关系（#158）。
 *
 * 三处开关（弹窗面具卡 / 悬浮胶囊主按钮 / 站点设置页页头）都要回答同一个问题：
 * 打开这个开关之后，页面上到底会不会有变化？判据只有一份，放在这里，三处共用——
 * 以前三个地方各算各的（`hasSiteSettings` / `hasProfile` / profile 是否存在），
 * 才会出现「没有任何标题和收起内容设置时也能打开开关，页面却毫无变化」。
 *
 * 判据**只算主开关管得到的三样**：
 * - 收起的内容（`hideRules`）
 * - 标签页标题和图标（`titleIconSet`；只改图标时这个标记也会置位，见 entrypoints/management/store.ts）
 * - 保存过的标签页标题（`disguisedTitle`，沿用 sanitize 的推导口径兜底）
 *
 * **不含 `mediaGray`**：整页变灰有自己的开关，切原样也照常生效（0.8.3 / ADR-0014），
 * 把它算进来会让「只有灰度」的网站错误地显示「打开后页面不变」。
 * **不含 `capsuleHidden`**：那只是「页面上要不要显示悬浮按钮」，不是开关管的东西。
 */
import type { SiteProfile } from './types';

/** 判据需要的字段（只读三样，调用方传整份配置也满足） */
export type SwitchScopedProfile = Pick<SiteProfile, 'hideRules' | 'titleIconSet' | 'disguisedTitle'>;

/**
 * 打开「按你的设置显示」之后，这个页面会不会有变化。
 * false = 只有灰度、或者四项全空：此时拨主开关零可见变化，界面要说一句「打开后页面不变」。
 */
export function hasSwitchEffect(p: SwitchScopedProfile): boolean {
  return p.hideRules.length > 0 || p.titleIconSet === true || !!p.disguisedTitle;
}
