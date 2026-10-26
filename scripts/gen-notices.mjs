#!/usr/bin/env node
// 生成 public/THIRD_PARTY_NOTICES.txt：随扩展 zip 分发的第三方许可声明（MIT 等许可要求保留版权与许可文本）。
//
// 做法：
//   1. 以 sourcemap 方式把扩展构建到临时目录，从 .map 的 sources 里找出 node_modules 下实际被打进产物的包
//      （这是"生产打包实际包含"的唯一可靠来源，不靠人工维护名单）；
//   2. 与 BASELINE 并集（宁多勿少：哪怕某包当前被 tree-shake 掉也照样列出）；
//   3. 读取各包 package.json 与 LICENSE 文件；包内未附带 LICENSE 的，用 KNOWN_UPSTREAM 中记录的上游仓库许可文本。
//
// 用法：
//   npm run notices             重新生成（生成文件入库，build 前不强制运行）
//   node scripts/gen-notices.mjs --check   仅校验入库文件是否最新，过期则非零退出（CI 使用）

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outFile = join(root, 'public', 'THIRD_PARTY_NOTICES.txt');
const checkOnly = process.argv.includes('--check');

/** 已知会进入产物的运行时包（vue 运行时、选择器库、wxt 运行时）。 */
const BASELINE = [
  'vue',
  '@vue/reactivity',
  '@vue/runtime-core',
  '@vue/runtime-dom',
  '@vue/shared',
  'css-selector-generator',
  'wxt',
  '@wxt-dev/browser',
];

/** 包内未附带 LICENSE 文件时使用的上游许可文本（来源：https://github.com/wxt-dev/wxt/blob/main/LICENSE）。 */
const WXT_MONOREPO_LICENSE = `MIT License

Copyright (c) 2023 Aaron

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

const KNOWN_UPSTREAM = {
  wxt: WXT_MONOREPO_LICENSE,
  '@wxt-dev/browser': WXT_MONOREPO_LICENSE,
};

/** 以 sourcemap 构建到临时目录，返回产物引用到的 node_modules 包名集合。 */
function detectBundledPackages() {
  const tmp = mkdtempSync(join(tmpdir(), 'page-mask-notices-'));
  // 临时配置放在 .wxt/（已被 git 忽略），复用正式配置，只改输出目录并打开 sourcemap。
  const cfg = join(root, '.wxt', 'notices-sourcemap.config.ts');
  writeFileSync(
    cfg,
    `import { defineConfig } from 'wxt';
import base from '../wxt.config';
export default defineConfig({
  ...base,
  root: ${JSON.stringify(root)},
  outDir: ${JSON.stringify(tmp)},
  vite: () => ({ build: { sourcemap: true } }),
});
`,
  );
  try {
    execFileSync(join(root, 'node_modules', '.bin', 'wxt'), ['build', '-c', cfg], { cwd: root, stdio: 'pipe' });
    const found = new Set();
    for (const file of walk(tmp)) {
      if (!file.endsWith('.map')) continue;
      const { sources = [] } = JSON.parse(readFileSync(file, 'utf8'));
      for (const src of sources) {
        const m = /node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(src.replaceAll('\\', '/'));
        if (m) found.add(m[1]);
      }
    }
    if (found.size === 0) throw new Error('sourcemap 中未发现任何 node_modules 来源，检测逻辑可能失效');
    return found;
  } finally {
    rmSync(cfg, { force: true });
    rmSync(tmp, { recursive: true, force: true });
  }
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

function licenseText(pkgDir, name, pkg) {
  const file = readdirSync(pkgDir).find((f) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(f));
  if (file) return readFileSync(join(pkgDir, file), 'utf8').trim();
  if (KNOWN_UPSTREAM[name]) return KNOWN_UPSTREAM[name];
  throw new Error(`${name}@${pkg.version} 未附带 LICENSE 文件，请在 KNOWN_UPSTREAM 中补充其上游许可文本`);
}

function render(names) {
  const sections = [...names].sort().map((name) => {
    const pkgDir = join(root, 'node_modules', name);
    if (!existsSync(join(pkgDir, 'package.json'))) throw new Error(`node_modules 中找不到 ${name}，请先 npm ci`);
    const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
    const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
    return [
      '-'.repeat(78),
      `${name}@${pkg.version}`,
      `License: ${pkg.license ?? 'UNKNOWN'}`,
      repo ? `Repository: ${repo.replace(/^git\+/, '')}` : null,
      '',
      licenseText(pkgDir, name, pkg),
      '',
    ]
      .filter((l) => l !== null)
      .join('\n');
  });
  return [
    'PageMask — Third-Party Notices / 第三方许可声明',
    '',
    'This extension bundles the following third-party software. Their copyright',
    'notices and license texts are reproduced below as required by their licenses.',
    '本扩展打包包含以下第三方软件，按其许可要求在此保留版权声明与许可文本。',
    '',
    ...sections,
    '-'.repeat(78),
    '',
  ].join('\n');
}

const names = new Set([...BASELINE, ...detectBundledPackages()]);
const text = render(names);

if (checkOnly) {
  const current = existsSync(outFile) ? readFileSync(outFile, 'utf8') : '';
  if (current !== text) {
    console.error(`✖ ${relative(root, outFile)} 已过期（依赖或版本有变化），请运行 npm run notices 并提交`);
    process.exit(1);
  }
  console.log(`✔ ${relative(root, outFile)} 是最新的（${names.size} 个包）`);
} else {
  writeFileSync(outFile, text);
  console.log(`✔ 已生成 ${relative(root, outFile)}：${[...names].sort().join(', ')}`);
}
