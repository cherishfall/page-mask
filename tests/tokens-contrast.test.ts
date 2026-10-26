// @vitest-environment node
/**
 * 设计 tokens 对比度守门（#33）。纯计算，不需要 DOM，用 node 环境。
 * 解析 styles/tokens.css 中的原始色值（--pm-<名>-light/-dark）和注释里的对比度表，
 * 按 WCAG 2.x 相对亮度公式复算：
 *   - 每一行都必须达到该行标注的门槛（正文 4.5，非文字 3）
 *   - 注释里写的数字必须与实算一致（保留两位小数），防止改了色值忘记更新注释
 *   - 必须覆盖的关键组合不能从表里漏掉
 */
// 直接用 Node 读文件：vitest 默认不处理 CSS，`?raw` 导入 .css 会得到空串。
// 项目未安装 @types/node，这里只需要 readFileSync 一个函数，用 ts-ignore 收窄影响面。
// @ts-ignore -- node:fs 无类型声明
import { readFileSync } from 'node:fs';

const css: string = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');

type Scheme = 'light' | 'dark';

function parsePalette(): Record<Scheme, Map<string, string>> {
  const palette = { light: new Map<string, string>(), dark: new Map<string, string>() };
  for (const m of css.matchAll(/--pm-([a-z-]+?)-(light|dark):\s*(#[0-9a-f]{6})\s*;/gi)) {
    const [, name = '', scheme, hex = ''] = m;
    palette[scheme as Scheme].set(name, hex.toLowerCase());
  }
  return palette;
}

interface Row {
  fg: string;
  bg: string;
  light: number;
  dark: number;
  min: number;
}

function parseTable(): Row[] {
  const rows: Row[] = [];
  const re = /^\s*\*\s+([a-z-]+)\s+on\s+([a-z-]+)\s+浅\s+([\d.]+)\s+深\s+([\d.]+)\s+≥([\d.]+)\s*$/gm;
  for (const m of css.matchAll(re)) {
    const [, fg = '', bg = '', light, dark, min] = m;
    rows.push({ fg, bg, light: Number(light), dark: Number(dark), min: Number(min) });
  }
  return rows;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const palette = parsePalette();
const table = parseTable();

describe('tokens 对比度', () => {
  it('公式自检：黑白 21:1，同色 1:1', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#2563eb', '#2563eb')).toBe(1);
  });

  it('浅色、深色两套原始色值成对出现', () => {
    expect(palette.light.size).toBeGreaterThan(0);
    expect([...palette.light.keys()].sort()).toEqual([...palette.dark.keys()].sort());
  });

  it('关键组合都在对比度表中', () => {
    const listed = new Set(table.map((r) => `${r.fg}/${r.bg}`));
    const required = [
      'fg/bg',
      'fg/bg-subtle',
      'fg-muted/bg',
      'fg-muted/bg-subtle',
      'accent/bg',
      'on-accent/accent',
      'on-accent/accent-hover',
      'danger/bg',
      'on-danger/danger',
      'warning/bg',
      'on-warning/warning',
      'success/bg',
      'on-success/success',
      'border-control/bg',
      'border-control/bg-subtle',
    ];
    for (const key of required) expect(listed, key).toContain(key);
  });

  for (const row of table) {
    for (const scheme of ['light', 'dark'] as const) {
      it(`${scheme}: ${row.fg} on ${row.bg} ≥ ${row.min}，且与注释一致`, () => {
        const fg = palette[scheme].get(row.fg);
        const bg = palette[scheme].get(row.bg);
        expect(fg, `缺少 --pm-${row.fg}-${scheme}`).toBeDefined();
        expect(bg, `缺少 --pm-${row.bg}-${scheme}`).toBeDefined();
        const ratio = contrast(fg!, bg!);
        expect(ratio).toBeGreaterThanOrEqual(row.min);
        const documented = scheme === 'light' ? row.light : row.dark;
        expect(ratio.toFixed(2), '注释中的对比度与实算不一致，请更新 tokens.css').toBe(documented.toFixed(2));
      });
    }
  }
});
