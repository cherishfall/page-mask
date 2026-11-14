/**
 * 从 CHANGELOG.md 生成落地页的「更新日志」页。
 *
 * 产出：tmp/pages-repo/page-mask/changelog.html（落地页仓库 cherishfall/cherishfall.github.io 的
 * 工作区）。模板直接取该仓库的 privacy.html —— 页面的设计 token、页头 / 页脚 / 语言切换脚本
 * 与隐私政策页共用同一份，改样式只需要改 privacy.html，本脚本重新生成即自动同步。
 *
 * 用法：
 *   1. 落地页仓库克隆或更新到 tmp/pages-repo（git 记得带 HTTPS_PROXY=http://127.0.0.1:7890 前缀）
 *   2. npm run changelog:page
 *   3. 在 tmp/pages-repo 里 commit + push（页面不要手改，手改会在下次生成时被覆盖）
 *
 * 解析规则（与 CHANGELOG.md 现行格式一一对应）：
 *   ## [版本] - 日期        一个版本块
 *   ### 中文 / ### English   每版本两节，逐条对应
 *   #### 小节标题            节内小节（如「改动」「面向审阅者」）
 *   - 条目                   单层列表（现行内容没有嵌套列表）
 *   版本头与 ### 之间的摘要段不进页面：摘要是中文单语，页面的双语纪律要求每段都有中英对照，
 *   而条目本身已完整承载内容。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const changelogPath = resolve(repoRoot, 'CHANGELOG.md');
const pagesRepo = resolve(repoRoot, 'tmp/pages-repo');
const templatePath = resolve(pagesRepo, 'page-mask/privacy.html');
const outPath = resolve(pagesRepo, 'page-mask/changelog.html');

if (!existsSync(templatePath)) {
  console.error(`找不到模板 ${templatePath}`);
  console.error('先克隆落地页仓库：HTTPS_PROXY=http://127.0.0.1:7890 git clone https://github.com/cherishfall/cherishfall.github.io tmp/pages-repo');
  process.exit(1);
}

const template = readFileSync(templatePath, 'utf8');
const changelog = readFileSync(changelogPath, 'utf8');

/* ── 行内 markdown → HTML（先整体转义，再按 码段 → 自动链接 → 链接 → 加粗 的顺序还原） ── */

function escapeHtml(s) {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function inline(md) {
  let s = escapeHtml(md);
  // 码段先摘出来占位，里面的 URL 不参与后面的链接识别
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(c);
    return `\u0000CODE${codes.length - 1}\u0000`;
  });
  // <https://…> 自动链接
  s = s.replace(/&lt;(https?:\/\/[^\s]+)&gt;/g, '<a href="$1">$1</a>');
  // [文字](地址)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  // **加粗**
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\u0000CODE(\d+)\u0000/g, (_, i) => `<code>${codes[Number(i)]}</code>`);
  return s;
}

/* ── 解析 CHANGELOG.md ── */

const versions = [];
let cur = null;          // { version, date, zh: [{title, items}], en: [...] }
let curLang = null;      // 'zh' | 'en'
let curSub = null;       // { title, items }
let lineNo = 0;

function warn(msg) {
  console.warn(`  ⚠ 第 ${lineNo} 行：${msg}`);
}

function endSub() {
  if (curSub && curSub.items.length > 0) cur[curLang].push(curSub);
  curSub = null;
}

