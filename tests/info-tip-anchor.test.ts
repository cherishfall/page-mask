// @vitest-environment node
/**
 * #183 静态守门：凡模板里使用 <InfoTip 的文件，宿主行必须带 pm-info-anchor。
 *
 * 根因背景（#183）：ⓘ 气泡（styles/info-tip.css）靠宿主行上的 pm-info-anchor
 * （position:relative）锚定整行；漏加时页面内没有定位祖先，气泡按
 * bottom: calc(100% + 6px) 贴到页面头上、渲染在视口外——用户悬停只见问号光标不见气泡。
 * 静态上一切正常，编译与组件测试都发现不了，所以按「数调用点」这条机器守门堵住同类漏网。
 *
 * 审计单位 = grep 出的全部调用点逐个过（#183 记下的流程规矩），不凭症状联想：
 * 当前 6 处——弹窗 2、插件设置 3、站点设置 1。「锚得对不对」（气泡真的浮出且在视口内）
 * 由 tests/e2e/check-info-tips.mjs 真机守；本测试守「有没有锚」。
 */
// 直接用 Node 读源码（与 tests/font-size.test.ts 同一做法）
// @ts-ignore -- node:fs 无类型声明
import { readdirSync, readFileSync } from 'node:fs';
// @ts-ignore -- node:path 无类型声明
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

/** 递归列出目录下 .vue / .ts 源文件（相对仓库根；<InfoTip 标签写法只可能出现在这两种里） */
function filesUnder(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) filesUnder(rel, out);
    else if (entry.name.endsWith('.vue') || entry.name.endsWith('.ts')) out.push(rel);
  }
  return out;
}

const SOURCES = [...filesUnder('ui'), ...filesUnder('entrypoints')];

/** <InfoTip 标签用法次数（负向断言排除 Set<InfoTipEntry> 这类 TS 泛型） */
function infoTipCount(src: string): number {
  return (src.match(/<InfoTip(?![\w-])/g) ?? []).length;
}

/** 宿主行锚类出现次数。先剥掉注释再数：注释里提到 pm-info-anchor 不算——
    否则「模板注释解释锚类」这件事本身就会把守门骗绿（#183 实测踩过）。
    剥三种注释：HTML 的尖括号注释、JS/CSS 的星号块注释、行注释（#72 字号守门同做法）。
    精确的逐文件锚数另由 tests/copy-guidance.test.ts 的「四处收口」分文件守着 */
function anchorCount(src: string): number {
  const code = src
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/^\s*\/\/.*$/gm, (m) => m.replace(/[^\n]/g, ' '));
  return (code.match(/(?<![\w-])pm-info-anchor(?![\w-])/g) ?? []).length;
}

const USERS = SOURCES.map((file) => ({ file, src: readFileSync(join(ROOT, file), 'utf8') as string })).filter(
  ({ src }) => infoTipCount(src) > 0,
);

describe('#183 静态守门：<InfoTip 调用点的宿主行必须带 pm-info-anchor', () => {
  it('每个含 <InfoTip 的文件，pm-info-anchor 出现次数 ≥ <InfoTip 次数', () => {
    const bad = USERS.filter(({ src }) => anchorCount(src) < infoTipCount(src));
    const detail = bad
      .map(({ file, src }) => `${file}：<InfoTip ×${infoTipCount(src)}，pm-info-anchor ×${anchorCount(src)}`)
      .join('；');
    expect(
      bad,
      `以下文件用了 <InfoTip 但缺 pm-info-anchor 宿主行（气泡会弹到页面头上、视口外，#183）：${detail}`,
    ).toEqual([]);
  });

  it(
    '调用点总数还是 6（弹窗 2、插件设置 3、站点设置 1）；增删 ⓘ 时同步更新本期望与 ' +
      'tests/e2e/check-info-tips.mjs（#183 审计规矩：动共享组件按 grep 出的全部调用点逐个过）',
    () => {
      const total = USERS.reduce((n, { src }) => n + infoTipCount(src), 0);
      expect(total, 'ⓘ 调用点总数变了：先逐个核对每个新调用点的宿主行锚类，再更新这里的期望值').toBe(6);
    },
  );
});
