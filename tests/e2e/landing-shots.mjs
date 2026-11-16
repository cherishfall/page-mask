/**
 * 落地页截图生成（中英两套）：7 张真实运行画面 × 2 种界面语言。
 *
 * 运行：npm run build && node tests/e2e/landing-shots.mjs
 * 输出：默认 docs/store-assets/landing/<lang>/，可用 LANDING_SHOTS_OUT=<目录> 改位置。
 *       落地页仓库使用 screens/<lang>/，生成后复制过去即可（文件同名）。
 *
 * 与 store-shots.mjs 的区别：商店素材是 1280×800 的大字拼版；落地页需要能直接嵌进
 * 页面的干净截图——图内不放任何说明文字，说明全部由网页的双语 figcaption 承担。
 * 两种语言的界面都从真实构建跑出来：设置 uiLanguage 后重开页面，扩展 UI 跟着换语言；
 * 示例站点本身也出中英两版，避免「英文界面截图里夹着中文网页」的割裂感。
 *
 * 素材内容纪律（与商店素材一致）：
 * - 示例站点「Acme 书房 / Acme Library」是虚构的，域名 acme-journal.test 用 RFC 6761
 *   保留 TLD，经 --host-resolver-rules 指向本地服务；截图里不出现 127.0.0.1 / 端口。
 * - 不含第三方商标、真人照片、用户内容；封面与推荐卡片全部是 CSS 渐变占位。
 *
 * 取景：
 * - before / after / pick / gray-*：1280×800 视口，1.5 倍像素密度（落地页展示 2 倍左右）。
 * - popup：弹窗元素本体，1 倍（弹窗 target 不支持改像素密度，落地页按 320px 原尺寸展示）。
 * - menu：页面右下角 220×240 取景（含「⋯」菜单与胶囊），2 倍。
 */
import fs from 'node:fs';
import path from 'node:path';
import { poll, resultsDir, startServer, waitFor } from './lib/harness.mjs';
import { evalInContentWorld, launchExtension, openPopup, patchProfile, patchSettings, sendToBackground, sendToTab, setProfile, tabIdOf } from './lib/extension.mjs';
import { clickInShadow, waitForShadow } from './lib/shadow.mjs';

const REPO = path.resolve(import.meta.dirname, '../..');
const OUT = process.env.LANDING_SHOTS_OUT
  ? path.resolve(process.env.LANDING_SHOTS_OUT)
  : path.join(REPO, 'docs/store-assets/landing');
const TMP = resultsDir('landing-shots');

const LANGS = ['zh', 'en'];

const COPY = {
  zh: {
    lang: 'zh-CN',
    siteTitle: '星海旅人 · Acme 书房',
    brand: 'Acme 书房',
    nav: ['书架', '发现', '想法', '统计'],
    promoBold: '开通示例会员',
    promoText: '解锁全部章节与离线缓存（本例为虚构内容）',
    promoBtn: '了解详情',
    bookTitle: '星海旅人',
    meta: '示例作者 · 虚构类 · 全书 24 章 · 已读 18%',
    intro: '这是一段用于演示的正文内容。PageMask 只做减法：收起你点选的部分，其余版式保持原样，阅读位置不会跳。',
    p1: '你可以只收起推荐卡片与横幅，也可以把页头一起收起；每条收起项在「调整」里改收起方式与在哪些页面收起。',
    quote: '「把不想看的部分收起来，剩下的才是你打开这个网站的原因。」',
    p2: '整页变灰只去掉颜色，不拦截内容：文字仍然清晰，链接照常能点，视频的声音仍由播放器自己的按钮控制。',
    p3: '所有设置都只保存在这台电脑的浏览器里。没有账号，没有同步，也不会上传任何数据。',
    recTitle: '本周推荐',
    recs: [
      ['雾中灯塔', '示例作者 · 示例评分 4.6'],
      ['长夜书信', '示例作者 · 示例评分 4.4'],
      ['山海之间', '示例作者 · 示例评分 4.2'],
    ],
    footer: '© Acme 书房（虚构站点，仅用于演示）',
    ruleNames: ['页头导航', '推广横幅', '本周推荐', '页脚'],
    disguisedTitle: '阅读',
  },
  en: {
    lang: 'en',
    siteTitle: 'The Star Wanderer · Acme Library',
    brand: 'Acme Library',
    nav: ['Shelf', 'Discover', 'Notes', 'Stats'],
    promoBold: 'Try demo membership',
    promoText: 'All chapters and offline reading (fictional example)',
    promoBtn: 'Learn more',
    bookTitle: 'The Star Wanderer',
    meta: 'Demo author · Fiction · 24 chapters · 18% read',
    intro: 'This is demo body text. PageMask only subtracts: the parts you pick go away, the rest of the layout stays put and your reading position does not jump.',
    p1: 'Hide just the recommendations and the banner, or take the page header with them. Each hidden item can change its mode and the pages it applies to under “Adjust”.',
    quote: '“Hide what you did not come for; what is left is the reason you opened the site.”',
    p2: 'Whole-page gray only removes color. Nothing is blocked: text stays readable, links still work, and video sound stays with the player’s own control.',
    p3: 'Every setting stays in the browser on this computer. No account, no sync, and nothing is uploaded.',
    recTitle: 'This week',
    recs: [
      ['The Fog Lighthouse', 'Demo author · Demo rating 4.6'],
      ['Letters in the Long Night', 'Demo author · Demo rating 4.4'],
      ['Between Mountains and Sea', 'Demo author · Demo rating 4.2'],
    ],
    footer: '© Acme Library (fictional site, for demo only)',
    ruleNames: ['Page header', 'Promo banner', 'Recommendations', 'Footer'],
    disguisedTitle: 'Reading',
  },
};

