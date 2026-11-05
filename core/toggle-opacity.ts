/**
 * 胶囊闲置不透明度（#102 三档 → #110 滑杆：10%–100%，步长 10%）。
 *
 * 整颗按钮一起淡——文字与底色的透明度相同，两者的相对亮度差按同一比例缩小，
 * 所以「文字压在自己的底色上」的对比度仍然稳定；只淡底色、不淡文字会在大片上变糊。
 *
 * 无障碍口径（#110 定案，登记于 docs/design-ui.md，成熟产品同类做法：
 * iOS 辅助触控 / OPPO 悬浮球都用一根滑杆调「闲置不透明度」，一碰回到 100%）：
 * - 100% 时文字对比度 ≥4.5:1（最差页面底色：纯白与纯黑，tests/toggle-opacity.test.ts 守住）；
 * - 更低的档位是「闲置可见度」：悬停 / 键盘聚焦 / 拖动时回到 100%（ui/toggle/toggle.css），
 *   那一刻满足对比度；闲置时不要求每档 ≥4.5——10% 约 1.2:1，是用户主动选择的可见度；
 * - forced-colors 下强制 100%（ui/toggle/toggle.css 已有规则）。
 * 控件边框在 100% 以下会跌破 3:1——已知例外：按钮仍有文字标签与阴影轮廓可辨认。
 */
export const TOGGLE_OPACITY_MIN = 0.1;
export const TOGGLE_OPACITY_MAX = 1;
export const TOGGLE_OPACITY_STEP = 0.1;
export const DEFAULT_TOGGLE_OPACITY = 1;

/** 旧三档（#102 的字符串档位）的迁移映射：旧存储 / 旧导出文件里可能还是字符串 */
const LEGACY_LEVELS: Record<string, number> = {
  full: 1,
  soft: 0.9, // 旧 0.85 不在 10% 网格上，取整归到 0.9
  faint: 0.7,
};

/**
 * 归一化到合法档位：
 * - 旧三档字符串按上表迁移；
 * - 数值夹到 0.1–1 并取整到一位小数（10% 网格）；
 * - 其余（坏值 / 缺失）回默认 1。
 */
export function normalizeToggleOpacity(v: unknown): number {
  if (typeof v === 'string' && v in LEGACY_LEVELS) return LEGACY_LEVELS[v]!;
  if (typeof v === 'number' && Number.isFinite(v)) {
    const clamped = Math.min(TOGGLE_OPACITY_MAX, Math.max(TOGGLE_OPACITY_MIN, v));
    return Math.round(clamped * 10) / 10;
  }
  return DEFAULT_TOGGLE_OPACITY;
}
