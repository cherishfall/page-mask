// 由 assets/icon/*.svg 生成扩展图标 PNG（16/32/48/128）。
// 用 puppeteer-core + 本机 Chrome for Testing 在 headless 下把 SVG 渲染到透明背景截图，不引入新依赖。
//
// 用法：
//   npm run icons              生成 public/icon/{16,32,48,128}.png 与 docs/store-assets/icon-128.png
//   npm run icons -- --preview 额外生成 16px 放大预览 docs/dev/evidence/icon-16-preview.png
//   npm run presets            生成内置标签页图标 core/icon-presets.ts（assets/presets/*.svg）
//   npm run presets -- --preview 额外生成 docs/dev/evidence/0.6.4/presets.png 对比图
// 环境变量 CHROME_PATH 可覆盖 Chrome 可执行文件路径；CHROME_ARGS 追加启动参数（CI / 沙箱里用 --no-sandbox）。
//
// 内置图标的设计约束（#121，改 SVG 时照着做）：
// - 画布 32×32，安全区 28×28（四周留 2px，笔画外沿不越界）
// - 单一主轮廓 + 一个强调色（最多 2 个不透明色），无文字、无渐变、笔画 ≥4px
// - 靠大轮廓区分题材：文档折角 / 表格网格 / 邮件封口 V / 日历两个装订凸起 / 代码 <> /
//   会议播放三角 / 聊天左下尾巴 / 云盘文件夹凸耳 / 知识库书脊 V / 报表三根递增竖条
// - 颜色各自固定：主体色对 #F1F3F4 与 #202124 两种标签栏都 ≥3:1（亮度落在中间区间）
// - 产物是 core/icon-presets.ts 里的 base64 常量，**不要放 public/**：网页里的 <link rel=icon>
//   取扩展资源需要 web_accessible_resources，等于向任何站点暴露扩展指纹。
import { readFile, writeFile, mkdir, readdir, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// 内置图标的顺序 = core/types.ts 的 ICON_PRESET_IDS（界面网格按这个顺序排）
const PRESET_IDS = ['doc', 'sheet', 'mail', 'cal', 'code', 'meet', 'chat', 'drive', 'book', 'chart'];


async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

/** 找 Chrome 可执行文件：CHROME_PATH 优先，否则在 /tmp/cft 下搜索 Chrome for Testing。 */
async function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const name = 'Google Chrome for Testing';
  async function walk(dir, depth) {
    if (depth > 6) return null;
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return null; }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isFile() && e.name === name) return p;
      if (e.isDirectory()) {
        const hit = await walk(p, depth + 1);
        if (hit) return hit;
      }
    }
    return null;
  }
  const hit = await walk('/tmp/cft', 0);
  if (!hit) throw new Error('找不到 Chrome for Testing（/tmp/cft 下）；请设置 CHROME_PATH');
  return hit;
}

const svgDataUrl = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

async function render(page, html, width, height) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  return page.screenshot({ type: 'png', omitBackground: true, clip: { x: 0, y: 0, width, height } });
}

/** 扩展图标（public/icon）：16px 单独一份简化版，其余共用主图。 */
const TARGETS = [
  { size: 16, src: 'assets/icon/icon-16.svg' },
  { size: 32, src: 'assets/icon/icon.svg' },
  { size: 48, src: 'assets/icon/icon.svg' },
  { size: 128, src: 'assets/icon/icon.svg' },
];

async function genExtensionIcons(page, preview) {
  await mkdir(join(root, 'public/icon'), { recursive: true });
  const outputs = {};
  for (const { size, src } of TARGETS) {
    const svg = await readFile(join(root, src), 'utf8');
    const html = `<!doctype html><html><body style="margin:0;background:transparent">
      <img src="${svgDataUrl(svg)}" width="${size}" height="${size}" style="display:block"></body></html>`;
    const png = await render(page, html, size, size);
    const out = join(root, `public/icon/${size}.png`);
    await writeFile(out, png);
    outputs[size] = png;
    console.log(`✓ ${size}×${size} ← ${src}`);
  }
  const store = join(root, 'docs/store-assets');
  if (await exists(store)) {
    await writeFile(join(store, 'icon-128.png'), outputs[128]);
    console.log('✓ docs/store-assets/icon-128.png');
  }

  if (preview) {
    // 16px 图最近邻放大 8 倍，分别放在浅色 / 深色工具栏底色上；旁边附 1:1 原尺寸与 32px。
    const u16 = `data:image/png;base64,${outputs[16].toString('base64')}`;
    const u32 = `data:image/png;base64,${outputs[32].toString('base64')}`;
    // 单色版（assets/icon/mono.svg）内联渲染，颜色取 currentColor，模拟悬浮按钮里 12px / 16px 的样子。
    const mono = (await readFile(join(root, 'assets/icon/mono.svg'), 'utf8'))
      .replace(/<!--[\s\S]*?-->/g, '');
    const sized = (px) => mono.replace(/width="16" height="16"/, `width="${px}" height="${px}"`);
    const cell = (bg, fg) => `<div style="background:${bg};color:${fg};padding:16px;display:flex;align-items:center;gap:24px;width:${CELL_W - 32}px">
      <img src="${u16}" width="128" height="128" style="image-rendering:pixelated">
      <img src="${u16}" width="16" height="16">
      <img src="${u32}" width="32" height="32">
      <span style="display:flex;gap:8px;align-items:center">${sized(12)}${sized(16)}</span></div>`;
    const CELL_W = 16 + 128 + 24 + 16 + 24 + 32 + 24 + 36 + 16;
    const html = `<!doctype html><html><body style="margin:0;display:flex">${cell('#f1f3f4', '#1f2329')}${cell('#202124', '#e5e7eb')}</body></html>`;
    const png = await render(page, html, 2 * CELL_W, 160);
    const out = join(root, 'docs/dev/evidence/icon-16-preview.png');
    await writeFile(out, png);
    console.log('✓ docs/dev/evidence/icon-16-preview.png');
  }
}