const FAVICON =
  'data:image/svg+xml,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="4" fill="#0ea5e9"/></svg>');

const MINI_COLORS = [
  'linear-gradient(135deg,#f59e0b,#f97316)',
  'linear-gradient(135deg,#10b981,#059669)',
  'linear-gradient(135deg,#8b5cf6,#6d28d9)',
];

function pageHtml(lang) {
  const c = COPY[lang];
  const recs = c.recs
    .map(
      ([title, meta], i) => `<li class="rec-card">
        <span class="mini" style="background:${MINI_COLORS[i]}">${title.slice(0, 1)}</span>
        <span class="rec-text"><b>${title}</b><p>${meta}</p></span>
      </li>`,
    )
    .join('');
  return `<!doctype html><html lang="${c.lang}"><head><meta charset="utf-8">
<link rel="icon" href="${FAVICON}">
<title>${c.siteTitle}</title>
<meta name="viewport" content="width=1280">
<style>
  *{box-sizing:border-box}
  html,body{height:100%}
  body{margin:0;font-family:system-ui,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;color:#1f2329;background:#fff;display:flex;flex-direction:column;min-height:100vh}
  #site-header{display:flex;align-items:center;gap:30px;padding:14px 64px;border-bottom:1px solid #eceef1;background:#fbfbfc;flex:none}
  #site-header .logo{font-size:17px;letter-spacing:.2px}
  #site-header nav{display:flex;gap:24px;font-size:14px;color:#4b5563}
  #promo{display:flex;align-items:center;gap:14px;margin:18px 64px 0;padding:13px 18px;border-radius:12px;background:#eef4ff;color:#1e3a8a;font-size:14px;flex:none}
  #promo b{font-size:15px}
  #promo .promo-btn{margin-left:auto;border:1px solid #b8ccf5;border-radius:8px;padding:6px 14px;font-size:13px;color:#1e40af;background:#fff}
  main{flex:1;display:flex;gap:44px;padding:28px 64px 36px;max-width:1280px;width:100%;margin:0 auto}
  article{flex:1;min-width:0;max-width:760px}
  .book{display:flex;gap:24px;align-items:flex-start;margin-bottom:22px}
  .cover{width:150px;height:200px;flex:none;border-radius:10px;background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#fff;font-size:26px;font-weight:700;line-height:1.25;display:flex;align-items:center;justify-content:center;text-align:center;box-shadow:0 10px 24px rgba(30,64,175,.22)}
  h1{font-size:30px;margin:0 0 6px;letter-spacing:-.01em}
  .meta{color:#6b7280;font-size:14px;margin:0 0 12px}
  .intro{color:#374151;font-size:15px;line-height:1.9;margin:0}
  article p{color:#374151;font-size:15px;line-height:1.9;margin:0 0 15px}
  blockquote{border-left:3px solid #dbe3f0;margin:20px 0;padding:2px 0 2px 16px;color:#4b5563;font-size:15px;line-height:1.8}
  #rec{width:300px;flex:none}
  #rec h2{font-size:16px;margin:2px 0 14px}
  #rec ul{list-style:none;margin:0;padding:0;display:grid;gap:12px}
  .rec-card{display:flex;gap:12px;align-items:center;border:1px solid #eceef1;border-radius:12px;padding:12px;background:#fff}
  .mini{width:44px;height:60px;flex:none;border-radius:6px;color:#fff;font-size:14px;font-weight:700;display:grid;place-items:center}
  .rec-text{min-width:0}
  .rec-text b{font-size:14px}
  .rec-text p{color:#6b7280;font-size:12.5px;margin:4px 0 0}
  #site-footer{flex:none;border-top:1px solid #f0f1f3;text-align:center;color:#9ca3af;font-size:12px;padding:16px}
</style></head><body>
<header id="site-header"><b class="logo">${c.brand}</b><nav>${c.nav.map((t) => `<span>${t}</span>`).join('')}</nav></header>
<div id="promo"><b>${c.promoBold}</b><span>${c.promoText}</span><span class="promo-btn">${c.promoBtn}</span></div>
<main>
  <article>
    <div class="book">
      <div class="cover">${c.bookTitle.replace(' ', '<br>')}</div>
      <div>
        <h1>${c.bookTitle}</h1>
        <p class="meta">${c.meta}</p>
        <p class="intro">${c.intro}</p>
      </div>
    </div>
    <p>${c.p1}</p>
    <blockquote>${c.quote}</blockquote>
    <p>${c.p2}</p>
    <p>${c.p3}</p>
  </article>
  <aside id="rec">
    <h2>${c.recTitle}</h2>
    <ul>${recs}</ul>
  </aside>
</main>
<footer id="site-footer">${c.footer}</footer>
</body></html>`;
}

