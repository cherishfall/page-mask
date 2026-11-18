/**
 * 商店素材生成（#29 / #58，#190 修通；2026-11-19 起按语言分目录出中英两套）：
 * 每种语言 6 张 1280×800 截图 + 440×280 宣传图块（全局素材，仅中文一份）。
 *
 * 运行：npm run build && CHROME_ARGS="--no-sandbox --disable-gpu" node tests/e2e/store-shots.mjs
 *       STORE_SHOTS_LOCALE=zh|en（默认 zh；两套都要出，各跑一遍）
 *       输出 docs/store-assets/<locale>/（与控制台「当地语言截图」一一对应：
 *       zh/ 传给中文（简体），en/ 传给 English，全球通用留空——官方回退顺序
 *       「当地语言截图 → 全球通用截图」，两语言都有各自的图时全球通用永不显示）；
 *       用 STORE_SHOTS_OUT=<目录> 改输出位置。
 *       宣传图块官方明示不可本地化（small promo tile / marquee 不随语言切换），只在 zh 轮
 *       生成、写 docs/store-assets/promo-tile-440x280.png，图上中文定位语是有意为之。
 *
 * 素材全部来自真实运行：页面截图是扩展在虚构站点「Acme 书房 / Acme Journal」上生效后的
 * 真实画面，拼版（之前/之后、标签栏、popup、两个管理页、⋯ 菜单与幕布）里的每一块都是
 * 这些截图与扩展自己的资源，不画假界面、不含第三方商标。界面语言锁定为本轮语言
 * （写 settings.uiLanguage，auto 会随运行机器的系统语言漂移）。
 *
 * 虚构域名映射（#190）：主 fixture 用 acme-journal.test（RFC 6761 保留 TLD，公网永不解析），
 * 启动参数 --host-resolver-rules=MAP 把它指到本地 HTTP 服务，截图里不出现 127.0.0.1 / 端口。
 * 两个平台坑（探针实测，见 tmp/ 探针脚本）：
 * - .dev 整个 TLD 在 Chrome 的 HSTS 预载表里，http:// 会被强制升级 https，普通本地 HTTP 服务握不上手——
 *   所以不能用项目里现成的 *.dev 虚构名，主 fixture 必须用 .test；
 * - 本机 Clash 是系统代理，Chrome 会把映射域名交给代理（代理解析不了虚构域名，502）——
 *   必须 --no-proxy-server 直连。CI 无代理，加上也无副作用。
 *
 * - screenshot-1-before-after：同一页面的「之前 / 之后」并排 + 大字说明
 * - screenshot-2-wizard：向导的点选与看效果两步并排（#81 起两步）
 * - screenshot-3-tabbar：标签栏里的两个标签页（原样 / 清爽），展示标题与图标（不传商店，素材备用）
 * - screenshot-4-popup：弹窗正常状态（头部「查看使用说明」链接；面具卡：按你的设置显示开关 + 标题和图标 /
 *   收起内容两颗编辑入口；灰度卡：整页变灰开关；遮住卡：带图标的「遮住这一页」按钮；辅助行：悬浮按钮开关；底部两个入口）
 * - screenshot-5-management：「全部网站设置」与「插件设置」两个独立页面并排
 * - screenshot-6-curtain：悬浮按钮「⋯」菜单 + 遮住整页后的睁眼恢复按钮
 *   （2026-11-19 修说明文字：胶囊上那颗钮的实名是「整页变灰」，旧图写的「媒体开关在『媒体』钮上」是 0.8.x 旧称）
 * - promo-tile-440x280：新图标 + 一句话定位，无 emoji（仅 zh 轮生成）
 */
import fs from 'node:fs';
import path from 'node:path';
import { poll, resultsDir, siteKeyOf, startServer, waitFor } from './lib/harness.mjs';
import { evalInContentWorld, launchExtension, openPopup, sendToBackground, sendToTab, setProfile, tabIdOf } from './lib/extension.mjs';
import { clickInShadow, waitForShadow } from './lib/shadow.mjs';

const REPO = path.resolve(import.meta.dirname, '../..');
const LOCALE = process.env.STORE_SHOTS_LOCALE === 'en' ? 'en' : 'zh';
const BASE = process.env.STORE_SHOTS_OUT ? path.resolve(process.env.STORE_SHOTS_OUT) : path.join(REPO, 'docs/store-assets');
const OUT = path.join(BASE, LOCALE);
const TMP = resultsDir('store-shots');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