/**
 * 内置标签页图标（#121）：assets/presets/*.svg → 32×32 透明 PNG → core/icon-presets.ts 的 base64 常量。
 * 产物随源码入库（构建时不依赖这个脚本）。
 */
async function genPresetIcons(page, preview) {
  const pngs = {};
  for (const id of PRESET_IDS) {
    const svg = await readFile(join(root, `assets/presets/${id}.svg`), 'utf8');
    const html = `<!doctype html><html><body style="margin:0;background:transparent">
      <img src="${svgDataUrl(svg)}" width="32" height="32" style="display:block"></body></html>`;
    pngs[id] = await render(page, html, 32, 32);
    console.log(`✓ 预置图标 ${id} ← assets/presets/${id}.svg`);
  }

  const entries = PRESET_IDS.map((id) => {
    const b64 = pngs[id].toString('base64');
    return `  ${id}: 'data:image/png;base64,${b64}',`;
  }).join('\n');
  const ts = `/**
 * 内置标签页图标（#121）。**由 scripts/gen-icons.mjs 生成，不要手改**：
 *   npm run presets
 * 源文件是 assets/presets/{${PRESET_IDS.join(',')}}.svg，设计约束写在脚本头部注释里。
 */
import type { IconPresetId } from './types';

export const PRESET_ICONS: Record<IconPresetId, string> = {
${entries}
};
`;
  await writeFile(join(root, 'core/icon-presets.ts'), ts);
  console.log('✓ core/icon-presets.ts');

  if (preview) {
    // 对比图：浅色 / 深色标签栏各一行，每行 16px 与 32px 两种尺寸
    const row = (bg, fg, size) =>
      `<div style="background:${bg};color:${fg};display:flex;align-items:center;gap:${size === 16 ? 12 : 16}px;padding:10px 16px">` +
      PRESET_IDS.map(
        (id) =>
          `<figure style="margin:0;display:flex;flex-direction:column;align-items:center;gap:4px">` +
          `<img src="data:image/png;base64,${pngs[id].toString('base64')}" width="${size}" height="${size}" style="image-rendering:pixelated">` +
          `<figcaption style="font:10px/1.2 -apple-system,sans-serif">${id}</figcaption></figure>`,
      ).join('') +
      '</div>';
    const html = `<!doctype html><html><body style="margin:0;background:transparent;font:12px -apple-system,sans-serif">
      <div style="display:flex;flex-direction:column">
        ${row('#F1F3F4', '#202124', 32)}
        ${row('#202124', '#E8EAED', 32)}
        ${row('#F1F3F4', '#202124', 16)}
        ${row('#202124', '#E8EAED', 16)}
      </div></body></html>`;
    const png = await render(page, html, 640, 320);
    await mkdir(join(root, 'docs/dev/evidence/0.6.4'), { recursive: true });
    const out = join(root, 'docs/dev/evidence/0.6.4/presets.png');
    await writeFile(out, png);
    console.log('✓ docs/dev/evidence/0.6.4/presets.png');
  }
}

async function main() {
  const preview = process.argv.includes('--preview');
  const presets = process.argv.includes('--presets');
  const args = (process.env.CHROME_ARGS ?? '').split(/\s+/).filter(Boolean);
  const browser = await puppeteer.launch({ executablePath: await findChrome(), headless: true, args });
  try {
    const page = await browser.newPage();
    if (presets) await genPresetIcons(page, preview);
    else await genExtensionIcons(page, preview);
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
