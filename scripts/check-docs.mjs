/**
 * 文档一致性检查（npm run check:docs）：
 *
 * 1. 用户可见文档里不得出现「伪装 / 摸鱼 / 泄露 / 面具 / disguise」——
 *    对外一律用清爽话术（GLOSSARY 的「界面用词」）；这几个词只允许出现在代码与内部开发文档里。
 * 2. Markdown 里的相对链接必须指向真实存在的文件（忽略 http(s)、mailto、纯锚点）。
 *
 * 只扫描面向用户的文档：README、CHANGELOG、PRIVACY、CHROMEWEBSTORE、GLOSSARY、package.json 描述、
 * 以及多语言包里的名称与说明。docs/dev/ 与 docs/adr/ 是内部文档，允许使用内部用语。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BANNED = [
  { word: '伪装', hint: '改用「清爽 / 收起 / 标签页标题 / 标签页图标」' },
  { word: '摸鱼', hint: '改用「分心 / 想安静看内容」' },
  { word: '泄露', hint: '改用「显示网址」等具体说法' },
  { word: '页面面具', hint: '改用「PageMask · 收起网页上不想看的部分」' },
  { word: 'disguise', hint: 'use "clean mode" / "hide" / "tab title" instead' },
  { word: 'page mask', hint: 'the product is written "PageMask"' },
];

/** 检查禁用词的文件（GLOSSARY 例外：它要在「用词纪律」里点名这些词，只检查它的链接） */
const DOCS = ['README.md', 'CHANGELOG.md', 'PRIVACY.md', 'CHROMEWEBSTORE.md'];
const LOCALES = ['public/_locales/en/messages.json', 'public/_locales/zh_CN/messages.json'];

const problems = [];

/** 1. 禁用词 */
for (const rel of [...DOCS, ...LOCALES, 'package.json']) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) continue;
  let text = fs.readFileSync(abs, 'utf8');
  if (rel === 'package.json') {
    // 只看描述字段（脚本、依赖名里出现这些词不算文案）
    const pkg = JSON.parse(text);
    text = [pkg.description ?? '', pkg.displayName ?? ''].join('\n');
  }
  const lower = text.toLowerCase();
  for (const { word, hint } of BANNED) {
    const at = lower.indexOf(word.toLowerCase());
    if (at < 0) continue;
    const line = text.slice(0, at).split('\n').length;
    problems.push(`${rel}:${line} 出现禁用词「${word}」（${hint}）`);
  }
}

/** 2. 内部链接 */
const collectMarkdown = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return d.name === 'node_modules' || d.name === 'tmp' || d.name === '.git' ? [] : collectMarkdown(p);
    return d.name.endsWith('.md') ? [p] : [];
  });

const linkRe = /\[[^\]]*\]\(([^)\s]+)\)/g;
for (const abs of collectMarkdown(ROOT)) {
  const text = fs.readFileSync(abs, 'utf8');
  for (const m of text.matchAll(linkRe)) {
    const target = m[1];
    if (/^(https?:|mailto:|tel:|#)/.test(target)) continue;
    const rel = target.split('#')[0].split('?')[0];
    if (!rel) continue;
    const resolved = path.resolve(path.dirname(abs), decodeURI(rel));
    if (!fs.existsSync(resolved)) {
      problems.push(`${path.relative(ROOT, abs)} 的链接指向不存在的文件：${target}`);
    }
  }
}

/** 3. 版本三方一致性（#176）：package.json ↔ CHANGELOG ↔ CHROMEWEBSTORE 头部/版本史。
 *  此前三处全靠手工对齐，0.8.14 期间商店材料头部就曾落后两个版本。 */
const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
const store = fs.readFileSync(path.join(ROOT, 'CHROMEWEBSTORE.md'), 'utf8');
if (!new RegExp(`^## \\[${version.replace(/\./g, '\\.')}]`, 'm').test(changelog)) {
  problems.push(`CHANGELOG.md 没有 ${version} 的条目（## [${version}] …）`);
}
if (!store.includes(`对应构建 **${version}**`)) {
  problems.push(`CHROMEWEBSTORE.md 头部「对应构建」不是 ${version}（发版时同步更新）`);
}
if (!store.includes(`| ${version} |`)) {
  problems.push(`CHROMEWEBSTORE.md §7 版本历史没有 ${version} 的行`);
}

if (problems.length) {
  console.error(`文档检查未通过（${problems.length} 项）：`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exitCode = 1;
} else {
  console.log(`文档检查通过：${DOCS.length + LOCALES.length + 1} 个文件无禁用词，Markdown 内部链接全部有效`);
}