/** 每种语言一份素材文案：fixture 页面、演示数据（会出现在界面里）、拼版说明字 */
const STR = {
  zh: {
    pageLang: 'zh-CN',
    site: {
      brand: 'Acme 书房',
      title: 'Acme 书房 · 示例阅读站',
      nav: ['书架', '发现', '想法', '统计'],
      book: ['星海旅人', '雾中灯塔', '长夜书信'],
      h1: '星海旅人',
      meta: '示例作者 · 虚构类 · 全书 24 章 · 已读 18%',
      cardP: (r) => `示例作者 · 虚构类 · 示例评分 ${r}`,
      promoB: '开通示例会员',
      promoS: '解锁全部章节与离线缓存（本例为虚构内容）',
      p1: '这是一段用于演示的正文内容。PageMask 只做减法：收起你点选的部分，其余版式保持原样，阅读位置不会跳。',
      p2: '你可以只收起推荐卡片与横幅，也可以把页头一起收起；每条收起项在「调整」里改收起方式与在哪些页面收起（整站或只是这类页面）。',
      footer: '© Acme 书房（虚构站点，仅用于截图）',
    },
    profile: { title: '阅读', header: '页头导航', promo: '示例会员横幅', rec: '推荐卡片', footer: '页脚' },
    siteTitles: ['阅读', '文档', '笔记'],
    seedNames: ['页头导航', '推荐卡片', '横幅', '页脚', '侧栏'],
    seedFallback: '元素',
    cap1: {
      big: '同一页面，收起前后',
      sub: '点选让你分心的部分；保存后，标签页标题也一起变低调',
      f1: '之前：页头、推荐卡片、横幅、页脚',
      f2: (t) => `之后：只留下正文，标签页标题为「${t}」`,
    },
    cap2: {
      big: '点选要收起的内容 → 看效果，保存即完成',
      sub: '选中的内容列成清单、可逐项去掉；每项的收起方式与在哪些页面收起，在「调整」里改',
      f1: '点选：悬停高亮、点一下选中，选中项列成清单',
      f2: '看效果：滚动确认效果，逐项在「调整」里换收起方式、定范围',
    },
    cap3: '开关打开后，标签页标题和图标也会一起变低调',
    cap4: {
      a: '工具栏图标：按你的设置显示 · 收起内容 / 标题和图标 · 整页变灰 · 遮住这一页 / 恢复这一页',
      b: '底部两个入口：全部网站设置 · 插件设置',
    },
    cap5: {
      big: '两个独立页面：「全部网站设置」与「插件设置」',
      sub: '弹窗底部两个入口分别进入；插件设置也是 Chrome 的「扩展程序选项」',
      f1: '「全部网站设置」：一行一站，点进去是该网站的设置页',
      f2: '「插件设置」：默认标题、悬浮按钮不透明度、快捷键、导出 / 导入、界面语言',
    },
    cap6: {
      big: '页面上的悬浮按钮，与遮住整页后的那颗恢复按钮',
      sub: '「⋯」菜单就地编辑；遮住后页面上只剩一颗可拖动的睁眼按钮，点一下就恢复',
      f1: '「⋯」菜单：标题和图标 · 收起内容 · 调整不透明度 · 删除这个网站的设置（整页变灰与遮住两颗钮在胶囊本体上）',
      f2: '遮住整页：整页连同标签页标题一起盖住，悬停小按钮显出「恢复」',
    },
  },
  en: {
    pageLang: 'en',
    site: {
      brand: 'Acme Journal',
      title: 'Acme Journal · Sample reading site',
      nav: ['Shelf', 'Discover', 'Ideas', 'Stats'],
      book: ['Star Sea Voyager', 'Lighthouse in the Fog', 'Letters through the Night'],
      h1: 'Star Sea Voyager',
      meta: 'Sample Author · Fiction · 24 chapters · 18% read',
      cardP: (r) => `Sample Author · Fiction · Sample rating ${r}`,
      promoB: 'Get sample membership',
      promoS: 'Unlock all chapters and offline caching (fictional demo)',
      p1: "This is placeholder body text. PageMask only subtracts: it hides what you pick, the rest of the layout stays as it is, and your reading position doesn't jump.",
      p2: 'You can hide just the recommendation cards and the banner, or the header as well; each hidden item\u2019s hide method and where it applies (whole site or only these pages) is edited in \u201cAdjust\u201d.',
      footer: '© Acme Journal (fictional site, for screenshots only)',
    },
    profile: { title: 'Reading', header: 'Header nav', promo: 'Membership banner', rec: 'Recommendation card', footer: 'Footer' },
    siteTitles: ['Reading', 'Docs', 'Notes'],
    seedNames: ['Header nav', 'Recommendation card', 'Banner', 'Footer', 'Sidebar'],
    seedFallback: 'Element',
    cap1: {
      big: 'The same page, before and after',
      sub: 'Point at what distracts you; once saved, the tab title quiets down too',
      f1: 'Before: header, recommendation cards, banner, footer',
      f2: (t) => `After: just the article \u2014 the tab title is now \u201c${t}\u201d`,
    },
    cap2: {
      big: 'Pick what to hide \u2192 check the result, save \u2014 done',
      sub: 'Everything picked is listed and can be removed one by one; each item\u2019s hide method and where it applies are changed in \u201cAdjust\u201d',
      f1: 'Pick: hover highlights, click selects; picks are listed',
      f2: 'Check the result: scroll to confirm; change the hide method and scope per item in \u201cAdjust\u201d',
    },
    cap3: 'With the switch on, the tab title and icon quiet down too',
    cap4: {
      a: 'Toolbar icon: Show this site your way · Hide items / Title & icon · Whole-page gray · Cover this page / Restore this page',
      b: 'Two entries at the bottom: All site settings · Settings',
    },
    cap5: {
      big: 'Two separate pages: \u201cAll site settings\u201d and \u201cSettings\u201d',
      sub: 'Both open from the bottom of the popup; Settings is also Chrome\u2019s \u201cOptions\u201d page',
      f1: 'All site settings: one row per site; click through to that site\u2019s settings page',
      f2: 'Settings: default title, floating button opacity, shortcuts, export / import, interface language',
    },
    cap6: {
      big: 'The on-page floating button, and the restore button after covering the page',
      sub: 'The \u22ef menu edits in place; once covered, only a draggable open-eye button remains \u2014 one click restores',
      f1: '\u22ef menu: Title & icon · Hide items · Adjust opacity · Delete this site\u2019s settings (the whole-page-gray and cover buttons sit on the pill itself)',
      f2: 'Covered: the page and its tab title are hidden together; hover the small button to reveal \u201cRestore\u201d',
    },
  },
};
const T = STR[LOCALE];

