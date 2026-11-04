/**
 * 停靠类悬浮控件（胶囊、幕布恢复按钮）的位置语义（#84）。
 *
 * 落库的 ButtonPos.x 只表达「贴哪一边」：≤ BUTTON_EDGE 视为左停靠，其余视为右停靠；
 * y 永远是顶边纵坐标。渲染按停靠边锚定（右停靠写 right），所以宽度变化（全功能 ↔ mini、
 * 恢复按钮显隐文字）时贴边不动——右停靠往右收、左停靠往左收，与 iOS/Android
 * AssistiveTouch、Edge 侧边气泡等浮窗「贴停靠边收放」的惯例一致。
 * 胶囊与幕布恢复按钮共用一个字段（floatingBtnPos），松手一律取最近边贴靠，锚定语义归一；
 * 否则恢复按钮拖到屏幕中间，胶囊会被带到半空。
 */

/** 离视口边缘至少留这么多（两个控件同一口径） */
export const BUTTON_EDGE = 8;

/** 存储的 x 是否表示左停靠 */
export function isLeftDock(x: number): boolean {
  return x <= BUTTON_EDGE;
}

/** 松手贴边：取最近边（按钮中心落在视口左半 → 贴左），返回落库用的边缘 x 坐标 */
export function snapXToEdge(x: number, width: number, viewportWidth: number): number {
  const onLeft = x + width / 2 <= viewportWidth / 2;
  return onLeft ? BUTTON_EDGE : Math.max(BUTTON_EDGE, viewportWidth - width - BUTTON_EDGE);
}

/** 纵向夹紧：顶边不小于边缘距、底边不出视口（x 由贴边锚定保证在视口内，只有 y 需要夹） */
export function clampEdgeY(y: number, height: number, viewportHeight: number): number {
  return Math.min(Math.max(BUTTON_EDGE, y), Math.max(BUTTON_EDGE, viewportHeight - height - BUTTON_EDGE));
}
