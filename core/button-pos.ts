/**
 * 悬浮控件（胶囊、幕布恢复按钮）的位置语义（0.8.6 起自由定位，#135）。
 *
 * ButtonPos = 控件左上角在视口内的绝对坐标：x、y 都由拖动或方向键决定，落库前夹进视口；
 * 渲染一律写 left/top。0.8.5 及以前的「贴边停靠」（x 表停靠边、右停靠渲染 right）退场——
 * 旧数据里的 x 本就是当时的左上角坐标，直接沿用；贴右缘的胶囊升级后会停在原绝对位置
 * （窗口拉宽不再跟边），拖一下即归位。
 */

/** 离视口边缘至少留这么多（两个控件同一口径） */
export const BUTTON_EDGE = 8;

/** 视口内夹紧：左上角不出视口（右/下边留出控件本体与边缘距） */
export function clampPos(
  x: number,
  y: number,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number } {
  const clamp1 = (v: number, size: number, viewport: number): number =>
    Math.min(Math.max(BUTTON_EDGE, v), Math.max(BUTTON_EDGE, viewport - size - BUTTON_EDGE));
  return { x: clamp1(x, width, viewportWidth), y: clamp1(y, height, viewportHeight) };
}

/** 纵向夹紧：等价 clampPos 的 y 分量（幕布恢复按钮的 x 在拖动中已夹紧，窗口 resize 只需重夹 y） */
export function clampEdgeY(y: number, height: number, viewportHeight: number): number {
  return Math.min(Math.max(BUTTON_EDGE, y), Math.max(BUTTON_EDGE, viewportHeight - height - BUTTON_EDGE));
}
