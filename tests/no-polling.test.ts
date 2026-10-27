// @vitest-environment node
/**
 * 内容脚本不得有常驻轮询（#22，REVIEW C2）：SPA 路由变化走 WXT `wxt:locationchange`（Navigation API 事件），
 * 体检走一次性的宽限 + 空闲回调。这里守门：内容脚本会打包进去的源码里不出现 setInterval。
 * 运行时另由 E2E 断言路由变化后立即生效、页面隔离环境里 Navigation API 可用（WXT 不会退回 1 秒轮询）。
 */
// @ts-ignore -- 项目未装 @types/node
import { readFileSync, readdirSync, statSync } from 'node:fs';

const root = new URL('../', import.meta.url);

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(new URL(dir, root)) as string[]) {
    const rel = `${dir}/${name}`;
    if ((statSync(new URL(rel, root)) as { isDirectory(): boolean }).isDirectory()) out.push(...sources(rel));
    else if (/\.(ts|vue)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(rel);
  }
  return out;
}

describe('内容脚本无常驻轮询', () => {
  it('ui/、core/、entrypoints/content.ts 里没有 setInterval', () => {
    const files = [...sources('ui'), ...sources('core'), 'entrypoints/content.ts'];
    expect(files.length).toBeGreaterThan(10);
    const offenders = files.filter((f) => /\bsetInterval\s*\(/.test(readFileSync(new URL(f, root), 'utf8') as string));
    expect(offenders).toEqual([]);
  });
});