const SITE_HOST = 'acme-journal.test';

const srv = await startServer((req, res) => {
  if (req.url === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }
  const lang = req.url?.startsWith('/en') ? 'en' : 'zh';
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(pageHtml(lang));
});
const ORIGIN = `http://${SITE_HOST}`;

const ext = await launchExtension({
  hostOrigins: [ORIGIN],
  revocable: false,
  extraPermissions: ['tabs'],
  args: [`--host-resolver-rules=MAP ${SITE_HOST} 127.0.0.1:${srv.port}`, '--no-proxy-server'],
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

function profileFor(lang, overrides = {}) {
  const c = COPY[lang];
  return {
    formatVersion: 1,
    origin: ORIGIN,
    switchState: 'disguised',
    disguisedTitle: c.disguisedTitle,
    icon: { kind: 'none' },
    hideRules: [
      rule('r_header', c.ruleNames[0], '#site-header'),
      rule('r_promo', c.ruleNames[1], '#promo'),
      rule('r_rec', c.ruleNames[2], '#rec'),
      rule('r_footer', c.ruleNames[3], '#site-footer'),
    ],
    floatingBtnPos: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const VIEW = { width: 1280, height: 800, deviceScaleFactor: 1.5 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newPage(lang) {
  const page = await browser.newPage();
  await page.setViewport(VIEW);
  await page.goto(`${ORIGIN}/${lang}`, { waitUntil: 'load' });
  return page;
}

async function waitForToggle(page) {
  await page.waitForSelector('pagemask-toggle', { timeout: 10000 });
  await sleep(400);
}

async function waitForApplied(page, sel = '#site-header') {
  await waitFor(
    page,
    '规则生效',
    (s) => getComputedStyle(document.querySelector(s)).display === 'none',
    [sel],
    { timeout: 8000 },
  );
}

const dirs = Object.fromEntries(
  LANGS.map((lang) => {
    const dir = path.join(OUT, lang);
    fs.mkdirSync(dir, { recursive: true });
    return [lang, dir];
  }),
);

const written = [];
async function shot(page, lang, name, opts = {}) {
  const file = path.join(dirs[lang], `${name}.webp`);
  await page.screenshot({ type: 'webp', quality: 82, path: file, ...opts });
  written.push(file);
  return file;
}

try {
  // 站点只启用一次：内容脚本注册好之后，后面每个新页面都会自动注入
  const first = await newPage('zh');
  await setProfile(control, ORIGIN, profileFor('zh', { switchState: 'original' }));
  await sendToBackground(control, { t: 'enableSite', origin: ORIGIN, tabId: await tabIdOf(control, `${ORIGIN}/*`) });
  await waitForToggle(first);
  await first.close();

  for (const lang of LANGS) {
    // ---------- 界面语言：先写设置，后面所有页面都按这个语言渲染 ----------
    await patchSettings(control, { uiLanguage: lang });

    // ---------- before：原样页面（规则已存在但没应用） ----------
    await setProfile(control, ORIGIN, profileFor(lang, { switchState: 'original' }));
    const pBefore = await newPage(lang);
    await waitForToggle(pBefore);
    await shot(pBefore, lang, 'before');
    await pBefore.close();

    // ---------- after：同一页面，收起 4 项 ----------
    await setProfile(control, ORIGIN, profileFor(lang));
    const pAfter = await newPage(lang);
    await waitForApplied(pAfter);
    await waitForToggle(pAfter);
    await shot(pAfter, lang, 'after');

    // ---------- popup：在清爽态页面上打开真实弹窗 ----------
    const popup = await openPopup(ext, pAfter);
    await popup.waitForSelector('[data-testid="pm-popup-cover"]', { timeout: 6000 });
    await sleep(400);
    // 弹窗是独立 target（320×480 视口），setViewport / CDP metrics override 都不支持；
    // 元素本身高 480.9，裁切或放大都会触发「超出视口」的重复渲染，所以按 1 倍截元素本体，
    // 落地页按 320px 原尺寸展示（1:1，不放大）。
    const popupEl = await popup.$('main.popup');
    if (!popupEl) throw new Error('找不到弹窗主体 main.popup');
    await popupEl.screenshot({ type: 'webp', quality: 84, path: path.join(dirs[lang], 'popup.webp') });
    written.push(path.join(dirs[lang], 'popup.webp'));
    await popup.close();
    await pAfter.close();

    // ---------- pick：设置向导第 1 步（点选），已有规则自动铺成草稿 ----------
    await setProfile(control, ORIGIN, profileFor(lang, { switchState: 'original' }));
    const pPick = await newPage(lang);
    await waitForToggle(pPick);
    await poll(
      async () => evalInContentWorld(pPick, ext.extOrigin, 'window.__pagemask?.alive()').catch(() => false),
      '内容脚本就绪',
    );
    await sendToTab(control, await tabIdOf(control, `${ORIGIN}/*`), { t: 'openWizard', mode: 'editContent' });
    await waitForShadow(pPick, 'pagemask-wizard', '[data-testid="pm-wizard-toolbar"]');
    await waitForShadow(pPick, 'pagemask-wizard', '[data-testid="pm-wiz-pick-lead"]');
    await sleep(700);
    await shot(pPick, lang, 'pick');
    await pPick.close();

    // ---------- menu：原样页面右下角的「⋯」菜单 ----------
    await setProfile(control, ORIGIN, profileFor(lang, { switchState: 'original' }));
    const pMenu = await newPage(lang);
    await waitForToggle(pMenu);
    await clickInShadow(pMenu, 'pagemask-toggle', '[data-testid="pm-toggle-more"]');
    await waitForShadow(pMenu, 'pagemask-toggle', '[data-testid="pm-toggle-menu"]');
    await sleep(450);
    // 取景只圈住右下角的悬浮按钮与展开的菜单（含页面底边）；2 倍像素密度，
    // 落地页里按 440px 展示时菜单文字才够清楚
    await pMenu.setViewport({ ...VIEW, deviceScaleFactor: 2 });
    await sleep(300);
    await shot(pMenu, lang, 'menu', { clip: { x: 1060, y: 560, width: 220, height: 240 } });
    await pMenu.close();

    // ---------- gray：原样页面（彩色）→ 整页变灰 ----------
    await setProfile(control, ORIGIN, profileFor(lang, { switchState: 'original', mediaGray: false }));
    const pGray = await newPage(lang);
    await waitForToggle(pGray);
    const grayClip = { x: 0, y: 0, width: 1280, height: 800 };
    await shot(pGray, lang, 'gray-before', { clip: grayClip });
    await patchProfile(control, ORIGIN, { mediaGray: true });
    await waitFor(
      pGray,
      '整页变灰',
      () => getComputedStyle(document.documentElement).filter === 'grayscale(1)',
      [],
      { timeout: 8000 },
    );
    await sleep(300);
    await shot(pGray, lang, 'gray-after', { clip: grayClip });
    await pGray.close();
  }

  console.log(`\n已生成 ${written.length} 张：`);
  for (const f of written) {
    const size = fs.statSync(f).size;
    console.log(`  ✓ ${path.relative(OUT, f)}（${Math.round(size / 1024)} KB）`);
  }
  console.log(`\n输出目录：${OUT}`);
} finally {
  await ext.cleanup();
  await srv.close();
}