/**
 * 扩展页面质量验收（#26）：popup / 管理页 / 引导页 的无障碍、编辑态、图标压缩、导入确认、深色模式、对比度、文案。
 *
 * 运行：npm run build && node tests/e2e/check-pages.mjs     （约 20～30 秒；HEADFUL=1 有界面运行）
 *
 * 覆盖：
 * - popup：开关在无障碍树里是 switch 角色、状态正确、点击 / 空格切换后状态变化并写入存储；
 *   不支持页面的说明、待授权、授权被拒、处理中（按钮禁用 + aria-busy）；h1 标题、装饰符号不进无障碍树
 * - 管理页：两个 tab 用链接语义（aria-current="page"）；没有 hash 时落到 #/sites，点行进入 #/sites/<域名>，
 *   浏览器后退与直接粘贴地址都落在正确视图；列表一行一站（清爽 / 原样、已收起 N 项、可能失效 N 项）；
 *   站点设置页骨架（域名标题、开关、失效清单、占位说明）；设置 tab 的默认标题自动保存、编辑态不被存储变化覆盖；
 *   一键清空、整体替换导入用原生模态 <dialog>，默认聚焦「取消」、列出影响，取消不改数据；
 *   导入失败用人话；待授权站点在行里给出「授权并启用」，两个以上出现「一次授权全部」；空状态有引导文案；
 *   所有表单控件都有关联的标签
 * - 引导页：4 步（含「固定到工具栏」），aria-current="step" 跟随「下一步」，无 🎭 与第三方品牌
 * - 三个页面：lang="zh-CN"、color-scheme meta；浅色 / 深色下 body 背景与前景等于 tokens 值；
 *   所有可见文字与其背景的对比度 ≥ 4.5、字号 ≥ 12px；可见文案（以及模板源码）里没有「伪装 / 泄露」
 *
 * 不写截图、不留临时文件（临时图片 / 导入文件放系统临时目录，结束即删）。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { REPO_ROOT } from './lib/browser.mjs';
import { createReporter, poll, startServer, waitFor } from './lib/harness.mjs';
import { getProfile, getSettings, launchExtension, openPopup, patchProfile, patchSettings, removePermission, setProfile } from './lib/extension.mjs';

const r = createReporter();
const { check } = r;
const tid = (id) => `[data-testid="${id}"]`;
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// 与 styles/tokens.css 原始色值一致
const TOKENS = {
  light: { fg: 'rgb(31, 35, 41)', bg: 'rgb(255, 255, 255)', bgSubtle: 'rgb(246, 247, 249)' },
  dark: { fg: 'rgb(229, 231, 235)', bg: 'rgb(31, 35, 41)', bgSubtle: 'rgb(42, 46, 53)' },
};
const FORBIDDEN = /伪装|泄露/;
const BRANDS = /微信读书|得到|极客时间|墨问|🎭/;

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>测试页</title></head>
<body><header id="site-header">页头</header><main><h1>正文</h1><p>内容</p></main></body></html>`;
const handler = (_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
};

const now = Date.now();
const rule = (id, name, candidates, lastHealth = 'ok') => ({
  id,
  elementName: name,
  candidates,
  strategy: 'remove',
  scope: { type: 'all' },
  onlyThis: false,
  createdAt: now,
  lastHealth,
});
const profileOf = (origin, over = {}) => ({
  formatVersion: 1,
  origin,
  switchState: 'original',
  disguisedTitle: null,
  faviconDataUrl: null,
  hideRules: [rule('r1', '页头', ['#site-header']), rule('r2', '侧栏', ['#side'])],
  floatingBtnPos: null,
  createdAt: now,
  updatedAt: now,
  ...over,
});

/** 在页面里：所有可见文字与背景的对比度、字号；返回不达标清单 */
function contrastAudit() {
  const parse = (s) => {
    const m = /rgba?\(([^)]+)\)/.exec(s);
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const over = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  });
  const bgOf = (el) => {
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c && c.a > 0) {
        layers.push(c);
        if (c.a >= 1) break;
      }
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return base;
  };
  const ratio = (a, b) => {
    const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  const targets = [...document.querySelectorAll('body *')].filter((el) => {
    if (el.closest('button:disabled, input:disabled, label:has(input:disabled)')) return false;
    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    if (el.matches('input:not([type]), input[type="text"]')) return !!el.value;
    return [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  });
  const bad = [];
  let min = Infinity;
  let minFont = Infinity;
  for (const el of targets) {
    const cs = getComputedStyle(el);
    const bg = bgOf(el);
    const fgRaw = parse(cs.color);
    if (!fgRaw) continue;
    const v = ratio(over(fgRaw, bg), bg);
    const font = parseFloat(cs.fontSize);
    min = Math.min(min, v);
    minFont = Math.min(minFont, font);
    const text = (el.value || el.textContent || '').trim().slice(0, 24);
    if (v < 4.5) bad.push(`对比度 ${v.toFixed(2)}「${text}」(${cs.color} on rgb(${bg.r | 0},${bg.g | 0},${bg.b | 0}))`);
    if (font < 12) bad.push(`字号 ${font}px「${text}」`);
  }
  return { count: targets.length, min: Number(min.toFixed(2)), minFont, bad };
}

/** 浅色 / 深色：body 颜色等于 tokens、文字对比度达标、字号 ≥12px */
async function checkSchemes(page, label, bgToken) {
  for (const scheme of ['light', 'dark']) {
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
    const body = await page.evaluate(() => {
      const cs = getComputedStyle(document.body);
      return { bg: cs.backgroundColor, fg: cs.color };
    });
    check(
      body.bg === TOKENS[scheme][bgToken] && body.fg === TOKENS[scheme].fg,
      `${label}（${scheme}）body 背景 ${body.bg} / 前景 ${body.fg} = tokens`,
    );
    const audit = await page.evaluate(contrastAudit);
    check(
      audit.count > 0 && audit.bad.length === 0,
      `${label}（${scheme}）${audit.count} 处文字对比度 ≥4.5（最低 ${audit.min}）、字号 ≥12px（最小 ${audit.minFont}px）${audit.bad.length ? '\n    ' + audit.bad.join('\n    ') : ''}`,
    );
  }
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
}

/** 页面通用：lang、color-scheme meta、表单控件都有标签、可见文案无禁用词 */
async function checkCommon(page, label) {
  const info = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    meta: document.querySelector('meta[name="color-scheme"]')?.content ?? '',
    unlabeled: [...document.querySelectorAll('input, select, textarea')]
      .filter((el) => !(el.labels?.length || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')))
      .map((el) => el.outerHTML.slice(0, 80)),
    text: document.body.innerText,
    h1: document.querySelectorAll('h1').length,
  }));
  check(info.lang === 'zh-CN' && info.meta === 'light dark', `${label}：lang=zh-CN、color-scheme meta = "${info.meta}"`);
  check(info.h1 === 1, `${label}：有且只有一个 h1`);
  check(info.unlabeled.length === 0, `${label}：所有表单控件都有关联标签${info.unlabeled.length ? '：' + info.unlabeled.join(' | ') : ''}`);
  check(!FORBIDDEN.test(info.text), `${label}：可见文案无「伪装 / 泄露」`);
  return info;
}