/** 虚构阅读站；favicon 是一个橙色圆角方块（原样态的标签页图标） */
const FAVICON =
  'data:image/svg+xml,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="4" fill="#f59e0b"/></svg>');

const nav = (items) => items.map((t) => `<span>${t}</span>`).join('');
const cards = T.site.book
  .map((t, i) => `<li class="card"><b>${t}</b><p>${T.site.cardP((4.8 - i * 0.2).toFixed(1))}</p></li>`)
  .join('');

const PAGE = `<!doctype html><html lang="${T.pageLang}"><head><meta charset="utf-8">
<link rel="icon" href="${FAVICON}">
<title>${T.site.title}</title>
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
<header id="site-header"><b>${T.site.brand}</b><nav>${nav(T.site.nav)}</nav></header>
<main>
  <h1>${T.site.h1}</h1>
  <p class="meta">${T.site.meta}</p>
  <ul id="rec-list">${cards}</ul>
  <div id="promo"><b>${T.site.promoB}</b><span>${T.site.promoS}</span></div>
  <article>
    <p>${T.site.p1}</p>
    <p>${T.site.p2}</p>
  </article>
</main>
<footer id="site-footer">${T.site.footer}</footer>
</body></html>`;

/** 主 fixture 的虚构域名：公网永不解析（RFC 6761），浏览器内映射到本地服务（见文件头） */
const SITE_HOST = 'acme-journal.test';

