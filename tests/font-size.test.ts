// @vitest-environment node
/**
 * 字号下限守门（#72）：界面上最小 12px（docs/design-ui.md §三、tokens.css 的字号阶梯）。
 *
 * 只查样式表里写死的 font-size：样式是全项目共用的，任何一处写 10px / 11px 都会漏到界面上。
 * tokens.css 里的 `--pm-font-size-*` 是变量定义，写法不是 `font-size:`，不受影响。
 * 注释里的行会被先去掉，免得把「不再使用 11px」这类说明当成违规。
 */
// 直接用 Node 读文件（与 tests/tokens-contrast.test.ts 同一做法：vitest 不解析 CSS）
// @ts-ignore -- node:fs 无类型声明
import { readdirSync, readFileSync } from 'node:fs';
// @ts-ignore -- node:path 无类型声明
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

/** 递归列出目录下指定后缀的文件（相对仓库根） */
function filesUnder(dir: string, ext: string, out: string[] = []): string[] {
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) filesUnder(rel, ext, out);
    else if (entry.name.endsWith(ext)) out.push(rel);
  }
  return out;
}

const SOURCES = [...filesUnder('styles', '.css'), ...filesUnder('ui', '.css'), ...filesUnder('ui', '.vue'), ...filesUnder('entrypoints', '.vue')];

/** 去掉 /* *\/ 注释，返回每一行的正文与原始行号 */
function codeLines(file: string): { line: number; text: string }[] {
  const raw: string = readFileSync(join(ROOT, file), 'utf8');
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return stripped.split('\n').map((text, i) => ({ line: i + 1, text }));
}

describe('界面字号下限', () => {
  it('样式里没有小于 12px 的字号', () => {
    const bad: string[] = [];
    for (const file of SOURCES) {
      for (const { line, text } of codeLines(file)) {
        for (const m of text.matchAll(/font-size:\s*([\d.]+)(px|rem)/g)) {
          const size = Number(m[1]) * (m[2] === 'rem' ? 16 : 1);
          if (size < 12) bad.push(`${file}:${line} → ${m[0]}`);
        }
      }
    }
    expect(bad, `这些地方的字号小于 12px：\n${bad.join('\n')}`).toEqual([]);
  });
});
