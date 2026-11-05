/**
 * 胶囊不透明度三档（#102）。
 *
 * 整颗按钮一起淡——文字与底色的透明度相同，两者的相对亮度差按同一比例缩小，
 * 所以「文字压在自己的底色上」的对比度仍然稳定；只淡底色、不淡文字会在大片上变糊。
 *
 * 数值按 tokens 的浅色值实算（最差页面底色：纯白与纯黑）：
 *   100% → 文字最差 ≈ 15.8:1
 *    85% → 文字最差 ≈ 9.8:1
 *    70% → 文字最差 ≈ 5.9:1   （三档均 ≥ 4.5）
 * 控件边框在 100% 以下会跌破 3:1——这是已知例外：按钮仍有文字标签与阴影轮廓可辨认，
 * 登记在 styles/tokens.css 的说明里，并由 tests/toggle-opacity.test.ts 守住文字这一条。
 */
export const TOGGLE_OPACITY = {
  full: 1,
  soft: 0.85,
  faint: 0.7,
} as const;

export type ToggleOpacity = keyof typeof TOGGLE_OPACITY;

export const TOGGLE_OPACITY_LEVELS = ['full', 'soft', 'faint'] as const;

export function isToggleOpacity(v: unknown): v is ToggleOpacity {
  return typeof v === 'string' && (TOGGLE_OPACITY_LEVELS as readonly string[]).includes(v);
}
