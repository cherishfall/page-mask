/**
 * 标签页图标上传模块（entrypoints/management/tab-icon.ts）：
 * 用替身解码器覆盖每条错误分支——真实解码要 canvas，jsdom 里做不了。
 */
import { describe, expect, it, vi } from 'vitest';
import { fileToIconDataUrl, type DecodedIcon, type IconDecoder } from '@/entrypoints/management/tab-icon';
import { ICON_ERROR, ICON_SIZE, MAX_ICON_DATA_URL_LENGTH, MAX_ICON_SOURCE_BYTES } from '@/core/icon';

/** 一张最小的合法 PNG data URL（8 字节签名 + 少量数据，只求通过 isSafeFaviconDataUrl） */
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';

function file(size = 1024, type = 'image/png'): File {
  const f = new File(['x'], 'icon.png', { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

/** 替身解码器：记录拿到的矩形与是否被释放 */
function stubDecoder(
  over: Partial<DecodedIcon> & { dataUrl?: string; decodeResult?: DecodedIcon | null } = {},
): { decode: IconDecoder; rects: unknown[]; closed: () => boolean } {
  const rects: unknown[] = [];
  let closed = false;
  const decoded: DecodedIcon = {
    width: 200,
    height: 100,
    toPngDataUrl(rect) {
      rects.push(rect);
      return over.dataUrl ?? PNG;
    },
    close() {
      closed = true;
    },
    ...over,
  };
  const decode = vi.fn(async () => (over.decodeResult === undefined ? decoded : over.decodeResult)) as IconDecoder;
  return { decode, rects, closed: () => closed };
}

describe('fileToIconDataUrl：校验原图', () => {
  it('格式不对：返回 ICON_ERROR.type，且不解码', async () => {
    const { decode } = stubDecoder();
    const res = await fileToIconDataUrl(file(100, 'image/svg+xml'), decode);
    expect(res).toEqual({ ok: false, error: ICON_ERROR.type });
    expect(decode).not.toHaveBeenCalled();
  });

  it('超过 5MB：返回 ICON_ERROR.tooLarge，且不解码', async () => {
    const { decode } = stubDecoder();
    const res = await fileToIconDataUrl(file(MAX_ICON_SOURCE_BYTES + 1), decode);
    expect(res).toEqual({ ok: false, error: ICON_ERROR.tooLarge });
    expect(decode).not.toHaveBeenCalled();
  });
});

describe('fileToIconDataUrl：缩放与编码', () => {
  it('按 containRect 算出的矩形绘制，返回 data URL 并释放位图', async () => {
    const { decode, rects, closed } = stubDecoder();
    const res = await fileToIconDataUrl(file(), decode);
    expect(res).toEqual({ ok: true, dataUrl: PNG });
    expect(rects).toEqual([{ dx: 0, dy: 8, dw: 32, dh: 16 }]);
    expect(closed()).toBe(true);
  });

  it('自定义尺寸的图也能等比放进 32×32', async () => {
    const { decode, rects } = stubDecoder({ width: 16, height: 64 });
    await fileToIconDataUrl(file(), decode);
    expect(rects).toEqual([{ dx: 12, dy: 0, dw: 8, dh: ICON_SIZE }]);
  });

  it('尺寸非法（0 宽）：按打不开处理，不画', async () => {
    const { decode, rects, closed } = stubDecoder({ width: 0, height: 10 });
    const res = await fileToIconDataUrl(file(), decode);
    expect(res).toEqual({ ok: false, error: ICON_ERROR.decode });
    expect(rects).toHaveLength(0);
    expect(closed()).toBe(true);
  });
});

describe('fileToIconDataUrl：失败分支', () => {
  it('解码返回 null：ICON_ERROR.decode', async () => {
    const { decode } = stubDecoder({ decodeResult: null });
    expect(await fileToIconDataUrl(file(), decode)).toEqual({ ok: false, error: ICON_ERROR.decode });
  });

  it('解码抛错：ICON_ERROR.decode', async () => {
    const decode: IconDecoder = async () => {
      throw new Error('boom');
    };
    expect(await fileToIconDataUrl(file(), decode)).toEqual({ ok: false, error: ICON_ERROR.decode });
  });

  it('编码抛错：ICON_ERROR.encode，且仍然释放位图', async () => {
    const { decode, closed } = stubDecoder({
      toPngDataUrl() {
        throw new Error('canvas 坏了');
      },
    });
    expect(await fileToIconDataUrl(file(), decode)).toEqual({ ok: false, error: ICON_ERROR.encode });
    expect(closed()).toBe(true);
  });

  it('结果不是合法的图片 data URL：ICON_ERROR.encode（不把坏数据写进配置）', async () => {
    const { decode } = stubDecoder({ dataUrl: 'data:text/html;base64,PHNjcmlwdD4=' });
    expect(await fileToIconDataUrl(file(), decode)).toEqual({ ok: false, error: ICON_ERROR.encode });
  });

  it('结果超过长度上限：ICON_ERROR.encode', async () => {
    const { decode } = stubDecoder({ dataUrl: `${PNG}${'A'.repeat(MAX_ICON_DATA_URL_LENGTH)}` });
    expect(await fileToIconDataUrl(file(), decode)).toEqual({ ok: false, error: ICON_ERROR.encode });
  });
});
