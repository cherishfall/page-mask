// 由 assets/icon/*.svg 生成扩展图标 PNG（16/32/48/128）。
// 用 puppeteer-core + 本机 Chrome for Testing 在 headless 下把 SVG 渲染到透明背景截图，不引入新依赖。
//
// 用法：
//   npm run icons              生成 public/icon/{16,32,48,128}.png 与 docs/store-assets/icon-128.png
//   npm run icons -- --preview 额外生成 16px 放大预览 docs/dev/evidence/icon-16-preview.png
// 环境变量 CHROME_PATH 可覆盖 Chrome 可执行文件路径。
import { readFile, writeFile, mkdir, readdir, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// 每个尺寸用哪份矢量源：16px 单独一份简化版，其余共用主图。
const TARGETS = [
  { size: 16, src: 'assets/icon/icon-16.svg' },
  { size: 32, src: 'assets/icon/icon.svg' },
  { size: 48, src: 'assets/icon/icon.svg' },
  { size: 128, src: 'assets/icon/icon.svg' },
];

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

async function main() {
  const preview = process.argv.includes('--preview');
  const browser = await puppeteer.launch({ executablePath: await findChrome(), headless: true });
  try {
    const page = await browser.newPage();
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
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