/** 无障碍树里找第一个 role=switch 的节点 */
async function findSwitch(page) {
  const tree = await page.accessibility.snapshot({ interestingOnly: true });
  const walk = (n) => {
    if (!n) return null;
    if (n.role === 'switch') return n;
    for (const c of n.children ?? []) {
      const hit = walk(c);
      if (hit) return hit;
    }
    return null;
  };
  return { node: walk(tree), tree };
}
const axTexts = (tree) => {
  const out = [];
  const walk = (n) => {
    if (!n) return;
    if (n.name) out.push(n.name);
    (n.children ?? []).forEach(walk);
  };
  walk(tree);
  return out.join('\n');
};

/** 把 chrome.permissions.request 换成可控替身：返回挂起的 promise，window.__pmResolve(v) 决定结果 */
function stubDeferredRequest(page) {
  return page.evaluate(() => {
    window.__pmRequests = [];
    chrome.permissions.request = (p) => {
      window.__pmRequests.push(JSON.parse(JSON.stringify(p)));
      return new Promise((res) => {
        window.__pmResolve = res;
      });
    };
  });
}

/** 递归列出目录下的 .vue 文件（管理页的视图拆到了 views/ 子目录） */
function vueFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...vueFiles(p));
    else if (entry.name.endsWith('.vue')) out.push(p);
  }
  return out;
}

