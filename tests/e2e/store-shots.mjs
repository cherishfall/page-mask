/**
 * 商店素材生成（#29）：5 张 1280×800 截图 + 440×280 宣传图块，输出到 docs/store-assets/。
 *
 * 运行：npm run build && node tests/e2e/store-shots.mjs        （约 40 秒）
 *
 * 素材全部来自真实运行：页面截图是扩展在虚构站点「Acme 书房」上生效后的真实画面，
 * 拼版（之前/之后、标签栏、popup 放大）里的每一块都是这些截图与扩展自己的资源，
 * 不画假界面、不含第三方商标。
 *
 * - screenshot-1-before-after：同一页面的「之前 / 之后」并排 + 大字说明
 * - screenshot-2-wizard：设置向导预览（号码牌 + 草稿清单 + 底部工具条）
 * - screenshot-3-tabbar：标签栏里的两个标签页（原样 / 清爽），展示标题与图标
 * - screenshot-4-popup：popup 正常状态（有规则、清爽模式开）
 * - screenshot-5-management：管理页，用虚构域名
 * - promo-tile-440x280：新图标 + 一句话定位，无 emoji
 */
import fs from 'node:fs';
import path from 'node:path';
import { resultsDir, startServer, waitFor } from './lib/harness.mjs';
import { launchExtension, sendToBackground, sendToTab, setProfile, tabIdOf } from './lib/extension.mjs';
import { clickInShadow, waitForShadow } from './lib/shadow.mjs';

const REPO = path.resolve(import.meta.dirname, '../..');
const OUT = path.join(REPO, 'docs/store-assets');
const TMP = resultsDir('store-shots');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

/** 虚构阅读站；favicon 是一个橙色圆角方块（原样态的标签页图标） */
const FAVICON =
  'data:image/svg+xml,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="4" fill="#f59e0b"/></svg>');

const nav = (items) => items.map((t) => `<span>${t}</span>`).join('');
const cards = ['星海旅人', '雾中灯塔', '长夜书信']
  .map((t, i) => `<li class="card"><b>${t}</b><p>示例作者 · 虚构类 · 示例评分 ${(4.8 - i * 0.2).toFixed(1)}</p></li>`)
  .join('');

