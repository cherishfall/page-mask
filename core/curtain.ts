/**
 * 幕布的纯逻辑（#45，design.md「幕布」一节，ADR-0007）：
 *
 * 1. 恢复分支的决策——进入幕布前的开关态决定「恢复」时怎么还原标题与图标。
 *    一律调 TitleFaviconGuard.restore() 会把真实标题放出来，进入前是清爽态时当场露馅。
 * 2. 幕布底色——取页面自己的画布底色（html / body 上第一个不透明的 background-color），
 *    取不到时浅色用白、深色用近黑（与 core/mask-color.ts 的画布兜底同一套值）。
 *    固定白屏在深色页面上会一眼暴露「这不是这个页面」。
 *
 * 这里只做纯计算：读 DOM 的部分在 ui/mask-color.ts，覆盖层本体在 ui/curtain.ts。
 */
import type { GlobalSettings, SiteProfile } from './types';
import { parseCssColor, resolveMaskColor } from './mask-color';
import { effectiveTitle } from './titles';

/** 幕布「恢复」时对标题与图标要做的动作 */
export type CurtainRestoreAction = 'disguise' | 'real';

/**
 * 幕布恢复按钮的拖动阈值（像素，欧氏距离）：按下到松手的位移超过它算拖动，
 * 否则算点击。4px 是触控 / 手抖与「真的想拖」之间的常用分界。
 */
export const CURTAIN_DRAG_THRESHOLD_PX = 4;

/** 按下到松手移动了 (dx, dy)：是拖动（true）还是点击（false） */
export function isCurtainDrag(dx: number, dy: number, threshold = CURTAIN_DRAG_THRESHOLD_PX): boolean {
  return Math.hypot(dx, dy) > threshold;
}

/**
 * 遮住时的标签页标题：站点自己配了标题就用它——**待授权的站点**（有配置、权限被收回，
 * popup 只能走一次性脚本）也必须用它自己的标题，不能落到全局默认（#50）。
 * 没有站点配置（从没添加过）时才是 全局默认 > 界面语言默认。
 */
export function curtainTitle(
  profile: Pick<SiteProfile, 'disguisedTitle'> | null,
  settings: Pick<GlobalSettings, 'defaultTitle'> | null | undefined,
  uiLanguage?: string | null,
): string {
  return effectiveTitle({ disguisedTitle: profile?.disguisedTitle ?? null }, settings, uiLanguage);
}

/**
 * 恢复分支（#45，最容易写错的地方）：按**进入幕布前**的开关态决定——
 * 进入前是清爽态 → 回到清爽标题与图标（guard.apply(effectiveTitle(...), ...)）；
 * 进入前是原样态 → 才还原真实标题与图标（guard.restore()）。
 */
export function curtainRestoreAction(stateAtEntry: SiteProfile['switchState']): CurtainRestoreAction {
  return stateAtEntry === 'disguised' ? 'disguise' : 'real';
}

/**
 * 幕布底色：html、body 上第一个不透明的 background-color（html 在先——画布就是根元素的背景，
 * 根透明时 body 的背景才成为画布）。半透明 / 透明都算「取不到」，继续往下找；
 * 认不出的写法（oklch() 等，计算值保留原写法）基本都是作者显式写的实色，按不透明处理、原样使用
 * （与 core/mask-color.ts resolveMaskColor 的口径一致）。都取不到时按画布兜底：浅色白、深色近黑。
 */
export function curtainColor(htmlBg: string, bodyBg: string, canvasDark: boolean): string {
  for (const raw of [htmlBg, bodyBg]) {
    const c = parseCssColor(raw);
    if (c) {
      if (c.a >= 1) return raw.trim();
      continue;
    }
    if (raw.trim()) return raw.trim();
  }
  return resolveMaskColor([], canvasDark); // 画布兜底：rgb(255, 255, 255) / rgb(18, 18, 18)
}