/** 模板源码检查：<template> 里（去掉注释）没有禁用词 / 品牌 */
function checkSources() {
  for (const name of ['popup', 'management', 'onboarding']) {
    const dir = path.join(REPO_ROOT, 'entrypoints', name);
    const indexHtml = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    check(!FORBIDDEN.test(indexHtml), `源码 ${name}/index.html：无「伪装 / 泄露」`);
    for (const file of vueFiles(dir)) {
      const vue = fs.readFileSync(file, 'utf8');
      const rel = path.relative(REPO_ROOT, file);
      const tpl = (/<template>([\s\S]*)<\/template>\s*<script/.exec(vue)?.[1] ?? '').replace(/<!--[\s\S]*?-->/g, '');
      check(tpl.length > 0 && !FORBIDDEN.test(tpl), `源码 ${rel}：模板无「伪装 / 泄露」`);
      check(!BRANDS.test(vue), `源码 ${rel}：无 🎭 与第三方品牌举例`);
    }
  }
}

async function main() {
  const t0 = Date.now();
  const srv = await startServer(handler);
  const srv2 = await startServer(handler);
  const ORIGIN = srv.origin; // 已配置、已授权
  const ORIGIN2 = srv2.origin; // 没有配置、没有授权（新站点）
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-check-pages-'));
  // tabs 仅加在测试拷贝里：openPopup() 打开的 popup 没有 activeTab，需要它才读得到当前标签页网址
  const ext = await launchExtension({ hostOrigins: [ORIGIN], extraPermissions: ['tabs'] });
  const { browser, extOrigin } = ext;
  try {
    console.log('\n--- 源码文案 ---');
    checkSources();

    await setProfile(ext.control, ORIGIN, profileOf(ORIGIN));

    // ===================== popup =====================
    console.log('\n--- popup：开关、状态、标题结构 ---');
    const site = await browser.newPage();
    await site.goto(`${ORIGIN}/index.html`, { waitUntil: 'load' });
    let popup = await openPopup(ext, site);
    await popup.waitForSelector(tid('pm-popup-switch'), { timeout: 5000 });
    await checkCommon(popup, 'popup');
    let sw = await findSwitch(popup);
    check(sw.node?.name === '清爽模式' && sw.node.checked === false, `无障碍树：switch「${sw.node?.name}」checked=${sw.node?.checked}`);
    const axAll = axTexts(sw.tree);
    check(!axAll.includes('●') && !axAll.includes('＋'), '装饰符号 ● / ＋ 不进无障碍树');
    check(/heading/.test(JSON.stringify(sw.tree)) && (await popup.$eval('h1', (h) => h.textContent)) === 'PageMask', 'popup 有 h1 标题');
    check((await popup.$eval('main', (m) => m.getAttribute('aria-busy'))) === 'false', '读取完成后 aria-busy=false');
    await popup.click(tid('pm-popup-switch'));
    await waitFor(popup, '开关变为开', (s) => document.querySelector(s).checked, [tid('pm-popup-switch')]);
    sw = await findSwitch(popup);
    check(sw.node?.checked === true, '点击后无障碍树 switch checked=true');
    check((await getProfile(ext.control, ORIGIN)).switchState === 'disguised', '点击后存储为清爽模式开');
    await popup.focus(tid('pm-popup-switch'));
    await popup.keyboard.press('Space');
    await waitFor(popup, '空格键关掉开关', (s) => !document.querySelector(s).checked, [tid('pm-popup-switch')]);
    sw = await findSwitch(popup);
    check(sw.node?.checked === false, '空格键切换后 switch checked=false');
    await poll(async () => (await getProfile(ext.control, ORIGIN)).switchState === 'original', '空格键切换写入存储');
    check(true, '空格键切换后存储为清爽模式关');
    // 体检回写失效：popup 显示可读文字（不只靠红点 / title）
    await patchProfile(ext.control, ORIGIN, { hideRules: [rule('r1', '页头', ['#site-header'], 'stale'), rule('r2', '侧栏', ['#side'])] });
    await popup.waitForSelector(tid('pm-popup-stale'), { timeout: 5000 });
    check((await popup.$eval(tid('pm-popup-stale'), (e) => e.innerText)).includes('1 项可能失效'), 'popup 以文字显示「1 项可能失效」');
    await checkSchemes(popup, 'popup', 'bg');
    await popup.close().catch(() => undefined);

    console.log('\n--- popup：不支持的页面 ---');
    const blank = await browser.newPage();
    await blank.goto('about:blank');
    popup = await openPopup(ext, blank);
    await popup.waitForSelector(tid('pm-popup-unsupported'), { timeout: 5000 });
    const reason = await popup.$eval(tid('pm-popup-unsupported'), (e) => e.textContent.trim());
    check(reason === '浏览器内部页面无法使用清爽模式', `不支持页面显示原因（${reason}）`);
    check(!(await popup.$(tid('pm-popup-setup'))), '不支持页面不显示开启按钮');
    await popup.close().catch(() => undefined);
    await blank.close();

    console.log('\n--- popup：新站点处理中 / 授权被拒 ---');
    const site2 = await browser.newPage();
    await site2.goto(`${ORIGIN2}/index.html`, { waitUntil: 'load' });
    popup = await openPopup(ext, site2);
    await popup.waitForSelector(tid('pm-popup-setup'), { timeout: 5000 });
    check((await popup.$eval(tid('pm-popup-setup'), (b) => b.textContent.trim())) === '为当前网站开启清爽模式', '新站点显示「为当前网站开启清爽模式」');
    // 权限请求现在由后台发起（payload 由 core/background-engine.test.ts 覆盖），
    // 这里替换 popup 的消息通道，验证「点击后进入处理中」与「后台回复 denied 时的界面表现」。
    await popup.evaluate(() => {
      chrome.runtime.sendMessage = (msg) =>
        msg && msg.t === 'enableSite'
          ? new Promise((res) => {
              window.__pmReply = res;
            })
          : Promise.resolve(undefined);
    });
    await popup.click(tid('pm-popup-setup'));
    await waitFor(popup, '处理中状态', (s) => document.querySelector(s).disabled, [tid('pm-popup-setup')]);
    const busy = await popup.evaluate((s) => ({
      text: document.querySelector(s).textContent.trim(),
      ariaBusy: document.querySelector('main').getAttribute('aria-busy'),
    }), tid('pm-popup-setup'));
    check(busy.text === '正在打开…' && busy.ariaBusy === 'true', `处理中：按钮禁用、显示「${busy.text}」、aria-busy=${busy.ariaBusy}`);
    await popup.evaluate(() => window.__pmReply({ ok: false, code: 'denied' }));
    await popup.waitForSelector(tid('pm-popup-error'), { timeout: 5000 });
    const denied = await popup.evaluate((e, b) => ({
      text: document.querySelector(e).textContent,
      role: document.querySelector(e).getAttribute('role'),
      enabled: !document.querySelector(b).disabled,
    }), tid('pm-popup-error'), tid('pm-popup-setup'));
    check(denied.text.includes('需要允许访问这个网站') && denied.role === 'alert' && denied.enabled, `授权被拒：role=alert「${denied.text}」，按钮恢复可点`);
    await popup.close().catch(() => undefined);
    await site2.close();

    // ===================== 管理页 =====================
    console.log('\n--- 管理页：两个 tab 与网站列表 ---');
    await site.close(); // 关掉已配置站点的页面，避免页面里的体检回写干扰下面的断言
    await setProfile(ext.control, ORIGIN, profileOf(ORIGIN));
    const m = await browser.newPage();
    await m.goto(`${extOrigin}/management.html`, { waitUntil: 'load' });
    await m.waitForSelector(tid('pm-mgmt-site-link'), { timeout: 5000 });
    await m.bringToFront();
    await checkCommon(m, '管理页');
    const HOST = new URL(ORIGIN).host;
    const SITE_HASH = `#/sites/${HOST}`;
    const hash = () => m.evaluate(() => location.hash);
    const currentOf = (id) => m.$eval(tid(id), (a) => a.getAttribute('aria-current'));

    await poll(async () => (await hash()) === '#/sites', '没有 hash 时落到 #/sites');
    check(true, '首次进入没有 hash 时落到 #/sites');
    check(
      (await currentOf('pm-mgmt-tab-sites')) === 'page' && (await currentOf('pm-mgmt-tab-settings')) === null,
      '「网站」tab 用 aria-current="page"，「设置」不是当前页',
    );
    const rowText = await m.$eval(`li[data-origin="${ORIGIN}"]`, (e) => e.innerText);
    check(rowText.includes('原样') && rowText.includes('已收起 2 项'), `一行一站：${rowText.split('\n').join(' / ')}`);
    check((await m.$eval(tid('pm-mgmt-site-link'), (a) => a.getAttribute('href'))) === SITE_HASH, `行链接指向 ${SITE_HASH}`);
    await checkSchemes(m, '管理页 · 网站', 'bgSubtle');

    console.log('\n--- 管理页：一键清空确认框 ---');
    const resetBtn = await m.waitForSelector(`xpath/.//li[@data-origin="${ORIGIN}"]//button[normalize-space()="一键清空"]`);
    await resetBtn.click();
    await waitFor(m, '清空确认框打开', (s) => document.querySelector(s).matches(':modal'), [tid('pm-mgmt-reset-dialog')]);
    const resetInfo = await m.evaluate((s) => {
      const d = document.querySelector(s);
      const title = document.getElementById(d.getAttribute('aria-labelledby'));
      return { focus: document.activeElement?.textContent?.trim(), title: title?.textContent ?? '', list: d.querySelector('ul')?.innerText ?? '' };
    }, tid('pm-mgmt-reset-dialog'));
    check(resetInfo.focus === '取消', `原生模态 <dialog>，默认聚焦安全按钮「${resetInfo.focus}」`);
    check(resetInfo.title.includes('127.0.0.1') && resetInfo.list.includes('2 个收起项会被删除'), `确认框有标题并列明影响（${resetInfo.list.split('\n')[0]}）`);
    await m.keyboard.press('Escape');
    await waitFor(m, 'Esc 关闭确认框', (s) => !document.querySelector(s).open, [tid('pm-mgmt-reset-dialog')]);
    check((await getProfile(ext.control, ORIGIN)) !== null, 'Esc 关闭确认框不清空');

    console.log('\n--- 管理页：站点设置骨架 ---');
    await m.click(tid('pm-mgmt-site-link'));
    await poll(async () => (await hash()) === SITE_HASH, '点网站行进入 #/sites/<域名>');
    await m.waitForSelector(tid('pm-mgmt-switch'), { timeout: 5000 });
    check((await m.$eval('#pm-site-title', (h) => h.textContent.trim())) === HOST, `站点设置页标题显示域名（${HOST}）`);
    const mgmtSwitch = await findSwitch(m);
    check(mgmtSwitch.node?.name === '清爽模式', `站点设置页开关在无障碍树中为 switch「${mgmtSwitch.node?.name}」`);
    // 另一处（模拟另一个标签页里的体检）回写 lastHealth：触发管理页 storage.onChanged
    await patchProfile(ext.control, ORIGIN, { hideRules: [rule('r1', '页头', ['#site-header'], 'stale'), rule('r2', '侧栏', ['#side'])] });
    await m.waitForSelector(tid('pm-mgmt-stale-list'), { timeout: 5000 });
    check((await m.$eval(tid('pm-mgmt-stale-list'), (e) => e.innerText)).includes('「页头」最近没找到'), '失效清单以可读文字列出');
    await m.click(tid('pm-mgmt-switch'));
    await poll(async () => (await getProfile(ext.control, ORIGIN)).switchState === 'disguised', '站点设置页切换清爽模式写入存储');
    check(true, '站点设置页切换清爽模式写入存储');

    // 浏览器后退回到列表
    await m.evaluate(() => history.back());
    await poll(async () => (await hash()) === '#/sites', '浏览器后退回到 #/sites');
    await m.waitForSelector(tid('pm-mgmt-site-link'), { timeout: 5000 });
    check((await m.$eval(`li[data-origin="${ORIGIN}"]`, (e) => e.innerText)).includes('清爽'), '列表反映刚切换的清爽状态');

    // 直接打开带 hash 的地址（含站点设置页）
    await m.goto(`${extOrigin}/management.html${SITE_HASH}`, { waitUntil: 'load' });
    await m.waitForSelector(tid('pm-mgmt-switch'), { timeout: 5000 });
    check((await hash()) === SITE_HASH, '直接粘贴站点设置地址能落在该站的设置页');

    console.log('\n--- 管理页：设置 tab（默认标题、关于） ---');
    await m.goto(`${extOrigin}/management.html#/settings`, { waitUntil: 'load' });
    await m.waitForSelector(tid('pm-mgmt-default-title'), { timeout: 5000 });
    await checkCommon(m, '管理页 · 设置');
    check(
      (await hash()) === '#/settings' && (await currentOf('pm-mgmt-tab-settings')) === 'page',
      '「设置」tab 有独立地址并标记 aria-current="page"',
    );
    const manifest = JSON.parse(fs.readFileSync(ext.manifestPath, 'utf8'));
    const shownVersion = await m.$eval(tid('pm-mgmt-version'), (e) => e.textContent.trim());
    check(shownVersion === manifest.version, `「关于」显示版本号 ${shownVersion}`);
    check(!!(await m.$('a[href="https://github.com/cherishfall/page-mask/issues"]')), '「关于」有指向 GitHub issues 的反馈入口');

    // 编辑态与存储态分离：设置 tab 的全局默认标题
    const titleSel = tid('pm-mgmt-default-title');
    const TYPED = '我的阅读标题';
    await m.click(titleSel);
    await m.type(titleSel, TYPED);
    await sleep(1200);
    check((await getSettings(ext.control)).defaultTitle === TYPED, '打字停顿后默认标题自动保存到存储');
    // 没在编辑的字段跟随存储
    await m.$eval(titleSel, (i) => i.blur());
    await patchSettings(ext.control, { defaultTitle: '别处改的标题' });
    await waitFor(m, '失焦后的默认标题跟随存储', (s, t) => document.querySelector(s).value === t, [titleSel, '别处改的标题']);
    check(true, '失焦且没有未保存改动的输入框跟随存储变化');
    // 输入中的字段不被存储变化冲掉
    await m.click(titleSel);
    await m.$eval(titleSel, (i) => i.select());
    await m.type(titleSel, '临时标题');
    await patchSettings(ext.control, { defaultTitle: '又一次别处改动' });
    await sleep(300);
    check((await m.$eval(titleSel, (i) => i.value)) === '临时标题', '输入中的默认标题没有被存储变化冲掉');
    await m.$eval(titleSel, (i) => i.blur());
    await sleep(1200);
    check((await getSettings(ext.control)).defaultTitle === '临时标题', '没等自动保存就离开输入框时，失焦也会立即提交');

    console.log('\n--- 管理页：导入 ---');
    const writeJson = (name, data) => {
      const f = path.join(tmp, name);
      fs.writeFileSync(f, typeof data === 'string' ? data : JSON.stringify(data));
      return f;
    };
    const importInput = () => m.$(tid('pm-mgmt-import-input'));
    // 导入方式在按钮之前
    const order = await m.evaluate(
      (s) => !!(document.querySelector('fieldset.import-mode').compareDocumentPosition(document.querySelector(s)) & Node.DOCUMENT_POSITION_FOLLOWING),
      tid('pm-mgmt-import-input'),
    );
    check(order, '导入方式（fieldset）排在选择文件按钮之前');
    // 导入失败用人话
    await (await importInput()).uploadFile(writeJson('broken.json', '{ not json'));
    await waitFor(m, '导入失败提示', (s) => document.querySelector(s).textContent.includes('导入失败'), [tid('pm-mgmt-import-result')]);
    const failText = await m.$eval(tid('pm-mgmt-import-result'), (e) => e.textContent.trim());
    check(failText === '导入失败：不是有效的 PageMask 导出文件' && !/[A-Za-z]/.test(failText.replace(/PageMask/g, '')), `导入失败用人话（${failText}）`);
    // 整体替换：先确认，列出影响
    const OTHER = 'https://example.com';
    const bundle = { app: 'pagemask', formatVersion: 1, exportedAt: new Date().toISOString(), profiles: [profileOf(OTHER, { hideRules: [rule('x1', '广告', ['.ad'])] })] };
    const bundleFile = writeJson('replace.json', bundle);
    await m.click('label[for="import-replace"]');
    await (await importInput()).uploadFile(bundleFile);
    await waitFor(m, '替换确认框打开', (s) => document.querySelector(s).matches(':modal'), [tid('pm-mgmt-replace-dialog')]);
    const impact = await m.evaluate((s) => ({ text: document.querySelector(s).innerText, focus: document.activeElement?.textContent?.trim() }), tid('pm-mgmt-replace-impact'));
    check(
      impact.text.includes('1 个网站、2 个收起项会全部被替换') && impact.text.includes('彻底移除') && impact.text.includes('127.0.0.1') && impact.text.includes('文件里的 1 个网站、1 个收起项'),
      `替换确认框列出影响：\n      ${impact.text.split('\n').join('\n      ')}`,
    );
    check(impact.focus === '取消', '替换确认框默认聚焦「取消」');
    await (await m.waitForSelector(`xpath/.//dialog[@data-testid="pm-mgmt-replace-dialog"]//button[normalize-space()="取消"]`)).click();
    await waitFor(m, '取消后提示', (s) => document.querySelector(s).textContent.includes('已取消导入'), [tid('pm-mgmt-import-result')]);
    check((await getProfile(ext.control, ORIGIN)) !== null && (await getProfile(ext.control, OTHER)) === null, '取消整体替换：本机数据没有改动');

    // 深浅色 / 对比度（确认框打开时也检查一次）
    await checkSchemes(m, '管理页 · 设置', 'bgSubtle');
    await (await importInput()).uploadFile(bundleFile);
    await waitFor(m, '替换确认框再次打开', (s) => document.querySelector(s).open, [tid('pm-mgmt-replace-dialog')]);
    await checkSchemes(m, '管理页 · 设置（确认框打开）', 'bgSubtle');
    await (await m.waitForSelector(`xpath/.//dialog[@data-testid="pm-mgmt-replace-dialog"]//button[normalize-space()="确认替换"]`)).click();
    await waitFor(m, '整体替换完成', (s) => document.querySelector(s).textContent.includes('导入完成'), [tid('pm-mgmt-import-result')]);
    check(
      (await getProfile(ext.control, ORIGIN)) === null && (await getProfile(ext.control, OTHER)) !== null,
      `确认后整体替换生效（${await m.$eval(tid('pm-mgmt-import-result'), (e) => e.textContent.trim())}）`,
    );

    console.log('\n--- 管理页：待授权站点 ---');
    // 整体替换后只剩 example.com（从没授权过）；再补回原站点并收回它的授权，两个站点都待授权
    await setProfile(ext.control, ORIGIN, profileOf(ORIGIN));
    await removePermission(ext.control, ORIGIN);
    await m.click(tid('pm-mgmt-tab-sites'));
    await poll(async () => (await hash()) === '#/sites', '切回网站列表');
    await m.waitForSelector(tid('pm-mgmt-pending-all'), { timeout: 5000 });
    const pendingText = await m.$eval(tid('pm-mgmt-pending-all'), (e) => e.innerText);
    check(pendingText.includes('2 个网站待授权') && pendingText.includes('一次授权全部'), `两个以上待授权时出现「一次授权全部」（${pendingText.split('\n')[0]}）`);
    const pendingRows = await m.$$eval(tid('pm-mgmt-pending'), (rows) => rows.length);
    check(pendingRows === 2, `待授权站点在行里给出「授权并启用」（${pendingRows} 行）`);
    await checkSchemes(m, '管理页 · 待授权', 'bgSubtle');

    console.log('\n--- 管理页：空状态 ---');
    await ext.control.evaluate(() => chrome.storage.local.clear());
    await m.waitForSelector(tid('pm-mgmt-empty'), { timeout: 5000 });
    const emptyText = await m.$eval(tid('pm-mgmt-empty'), (e) => e.innerText);
    check(emptyText.includes('还没有添加任何网站') && emptyText.includes('PageMask 图标'), '没有网站时给出引导文案');
    await checkSchemes(m, '管理页 · 空状态', 'bgSubtle');
    await m.close();

    // ===================== 引导页 =====================
    console.log('\n--- 引导页 ---');
    const o = await browser.newPage();
    await o.goto(`${extOrigin}/onboarding.html`, { waitUntil: 'load' });
    await o.waitForSelector('.step', { timeout: 5000 });
    await o.bringToFront();
    const ob = await checkCommon(o, '引导页');
    check(!BRANDS.test(ob.text), '引导页无 🎭 与第三方品牌举例');
    check(ob.text.includes('固定到工具栏') && ob.text.includes('拼图') && ob.text.includes('图钉'), '引导页有「把 PageMask 固定到工具栏」一步（拼图图标 → 图钉）');
    const current = () => o.evaluate(() => [...document.querySelectorAll('.step')].map((s) => s.getAttribute('aria-current')));
    let cur = await current();
    check(cur.length === 4 && cur[0] === 'step' && cur.filter(Boolean).length === 1, `4 步，第 1 步 aria-current="step"（${JSON.stringify(cur)}）`);
    await (await o.waitForSelector('xpath/.//button[normalize-space()="下一步"]')).click();
    await waitFor(o, '切到第 2 步', () => document.querySelectorAll('.step')[1].getAttribute('aria-current') === 'step');
    cur = await current();
    check(cur[1] === 'step' && cur.filter(Boolean).length === 1, '「下一步」后 aria-current 移到第 2 步');
    check(await o.$eval('.dots', (d) => d.getAttribute('aria-hidden') === 'true'), '步骤圆点 aria-hidden');
    await checkSchemes(o, '引导页', 'bgSubtle');
    await o.close();

    // ===================== popup 待授权（最后做：撤销权限） =====================
    console.log('\n--- popup：待授权 ---');
    await setProfile(ext.control, ORIGIN, profileOf(ORIGIN));
    await removePermission(ext.control, ORIGIN);
    const site3 = await browser.newPage();
    await site3.goto(`${ORIGIN}/index.html`, { waitUntil: 'load' });
    popup = await openPopup(ext, site3);
    await popup.waitForSelector(tid('pm-popup-pending-badge'), { timeout: 5000 });
    check(!(await popup.$(tid('pm-popup-switch'))) && !!(await popup.$(tid('pm-popup-reauth'))), 'popup 显示「待授权」与「重新授权」，不显示开关');
    await checkSchemes(popup, 'popup（待授权）', 'bg');
    await popup.close().catch(() => undefined);
    await site3.close();

    console.log(`\n用时 ${((Date.now() - t0) / 1000).toFixed(1)} 秒`);
  } catch (e) {
    r.fail(e);
  } finally {
    await ext.cleanup();
    await srv.close();
    await srv2.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  process.exitCode = r.summary();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