for (const rawLine of changelog.split('\n')) {
  lineNo += 1;
  const line = rawLine.replace(/\s+$/, '');

  const ver = line.match(/^## \[([^\]]+)\] - (\d{4}-\d{2}-\d{2})\s*$/);
  if (ver) {
    if (cur) endSub();
    cur = { version: ver[1], date: ver[2], zh: [], en: [] };
    versions.push(cur);
    curLang = null;
    continue;
  }
  if (!cur) continue; // 文件头的说明段
  if (/^## /.test(line)) throw new Error(`第 ${lineNo} 行的版本头不合预期：${line}`);

  if (/^### /.test(line)) {
    endSub();
    const lang = line.replace(/^### /, '').trim();
    if (lang !== '中文' && lang !== 'English') warn(`未知的小节标题「${lang}」，按中文节处理`);
    curLang = lang === 'English' ? 'en' : 'zh';
    continue;
  }
  if (/^#### /.test(line)) {
    endSub();
    curSub = { title: line.replace(/^#### /, '').trim(), items: [] };
    continue;
  }
  if (/^- /.test(line)) {
    if (!curSub) curSub = { title: null, items: [] };
    curSub.items.push(line.replace(/^- /, ''));
    continue;
  }
  if (line === '') continue;
  // 版本头下的摘要段、以及节内的普通段落都不进页面（见文件头注释）
  if (!curLang) continue;
  warn(`普通段落不进页面：${line.slice(0, 40)}…`);
}
if (cur) endSub();

if (versions.length === 0) throw new Error('CHANGELOG.md 里没有解析到任何版本');

/* ── 渲染：每个版本一块；小节标题与列表按来源节带 lang 属性，显隐交给模板的同一套 CSS ── */

function renderVersion(v) {
  const parts = [];
  parts.push(`    <section class="rel" id="v${v.version.replaceAll('.', '-')}">`);
  parts.push(
    `      <h2 class="rel-h"><span class="rel-ver">${v.version}</span><time class="rel-date" datetime="${v.date}">${v.date}</time></h2>`,
  );
  for (const langKey of ['zh', 'en']) {
    for (const sub of v[langKey]) {
      const lang = langKey === 'en' ? 'en' : 'zh-CN';
      if (sub.title) parts.push(`      <h3 lang="${lang}">${inline(sub.title)}</h3>`);
      const lis = sub.items.map((it) => `        <li>${inline(it)}</li>`).join('\n');
      parts.push(`      <ul lang="${lang}">\n${lis}\n      </ul>`);
    }
  }
  parts.push('    </section>');
  return parts.join('\n');
}

const latest = versions[0];
const count = versions.length;
const mainContent = `    <div class="container policy">
    <p class="back"><a class="text-link link-standalone" href="index.html"><span lang="zh-CN">← 返回首页</span><span lang="en">← Back to home</span></a></p>
    <h1><span lang="zh-CN">更新日志</span><span lang="en">Changelog</span></h1>
    <p class="policy-meta"><span lang="zh-CN">最新版本 ${latest.version} · ${latest.date} · 共 ${count} 个版本</span><span lang="en">Latest version ${latest.version} · ${latest.date} · ${count} versions</span></p>
    <p class="policy-note"><span lang="zh-CN">本页由仓库里的 <a class="text-link" href="https://github.com/cherishfall/page-mask/blob/master/CHANGELOG.md">CHANGELOG.md</a> 生成，内容逐条一致；每个版本下中文与英文逐条对应。</span><span lang="en">This page is generated from <a class="text-link" href="https://github.com/cherishfall/page-mask/blob/master/CHANGELOG.md">CHANGELOG.md</a> in the repository and matches it item by item; under each version, the Chinese and English texts correspond item by item.</span></p>

${versions.map(renderVersion).join('\n\n')}
  </div>`;

const htmlTitleZh = '更新日志 · PageMask';
const htmlTitleEn = 'Changelog · PageMask';
const descZh = 'PageMask 每个版本的改动记录：最新版本在最上面，中文与英文逐条对应。';
const descEn = 'What changed in each version of PageMask, newest first; Chinese and English correspond item by item.';

let page = template
  .replace(/data-title-zh="[^"]*"/, `data-title-zh="${htmlTitleZh}"`)
  .replace(/data-title-en="[^"]*"/, `data-title-en="${htmlTitleEn}"`)
  .replace(/data-desc-zh="[^"]*"/, `data-desc-zh="${descZh}"`)
  .replace(/data-desc-en="[^"]*"/, `data-desc-en="${descEn}"`)
  .replace(/<title>[^<]*<\/title>/, `<title>${htmlTitleZh}</title>`)
  .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${descZh}">`)
  .replace(/<main id="main" tabindex="-1">[\s\S]*<\/main>/, `<main id="main" tabindex="-1">\n${mainContent}\n</main>`);

// 追加更新日志页专属样式（scoped，全部走同一套 token）
const relCss = `
/* ── 更新日志（本页专属；token 与上文同一套） ── */
.rel { margin-top: 36px; padding-top: 24px; border-top: 1px solid var(--border); }
.rel-h { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.rel-ver { font-size: 20px; font-weight: 600; }
.rel-date { color: var(--muted); font-size: 14px; font-weight: 400; }
.rel h3 { margin-top: 20px; font-size: 16px; font-weight: 600; }
.rel ul { margin-top: 10px; }
.rel code, .policy p code {
  background: var(--bg-subtle);
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 0.92em;
  overflow-wrap: anywhere;
}
`;
page = page.replace(/<\/style>/, `${relCss}</style>`);

// 生成标记：写在 <head> 前，防止后来者手改后被覆盖
page = page.replace(
  /<!doctype html>\n<html/,
  `<!doctype html>
<!-- 本文件由 cherishfall/page-mask 仓库的 scripts/gen-changelog-page.mjs 从 CHANGELOG.md 生成，不要手改；
     样式与页头页脚随 privacy.html 模板同步，改那里然后重新生成。 -->
<html`,
);

// 校验：每个版本块都在产物里，主结构完整
for (const v of versions) {
  if (!page.includes(`id="v${v.version.replaceAll('.', '-')}"`)) {
    throw new Error(`产物缺版本块 ${v.version}`);
  }
}
if (!page.includes('</main>') || !page.includes('lang-group')) {
  throw new Error('产物主结构不完整（main / 语言切换丢失）');
}

writeFileSync(outPath, page);
console.log(`已生成 ${outPath}`);
console.log(`共 ${count} 个版本（最新 ${latest.version} · ${latest.date}）。`);
console.log('下一步：在 tmp/pages-repo 里 commit + push（page-mask/changelog.html 与落地页改动一起）。');