const srv = await startServer((req, res) => {
  if (req.url === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(PAGE);
});
const ORIGIN = `http://${SITE_HOST}`;

/** 管理页用的虚构站点（不需要真实存在，只要权限已授予、配置在存储里）。
 * 一律用可注册域名裸域：站点配置的存储键与 origin 字段都必须是规范站点 key
 * （eTLD+1，内核 isValidSiteKey 口径），裸域写法保证键、字段与显示同形
 * （#192 起 harness 的 siteKeyOf 已与内核同为 eTLD+1；0.9.1 的教训见 DEVLOG） */
const DEMO_SITES = [
  { origin: 'https://acme-notes.com', rules: 3, stale: 0 },
  { origin: 'https://daily-digest.co', rules: 2, stale: 1 },
  { origin: 'https://studio-notes.dev', rules: 4, stale: 0 },
];

const ext = await launchExtension({
  hostOrigins: [ORIGIN, ...DEMO_SITES.map((s) => s.origin)],
  revocable: false,
  // popup 里 tabs.query 要读当前标签页的网址（真实 popup 打开路径需要）
  extraPermissions: ['tabs'],
  // 虚构域名 → 本地服务（替换端含端口：访问 http://acme-journal.test/ 落到本地随机端口）；
  // --no-proxy-server：虚构域名交给系统代理就出不来了（本机 Clash；CI 无代理，无副作用）
  args: [`--host-resolver-rules=MAP ${SITE_HOST} 127.0.0.1:${srv.port}`, '--no-proxy-server'],
});
const { browser, control } = ext;

// 界面语言锁定为本轮语言（写全局设置；'auto' 会随运行机器的系统语言漂移，两轮都必须显式钉死）
await control.evaluate(async (v) => {
  const cur = (await chrome.storage.local.get('settings')).settings ?? {};
  await chrome.storage.local.set({ settings: { ...cur, uiLanguage: v } });
}, LOCALE);

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

const demoProfile = (overrides = {}) => ({
  formatVersion: 1,
  origin: ORIGIN,
  switchState: 'disguised',
  disguisedTitle: T.profile.title,
  icon: { kind: 'none' },
  hideRules: [
    rule('r_header', T.profile.header, '#site-header'),
    rule('r_promo', T.profile.promo, '#promo'),
    rule('r_rec', T.profile.rec, '.card:nth-child(1)'),
    rule('r_rec2', T.profile.rec, '.card:nth-child(2)'),
    rule('r_rec3', T.profile.rec, '.card:nth-child(3)'),
    rule('r_footer', T.profile.footer, '#site-footer'),
  ],
  floatingBtnPos: null,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const dataUrl = (file) => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
const shot = (page, file, clip = { x: 0, y: 0, width: 1280, height: 800 }) =>
  page.screenshot({ path: file, clip, captureBeyondViewport: false });

/** 用一块拼版页面出图：传入 body 片段，截 1280×800（或指定尺寸） */
async function compose(name, body, { width = 1280, height = 800, file } = {}) {
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
  const out = file ?? path.join(OUT, `${name}.png`);
  await shot(page, out, { x: 0, y: 0, width, height });
  await page.close();
  return out;
}

try {
  // ---------- 原样态页面（「之前」） ----------
  const p = await browser.newPage();
  await p.setViewport({ width: 1280, height: 800 });
  await p.goto(ORIGIN, { waitUntil: 'load' });
  await setProfile(control, ORIGIN, demoProfile({ switchState: 'original' }));
  const tabId = await tabIdOf(control, `${ORIGIN}/*`);
  await sendToBackground(control, { t: 'enableSite', origin: ORIGIN, tabId });
  await p.waitForSelector('pagemask-toggle', { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 600));
  const beforeFile = path.join(TMP, 'page-original.png');
  await shot(p, beforeFile);

  // ---------- 清爽态页面（「之后」） ----------
  await setProfile(control, ORIGIN, demoProfile());
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
      <div class="big">${T.cap1.big}</div>
      <div class="sub">${T.cap1.sub}</div>
     </div>
     <div style="display:flex;gap:26px;padding:22px 44px 0">
       <figure style="margin:0">
         <img src="${dataUrl(beforeFile)}" style="width:572px;height:358px;display:block;border-radius:10px;border:1px solid #dfe3e8">
         <figcaption class="cap" style="margin-top:10px">${T.cap1.f1}</figcaption>
       </figure>
       <figure style="margin:0">
         <img src="${dataUrl(afterFile)}" style="width:572px;height:358px;display:block;border-radius:10px;border:1px solid #dfe3e8">
         <figcaption class="cap" style="margin-top:10px">${T.cap1.f2(title)}</figcaption>
       </figure>
     </div>`,
  );

  // 2. 向导：点选 + 看效果（#81 起两步；「标题和图标」独立成单步表单，不在商店截图里）
  // 先把站点切回原样态并整页刷新（与 run-e2e 同款路径），再直接进点选阶段
  await setProfile(control, ORIGIN, demoProfile({ switchState: 'original' }));
  await p.reload({ waitUntil: 'load' });
  await poll(
    async () => evalInContentWorld(p, ext.extOrigin, 'window.__pagemask?.alive()').catch(() => false),
    '内容脚本就绪',
  );
  await sendToTab(control, await tabIdOf(control, `${ORIGIN}/*`), { t: 'openWizard', mode: 'editContent' });
  await waitForShadow(p, 'pagemask-wizard', '[data-testid="pm-wizard-toolbar"]');
  await waitForShadow(p, 'pagemask-wizard', '[data-testid="pm-wiz-pick-lead"]');

  /** 点选一个元素；点击后核对已选数量，偶尔首个 pointerdown 不生效时重试 */
  // #81 起旧规则自动铺成点选起点的草稿：demoProfile 的 6 条都在清单里、页面上挂着标记，
  // 不需要（也不应该）再点——现在再点一下反而会把已选项从清单里去掉
  await new Promise((r) => setTimeout(r, 600));
  const wizardPickFile = path.join(TMP, 'wizard-pick.png');
  await shot(p, wizardPickFile);
  // 看效果：草稿已应用 + 幽灵标记 + 清单逐项编辑
  await clickInShadow(p, 'pagemask-wizard', '[data-testid="pm-wiz-preview"]');
  await waitForShadow(p, 'pagemask-wizard', '[data-testid="pm-marker-1"]');
  await new Promise((r) => setTimeout(r, 700));
  const wizardPreviewFile = path.join(TMP, 'wizard-preview.png');
  await shot(p, wizardPreviewFile);
  // 截图不需要走退出流程：直接关掉这个页面，向导宿主随之销毁
  await p.close();
  await compose(
    'screenshot-2-wizard',
    `<div style="padding:30px 44px 0">
      <div class="big">${T.cap2.big}</div>
      <div class="sub">${T.cap2.sub}</div>
     </div>
     <div style="display:flex;gap:26px;padding:22px 44px 0">
       <figure style="margin:0">
         <img src="${dataUrl(wizardPickFile)}" style="width:572px;height:358px;display:block;border-radius:10px;border:1px solid #dfe3e8">
         <figcaption class="cap" style="margin-top:10px">${T.cap2.f1}</figcaption>
       </figure>
       <figure style="margin:0">
         <img src="${dataUrl(wizardPreviewFile)}" style="width:572px;height:358px;display:block;border-radius:10px;border:1px solid #dfe3e8">
         <figcaption class="cap" style="margin-top:10px">${T.cap2.f2}</figcaption>
       </figure>
     </div>`,
  );

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
         <span>${T.site.title}</span>
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
       ${T.cap3}
     </div>`,
  );

  // 4. popup（真实弹出面板：开关、编辑当前网站、遮住本页、底部两个入口）
  await setProfile(control, ORIGIN, demoProfile());
  const cleanPage = await browser.newPage();
  await cleanPage.setViewport({ width: 1280, height: 800 });
  await cleanPage.goto(ORIGIN, { waitUntil: 'load' });
  await waitFor(
    cleanPage,
    '规则生效',
    () => getComputedStyle(document.getElementById('site-header')).display === 'none',
    [],
    { timeout: 8000 },
  );
  await cleanPage.waitForSelector('pagemask-toggle', { timeout: 8000 });
  const popup = await openPopup(ext, cleanPage);
  await popup.waitForSelector('[data-testid="pm-popup-cover"]', { timeout: 5000 });
  await new Promise((r) => setTimeout(r, 400));
  const popupEl = await popup.$('main.popup');
  const popupFile = path.join(TMP, 'popup.png');
  await popupEl.screenshot({ path: popupFile });
  await popup.close();
  await cleanPage.close();
  await compose(
    'screenshot-4-popup',
    `<div style="height:800px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:#eef1f5">
       <img src="${dataUrl(popupFile)}" style="width:420px;display:block;border-radius:14px;box-shadow:0 18px 44px rgba(15,23,42,.18);border:1px solid #dfe3e8">
       <div class="cap" style="font-size:18px">${T.cap4.a}</div>
       <div class="cap" style="font-size:18px;margin-top:-10px">${T.cap4.b}</div>
     </div>`,
  );

  // 5. 管理页（两个独立页面并排：网站列表 / 插件设置），用虚构域名
  await control.evaluate(async () => {
    const all = await chrome.storage.local.get(null);
    await chrome.storage.local.remove(Object.keys(all).filter((k) => k.startsWith('profile:')));
  });
  for (const s of DEMO_SITES) {
    await control.evaluate(
      async (k, t, n, stale, names, fallback) => {
        const stamp = Date.now();
        const rules = Array.from({ length: n }, (_, i) => ({
          id: `r_${i}`,
          elementName: names[i] ?? fallback,
          candidates: ['#x'],
          strategy: 'remove',
          scope: { type: 'all' },
          onlyThis: false,
          createdAt: stamp,
          lastHealth: i < stale ? 'stale' : 'ok',
        }));
        await chrome.storage.local.set({
          [`profile:${k}`]: {
            formatVersion: 1,
            origin: k,
            switchState: 'disguised',
            disguisedTitle: t,
            icon: { kind: 'none' },
            hideRules: rules,
            floatingBtnPos: null,
            createdAt: stamp,
            updatedAt: stamp,
          },
        });
      },
      siteKeyOf(s.origin),
      T.siteTitles[DEMO_SITES.indexOf(s)],
      s.rules,
      s.stale,
      T.seedNames,
      T.seedFallback,
    );
  }
  const mgmtPage = await browser.newPage();
  await mgmtPage.setViewport({ width: 1280, height: 800 });
  await mgmtPage.goto(`${ext.extOrigin}/management.html#/sites`, { waitUntil: 'load' });
  await mgmtPage.waitForSelector('.site-row', { timeout: 8000 });
  await new Promise((r) => setTimeout(r, 600));
  const mgmtFile = path.join(TMP, 'management.png');
  await shot(mgmtPage, mgmtFile);
  // 点进第一个站点，截站点设置页？——这里截的是「插件设置」独立页
  const settingsPage = await browser.newPage();
  await settingsPage.setViewport({ width: 1280, height: 800 });
  await settingsPage.goto(`${ext.extOrigin}/settings.html`, { waitUntil: 'load' });
  await settingsPage.waitForSelector('[data-testid="pm-settings-language"]', { timeout: 8000 });
  await new Promise((r) => setTimeout(r, 600));
  const settingsFile = path.join(TMP, 'settings.png');
  await shot(settingsPage, settingsFile);
  await mgmtPage.close();
  await settingsPage.close();
  await compose(
    'screenshot-5-management',
    `<div style="padding:30px 44px 0">
      <div class="big">${T.cap5.big}</div>
      <div class="sub">${T.cap5.sub}</div>
     </div>
     <div style="display:flex;gap:26px;padding:22px 44px 0">
       <figure style="margin:0">
         <img src="${dataUrl(mgmtFile)}" style="width:572px;height:358px;display:block;border-radius:10px;border:1px solid #dfe3e8">
         <figcaption class="cap" style="margin-top:10px">${T.cap5.f1}</figcaption>
       </figure>
       <figure style="margin:0">
         <img src="${dataUrl(settingsFile)}" style="width:572px;height:358px;display:block;border-radius:10px;border:1px solid #dfe3e8">
         <figcaption class="cap" style="margin-top:10px">${T.cap5.f2}</figcaption>
       </figure>
     </div>`,
  );

  // 6. 小胶囊「⋯」菜单 + 幕布恢复按钮
  // 重新种回 ORIGIN 的配置（上面为管理页素材清过库），再开一个页面。
  // 种回触发 storage.onChanged 对账是后台异步的：等对账完成再开页面，否则页面可能
  // 先于重新注册加载完（registerContentScripts 只影响后续导航），内容脚本永远不会注入。
  await setProfile(control, ORIGIN, demoProfile());
  await sendToBackground(control, { t: 'reconcile' });
  const cp = await browser.newPage();
  await cp.setViewport({ width: 1280, height: 800 });
  await cp.goto(ORIGIN, { waitUntil: 'load' });
  await waitFor(
    cp,
    '规则生效',
    () => getComputedStyle(document.getElementById('site-header')).display === 'none',
    [],
    { timeout: 8000 },
  );
  await cp.waitForSelector('pagemask-toggle', { timeout: 8000 });
  // 左：⋯ 菜单展开（默认四项三组，整页变灰与遮住在胶囊本体上），截页面右下角
  await clickInShadow(cp, 'pagemask-toggle', '[data-testid="pm-toggle-more"]');
  await waitForShadow(cp, 'pagemask-toggle', '[data-testid="pm-toggle-menu"]');
  await new Promise((r) => setTimeout(r, 400));
  const menuFile = path.join(TMP, 'capsule-menu.png');
  await shot(cp, menuFile, { x: 620, y: 400, width: 660, height: 400 });
  await clickInShadow(cp, 'pagemask-toggle', '[data-testid="pm-toggle-more"]');
  // 右：遮住整页 → 幕布上的睁眼恢复按钮（悬停显出「恢复」/ "Restore"）
  await clickInShadow(cp, 'pagemask-toggle', '[data-testid="pm-toggle-cover"]');
  await waitForShadow(cp, 'pagemask-curtain', '[data-testid="pm-curtain-restore"]', { timeout: 3000 });
  const btnRect = await cp.evaluate(() => {
    const b = document.querySelector('pagemask-curtain')?.shadowRoot?.querySelector('[data-testid="pm-curtain-restore"]');
    const r = b?.getBoundingClientRect();
    return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
  });
  if (!btnRect) throw new Error('幕布恢复按钮没有找到');
  await cp.mouse.move(btnRect.x + btnRect.width / 2, btnRect.y + btnRect.height / 2);
  await new Promise((r) => setTimeout(r, 500));
  const clip = {
    x: Math.max(0, Math.min(1280 - 660, Math.round(btnRect.x + btnRect.width / 2) - 330)),
    y: Math.max(0, Math.min(800 - 400, Math.round(btnRect.y + btnRect.height / 2) - 200)),
    width: 660,
    height: 400,
  };
  const curtainFile = path.join(TMP, 'curtain-restore.png');
  await shot(cp, curtainFile, clip);
  await cp.close();
  await compose(
    'screenshot-6-curtain',
    `<div style="padding:30px 44px 0">
      <div class="big">${T.cap6.big}</div>
      <div class="sub">${T.cap6.sub}</div>
     </div>
     <div style="display:flex;gap:26px;padding:22px 44px 0">
       <figure style="margin:0">
         <img src="${dataUrl(menuFile)}" style="width:572px;height:347px;display:block;border-radius:10px;border:1px solid #dfe3e8;object-fit:cover;object-position:right bottom">
         <figcaption class="cap" style="margin-top:10px">${T.cap6.f1}</figcaption>
       </figure>
       <figure style="margin:0">
         <img src="${dataUrl(curtainFile)}" style="width:572px;height:347px;display:block;border-radius:10px;border:1px solid #dfe3e8;object-fit:cover">
         <figcaption class="cap" style="margin-top:10px">${T.cap6.f2}</figcaption>
       </figure>
     </div>`,
  );

  // 7. 宣传图块 440×280（官方明示不可本地化：只有中文一份，写到 store-assets 根目录）
  if (LOCALE === 'zh') {
    const promoFile = await compose(
      'promo-tile-440x280',
      `<div style="width:440px;height:280px;background:linear-gradient(140deg,#eef4ff 0%,#f7f9fc 55%,#eaf6ef 100%);display:flex;flex-direction:column;justify-content:center;padding:0 30px;gap:12px">
         <img src="${dataUrl(path.join(REPO, 'public/icon/128.png'))}" style="width:76px;height:76px;display:block">
         <div style="font-size:28px;font-weight:700;line-height:1.2">PageMask</div>
         <div style="font-size:16px;color:#3f4a58;line-height:1.5">点选不想要的部分，<br>标签页一起变低调</div>
       </div>`,
      { width: 440, height: 280, file: path.join(BASE, 'promo-tile-440x280.png') },
    );
    console.log(`  ✓ ${path.relative(REPO, promoFile)}（全局素材，不可本地化）`);
  }

  for (const f of fs.readdirSync(OUT).filter((n) => n.endsWith('.png')).sort()) {
    const size = fs.statSync(path.join(OUT, f)).size;
    console.log(`  ✓ ${f}（${Math.round(size / 1024)} KB）`);
  }
  console.log(`\n${LOCALE} 套图已写入 ${path.relative(REPO, OUT)}/`);
} finally {
  await ext.cleanup();
  await srv.close();
}
