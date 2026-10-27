/**
 * 标签页图标上传（#26）：原图大小限制与压缩尺寸计算。纯函数，canvas 绘制在管理页里做。
 *
 * 流程：检查原图（类型、≤5MB）→ createImageBitmap 解码 → 按 containRect 画进 32×32 透明画布 →
 * canvas.toDataURL('image/png') → 检查结果 < 20KB 且通过 core/validate 的 isSafeFaviconDataUrl。
 * 32×32 是 Chrome 在 2 倍屏上画 16px 标签页图标用的尺寸；PNG 最坏（随机噪点）约 4KB 原始像素，
 * base64 后也远低于 20KB。
 */

/** 原图上限：5MB（超过多半是照片原图，提示用户换小一点的图） */
export const MAX_ICON_SOURCE_BYTES = 5 * 1024 * 1024;
/** 压缩后的边长（像素） */
export const ICON_SIZE = 32;
/** 压缩结果 data URL 的长度上限（字符），远小于 validate 的 256KB 上限 */
export const MAX_ICON_DATA_URL_LENGTH = 20 * 1024;
/** 允许上传的原图类型（与文件选择框的 accept 一致） */
export const ICON_SOURCE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/x-icon',
  'image/vnd.microsoft.icon',
] as const;

export const ICON_ERROR = {
  type: '只支持 PNG、JPG、GIF、WebP、ICO 格式的图片',
  tooLarge: '图片太大了（超过 5MB），请换一张小一点的图片',
  decode: '这张图片打不开，请换一张 PNG 或 JPG 图片',
  encode: '图片处理失败，请换一张图片再试',
} as const;

/** 检查原图；通过返回 null，否则返回给用户看的话 */
export function checkIconSource(file: { size: number; type: string }): string | null {
  if (!(ICON_SOURCE_TYPES as readonly string[]).includes(file.type)) return ICON_ERROR.type;
  if (file.size > MAX_ICON_SOURCE_BYTES) return ICON_ERROR.tooLarge;
  return null;
}

/**
 * 把 w×h 的原图等比缩放、居中放进 size×size 的正方形（不裁切，留白处透明）。
 * 返回 drawImage 的目标矩形；原图尺寸非法时返回 null。
 */
export function containRect(
  w: number,
  h: number,
  size: number = ICON_SIZE,
): { dx: number; dy: number; dw: number; dh: number } | null {
  if (!(w > 0 && h > 0 && size > 0) || !Number.isFinite(w) || !Number.isFinite(h)) return null;
  const scale = Math.min(size / w, size / h);
  const dw = Math.max(1, Math.round(w * scale));
  const dh = Math.max(1, Math.round(h * scale));
  return { dx: Math.floor((size - dw) / 2), dy: Math.floor((size - dh) / 2), dw, dh };
}
