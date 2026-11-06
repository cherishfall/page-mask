import { describe, expect, it } from 'vitest';
// @ts-ignore 项目不装 @types/node；vitest 跑在 Node 里，node:zlib 可用
import { inflateSync } from 'node:zlib';
import { iconHref, TRANSPARENT_PNG } from './icon';
import { PRESET_ICONS } from './icon-presets';
import { ICON_PRESET_IDS } from './types';

/**
 * 最小 PNG 解码：只支持本项目图标用到的 8 位 RGBA、非隔行格式。
 * 拼接全部 IDAT → zlib 解压 → 按行去掉 filter（仅 None/Sub/Up）→ RGBA 像素。
 */
function decodeRgbaPng(dataUrl: string): { width: number; height: number; pixels: Uint8Array } {
  const bin = atob(dataUrl.replace(/^data:image\/png;base64,/, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  expect(Array.from(bytes.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  let width = 0;
  let height = 0;
  const idat: number[] = [];
  for (let off = 8; off < bytes.length; ) {
    const len = view.getUint32(off);
    const type = String.fromCharCode(...bytes.slice(off + 4, off + 8));
    const data = bytes.slice(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = view.getUint32(off + 8);
      height = view.getUint32(off + 12);
      expect([data[8], data[9], data[12]]).toEqual([8, 6, 0]); // 8 位深、RGBA、非隔行
    } else if (type === 'IDAT') idat.push(...data);
    off += 12 + len;
  }
  const raw = new Uint8Array(inflateSync(Uint8Array.from(idat)));
  const stride = width * 4;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x]!;
      const left = x >= 4 ? pixels[y * stride + x - 4]! : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x]! : 0;
      const upLeft = y > 0 && x >= 4 ? pixels[(y - 1) * stride + x - 4]! : 0;
      if (filter === 0) pixels[y * stride + x] = v;
      else if (filter === 1) pixels[y * stride + x] = (v + left) & 255;
      else if (filter === 2) pixels[y * stride + x] = (v + up) & 255;
      else if (filter === 3) pixels[y * stride + x] = (v + ((left + up) >> 1)) & 255;
      else if (filter === 4) {
        // Paeth
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        const pred = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        pixels[y * stride + x] = (v + pred) & 255;
      } else throw new Error(`测试解码器不支持 PNG filter ${filter}`);
    }
  }
  return { width, height, pixels };
}

describe('不显示图标用的 TRANSPARENT_PNG', () => {
  it('解码后每个像素 alpha=0（真正全透明，不是半透明色块）', () => {
    const { width, height, pixels } = decodeRgbaPng(TRANSPARENT_PNG);
    expect(width * height).toBeGreaterThan(0);
    expect(pixels).toHaveLength(width * height * 4);
    for (let i = 3; i < pixels.length; i += 4) expect(pixels[i]).toBe(0);
  });
});

describe('iconHref：三态 → <link rel=icon> 的 href', () => {
  it('site = 不接管（null）', () => {
    expect(iconHref({ kind: 'site' })).toBeNull();
  });

  it('none = 全透明 PNG（图标位留空）', () => {
    expect(iconHref({ kind: 'none' })).toBe(TRANSPARENT_PNG);
  });

  it('preset = 对应的内置图标 data URL', () => {
    for (const id of ICON_PRESET_IDS) {
      expect(iconHref({ kind: 'preset', id })).toBe(PRESET_ICONS[id]);
      expect(PRESET_ICONS[id].startsWith('data:image/png;base64,')).toBe(true);
    }
    // 10 个题材各不相同，没有漏生成 / 复制粘贴
    expect(new Set(Object.values(PRESET_ICONS)).size).toBe(ICON_PRESET_IDS.length);
  });

  it('内置图标就是 32×32 的 RGBA PNG（16px 标签栏按 2 倍屏取用）', () => {
    for (const id of ICON_PRESET_IDS) {
      const { width, height, pixels } = decodeRgbaPng(PRESET_ICONS[id]);
      expect([width, height]).toEqual([32, 32]);
      // 不是全透明：至少有一个不透明像素
      let opaque = 0;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i]! > 0) opaque++;
      expect(opaque).toBeGreaterThan(0);
    }
  });
});