const PAGE = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<link rel="icon" href="${FAVICON}">
<title>Acme 书房 · 示例阅读站</title>
<style>
  body{margin:0;font-family:system-ui,'PingFang SC',sans-serif;color:#1f2329;background:#fff}
  header#site-header{display:flex;align-items:center;gap:28px;padding:14px 24px;border-bottom:1px solid #eceef1;background:#fbfbfc}
  header#site-header b{font-size:16px}
  header#site-header nav{display:flex;gap:22px;font-size:14px;color:#4b5563}
  main{max-width:960px;margin:0 auto;padding:24px 20px 40px}
  h1{font-size:26px;margin:0 0 6px}
  .meta{color:#6b7280;font-size:14px;margin:0 0 20px}
  #rec-list{list-style:none;padding:0;display:grid;gap:14px;margin:0 0 28px}
  .card{border:1px solid #e8eaee;border-radius:12px;padding:16px}
  .card b{font-size:16px}
  .card p{color:#6b7280;font-size:13px;margin:6px 0 0}
  #promo{border-radius:12px;background:#eef4ff;padding:18px 20px;display:flex;align-items:center;gap:16px}
  #promo b{font-size:15px}
  #promo span{color:#4b5563;font-size:13px}
  article p{line-height:1.9;font-size:15px;color:#374151}
  footer#site-footer{text-align:center;color:#9ca3af;font-size:12px;padding:22px}
</style></head><body>
<header id="site-header"><b>Acme 书房</b><nav>${nav(['书架', '发现', '想法', '统计'])}</nav></header>
<main>
  <h1>星海旅人</h1>
  <p class="meta">示例作者 · 虚构类 · 全书 24 章 · 已读 18%</p>
  <ul id="rec-list">${cards}</ul>
  <div id="promo"><b>开通示例会员</b><span>解锁全部章节与离线缓存（本例为虚构内容）</span></div>
  <article>
    <p>这是一段用于演示的正文内容。PageMask 只做减法：收起你点选的部分，其余版式保持原样，阅读位置不会跳。</p>
    <p>你可以只收起推荐卡片与横幅，也可以把页头一起收起；每条规则的生效范围可以设为整站，或只是这类页面。</p>
  </article>
</main>
<footer id="site-footer">© Acme 书房（虚构站点，仅用于截图）</footer>
</body></html>`;

const srv = await startServer((req, res) => {
  if (req.url === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(PAGE);
});
const ORIGIN = srv.origin;

/** 管理页用的虚构站点（不需要真实存在，只要权限已授予、配置在存储里） */
const DEMO_SITES = [
  { origin: 'https://reader.acme-notes.com', title: '阅读', rules: 3, stale: 0 },
  { origin: 'https://brief.daily-digest.co', title: '文档', rules: 2, stale: 1 },
  { origin: 'https://journal.studio-notes.dev', title: '笔记', rules: 4, stale: 0 },
];

const ext = await launchExtension({
  hostOrigins: [ORIGIN, ...DEMO_SITES.map((s) => s.origin)],
  revocable: false,
});
const { browser, control } = ext;

const now = Date.now();
const rule = (id, name, sel) => ({
  id,
  elementName: name,
  candidates: [sel],
  strategy: 'remove',
  scope: { type: 'all' },
  onlyThis: false,
  createdAt: now,
  lastHealth: 'ok',
});

const dataUrl = (file) => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
const shot = (page, file, clip = { x: 0, y: 0, width: 1280, height: 800 }) =>
  page.screenshot({ path: file, clip, captureBeyondViewport: false });

/** 用一块拼版页面出图：传入 body 片段，截 1280×800（或指定尺寸） */
async function compose(name, body, { width = 1280, height = 800 } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box}
      body{margin:0;width:${width}px;height:${height}px;overflow:hidden;
        font-family:system-ui,'PingFang SC',sans-serif;color:#1f2329;background:#f4f5f7}
      .cap{font-size:16px;color:#4b5563}
      .big{font-size:32px;font-weight:700;letter-spacing:.2px}
      .sub{font-size:19px;color:#5b6572;margin-top:8px}
    </style></head><body>${body}</body></html>`,
    { waitUntil: 'load' },
  );
  const file = path.join(OUT, `${name}.png`);
  await shot(page, file, { x: 0, y: 0, width, height });
  await page.close();
  return file;
}

try {
  const profile = {
    formatVersion: 1,
    origin: ORIGIN,
    switchState: 'disguised',
    disguisedTitle: '阅读',
    faviconDataUrl: null,
    hideRules: [
      rule('r_header', '页头导航', '#site-header'),
      rule('r_promo', '示例会员横幅', '#promo'),
      rule('r_rec', '推荐卡片', '.card:nth-child(1)'),
      rule('r_rec2', '推荐卡片', '.card:nth-child(2)'),
      rule('r_rec3', '推荐卡片', '.card:nth-child(3)'),
      rule('r_footer', '页脚', '#site-footer'),
    ],
    floatingBtnPos: null,
    createdAt: now,
    updatedAt: now,
  };

  // ---------- 原样态页面（「之前」） ----------
  const p = await browser.newPage();
  await p.setViewport({ width: 1280, height: 800 });
  await p.goto(ORIGIN, { waitUntil: 'load' });
  await setProfile(control, ORIGIN, { ...profile, switchState: 'original' });
  const tabId = await tabIdOf(control, `${ORIGIN}/*`);
  await sendToBackground(control, { t: 'enableSite', origin: ORIGIN, tabId });
  await p.waitForSelector('pagemask-toggle', { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 600));
  const beforeFile = path.join(TMP, 'page-original.png');
  await shot(p, beforeFile);

  // ---------- 清爽态页面（「之后」） ----------
  await setProfile(control, ORIGIN, profile);
  await waitFor(
    p,
    '规则生效',
    () => getComputedStyle(document.getElementById('site-header')).display === 'none',
    [],
    { timeout: 8000 },
  );
  const title = await p.evaluate(() => document.title);
  const afterFile = path.join(TMP, 'page-clean.png');
  await shot(p, afterFile);

  // 1. 之前 / 之后
  await compose(
    'screenshot-1-before-after',
    `<div style="padding:30px 44px 0">
      <div class="big">同一页面，一键收起</div>
      <div class="sub">点选让你分心的部分；保存后，标签页标题也一起变低调</div>
     </div>
     <div style="display:flex;gap:26px;padding:22px 44px 0">
       <figure style="margin:0">
         <img src="${dataUrl(beforeFile)}" style="width:572px;height:358px;display:block;border-radius:10px;border:1px solid #dfe3e8">
         <figcaption class="cap" style="margin-top:10px">之前：页头、推荐卡片、横幅、页脚</figcaption>
       </figure>
       <figure style="margin:0">
         <img src="${dataUrl(afterFile)}" style="width:572px;height:358px;display:block;border-radius:10px;border:1px solid #dfe3e8">
         <figcaption class="cap" style="margin-top:10px">之后：只留下正文，标签页标题为「${title}」</figcaption>
       </figure>
     </div>`,
  );

  // 2. 向导预览
  await sendToTab(control, await tabIdOf(control, `${ORIGIN}/*`), { t: 'openWizard', mode: 'addElement' });
  await waitForShadow(p, 'pagemask-wizard', '[data-testid="pm-wizard-toolbar"]');
  const pt = await p.evaluate(() => {
    const r = document.getElementById('promo').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await p.mouse.click(pt.x, pt.y);
  await waitForShadow(p, 'pagemask-wizard', '[data-testid^="pm-badge-"]');
  await clickInShadow(p, 'pagemask-wizard', '[data-testid="pm-wiz-preview"]');
  await waitForShadow(p, 'pagemask-wizard', '[data-testid="pm-marker-1"]');
  await new Promise((r) => setTimeout(r, 700));
  await shot(p, path.join(OUT, 'screenshot-2-wizard.png'));
  // 截图不需要走退出流程：直接关掉这个页面，向导宿主随之销毁
  await p.close();

  // 3. 标签栏（两个标签页：原样 / 清爽），下面接清爽后的页面
  const tabIcon = dataUrl(path.join(REPO, 'public/icon/32.png'));
  await compose(
    'screenshot-3-tabbar',
    `<div style="background:#dee1e6;padding:10px 12px 0;display:flex;align-items:flex-end;gap:6px">
       <div style="display:flex;gap:4px;padding:0 8px 10px 2px;align-self:center">
         <i style="width:11px;height:11px;border-radius:50%;background:#f26b5e;display:inline-block"></i>
         <i style="width:11px;height:11px;border-radius:50%;background:#f7bf4f;display:inline-block"></i>
         <i style="width:11px;height:11px;border-radius:50%;background:#5fc26a;display:inline-block"></i>
       </div>
       <div style="background:#eceef1;border-radius:9px 9px 0 0;padding:9px 16px;display:flex;align-items:center;gap:9px;font-size:13px;color:#5f6368;min-width:250px">
         <img src="${FAVICON}" style="width:16px;height:16px;display:block">
         <span>Acme 书房 · 示例阅读站</span>
       </div>
       <div style="background:#fff;border-radius:9px 9px 0 0;padding:9px 16px;display:flex;align-items:center;gap:9px;font-size:13px;color:#1f2329;min-width:250px">
         <img src="${tabIcon}" style="width:16px;height:16px;display:block">
         <span>${title}</span>
       </div>
     </div>
     <div style="background:#fff;height:${800 - 62}px;overflow:hidden">
       <img src="${dataUrl(afterFile)}" style="width:1280px;display:block">
     </div>
     <div style="position:absolute;left:44px;bottom:26px;background:#1f2329e6;color:#fff;border-radius:10px;padding:12px 18px;font-size:17px">
       开启清爽模式后，标签页标题与图标也会一起变低调
     </div>`,
  );

  // 4. popup（正常状态：有规则、清爽模式开）
  const pp = await browser.newPage();
  await pp.setViewport({ width: 340, height: 470, deviceScaleFactor: 2 });
  await pp.goto(`${ext.extOrigin}/popup.html`, { waitUntil: 'load' });
  const popupFile = path.join(TMP, 'popup.png');
  await pp.screenshot({ path: popupFile });
  await pp.close();
  await compose(
    'screenshot-4-popup',
    `<div style="height:800px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;background:#eef1f5">
       <img src="${dataUrl(popupFile)}" style="width:476px;display:block;border-radius:14px;box-shadow:0 18px 44px rgba(15,23,42,.18);border:1px solid #dfe3e8">
       <div class="cap" style="font-size:18px">工具栏图标 → 开关、编辑当前网站、管理全部网站</div>
     </div>`,
  );

  // 5. 管理页（虚构域名 + 已授权）
  await control.evaluate(async () => {
    const all = await chrome.storage.local.get(null);
    await chrome.storage.local.remove(Object.keys(all).filter((k) => k.startsWith('profile:')));
  });
  for (const s of DEMO_SITES) {
    await control.evaluate(
      async (o, t, n, stale) => {
        const stamp = Date.now();
        const names = ['页头导航', '推荐卡片', '横幅', '页脚', '侧栏'];
        const rules = Array.from({ length: n }, (_, i) => ({
          id: `r_${i}`,
          elementName: names[i] ?? '元素',
          candidates: ['#x'],
          strategy: 'remove',
          scope: { type: 'all' },
          onlyThis: false,
          createdAt: stamp,
          lastHealth: i < stale ? 'stale' : 'ok',
        }));
        await chrome.storage.local.set({
          [`profile:${o}`]: {
            formatVersion: 1,
            origin: o,
            switchState: 'disguised',
            disguisedTitle: t,
            faviconDataUrl: null,
            hideRules: rules,
            floatingBtnPos: null,
            createdAt: stamp,
            updatedAt: stamp,
          },
        });
      },
      s.origin,
      s.title,
      s.rules,
      s.stale,
    );
  }
  const mp = await browser.newPage();
  await mp.setViewport({ width: 1280, height: 800 });
  await mp.goto(`${ext.extOrigin}/management.html`, { waitUntil: 'load' });
  await mp.waitForSelector('.site', { timeout: 8000 });
  await new Promise((r) => setTimeout(r, 600));
  await shot(mp, path.join(OUT, 'screenshot-5-management.png'));
  await mp.close();

  // 6. 宣传图块 440×280
  await compose(
    'promo-tile-440x280',
    `<div style="width:440px;height:280px;background:linear-gradient(140deg,#eef4ff 0%,#f7f9fc 55%,#eaf6ef 100%);display:flex;flex-direction:column;justify-content:center;padding:0 30px;gap:12px">
       <img src="${dataUrl(path.join(REPO, 'public/icon/128.png'))}" style="width:76px;height:76px;display:block">
       <div style="font-size:28px;font-weight:700;line-height:1.2">PageMask</div>
       <div style="font-size:16px;color:#3f4a58;line-height:1.5">点选要收起的部分，<br>页面与标签页一起变清爽</div>
     </div>`,
    { width: 440, height: 280 },
  );

  for (const f of fs.readdirSync(OUT).filter((n) => n.endsWith('.png')).sort()) {
    const size = fs.statSync(path.join(OUT, f)).size;
    console.log(`  ✓ ${f}（${Math.round(size / 1024)} KB）`);
  }
  console.log(`\n素材已写入 ${path.relative(REPO, OUT)}/`);
} finally {
  await ext.cleanup();
  await srv.close();
}
