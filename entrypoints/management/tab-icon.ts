/**
 * 标签页图标上传（#26 定的规则，在这里落地）：文件 → 32×32 的 PNG data URL。
 *
 * 流程：`checkIconSource`（格式、≤5MB）→ 解码 → `containRect` 等比放进 32×32 透明画布 →
 * `toDataURL('image/png')` → 长度与 `isSafeFaviconDataUrl` 再校一次。
 * 解码与绘制是唯一依赖浏览器的两步，抽成可替换的 `IconDecoder`：单测用替身覆盖每条错误分支，
 * 页面只拿结果、把 `error` 原样显示（文案全部来自 core/icon.ts 的 ICON_ERROR）。
 *
 * 只能跑在扩展页面（管理页）：popup 会在文件选择框打开时被销毁。
 */
import { checkIconSource, containRect, ICON_ERROR, ICON_SIZE, MAX_ICON_DATA_URL_LENGTH } from '@/core/icon';
import { isSafeFaviconDataUrl } from '@/core/validate';

/** 画进正方形的目标矩形（core/icon.ts 的 containRect 结果） */
export interface IconRect {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

/** 解码后的一张图：能画进正方形，用完能释放 */
export interface DecodedIcon {
  width: number;
  height: number;
  /** 把 rect 区域画进 size×size 的透明画布，返回 PNG data URL */
  toPngDataUrl(rect: IconRect, size: number): string;
  close(): void;
}

/** 解码器：打不开时返回 null（不抛错，错误文案统一在下面挑） */
export type IconDecoder = (file: Blob) => Promise<DecodedIcon | null>;

export type IconResult = { ok: true; dataUrl: string } | { ok: false; error: string };

/** 文件 → 可以直接存进站点配置的 data URL */
export async function fileToIconDataUrl(file: File, decode: IconDecoder = decodeWithCanvas): Promise<IconResult> {
  const bad = checkIconSource(file);
  if (bad) return { ok: false, error: bad };

  let image: DecodedIcon | null = null;
  try {
    image = await decode(file);
  } catch {
    image = null;
  }
  if (!image) return { ok: false, error: ICON_ERROR.decode };

  try {
    const rect = containRect(image.width, image.height, ICON_SIZE);
    if (!rect) return { ok: false, error: ICON_ERROR.decode };
    const dataUrl = image.toPngDataUrl(rect, ICON_SIZE);
    if (dataUrl.length > MAX_ICON_DATA_URL_LENGTH || !isSafeFaviconDataUrl(dataUrl)) {
      return { ok: false, error: ICON_ERROR.encode };
    }
    return { ok: true, dataUrl };
  } catch {
    return { ok: false, error: ICON_ERROR.encode };
  } finally {
    image.close();
  }
}

/** 真实解码：createImageBitmap 解码 → canvas 缩放 → toDataURL */
const decodeWithCanvas: IconDecoder = async (file) => {
  const bitmap = await createImageBitmap(file);
  return {
    width: bitmap.width,
    height: bitmap.height,
    toPngDataUrl(rect, size) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('拿不到画布上下文');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, rect.dx, rect.dy, rect.dw, rect.dh);
      return canvas.toDataURL('image/png');
    },
    close: () => bitmap.close(),
  };
};
