/**
 * 扩展页面质量验收（#26）：popup / 管理页 / 引导页 的无障碍、编辑态、图标压缩、导入确认、深色模式、对比度、文案。
 *
 * 运行：npm run build && node tests/e2e/check-pages.mjs     （约 20～30 秒；HEADFUL=1 有界面运行）
 *
 * 覆盖：
 * - popup：开关在无障碍树里是 switch 角色、状态正确、点击 / 空格切换后状态变化并写入存储；
 *   不支持页面的说明、待授权、授权被拒、处理中（按钮文字变进行时、不设禁用态、再点被忽略）；
 *   h1 标题、装饰符号不进无障碍树
 * - popup 只留三件事（#54）：主按钮 + 编辑当前网站 + 遮住开关（遮住后写「恢复这一页」），
 *   底部一行「你添加的网站」「插件设置」各自落地；三种站点状态（未添加 / 已添加 / 待授权）都能遮住与恢复；
 *   不再有「设置标题和图标」；三个状态下高度都不超过 600px
 * - 站点已授权但当前页面没被覆盖（#162）：只授 https 模式、打开 http 页面时，弹窗走 pending 档、
 *   提示「这个页面还没允许访问」+「允许访问」，不显示「就绪」；一条授权都没有时仍是原来的待授权提示
 * - 存储懒迁移（#162）：旧 profile:<协议+主机> 键在管理页读取时合并成 profile:<站点 key>，旧键删除、
 *   规则并集、站点级字段取较新者、列表只有一行
 * - 管理页：两个 tab 用链接语义（aria-current="page"）；没有 hash 时落到 #/sites，点行进入 #/sites/<域名>，
 *   浏览器后退与直接粘贴地址都落在正确视图；列表一行一站（清爽 / 原样、已收起 N 项、可能失效 N 项）；
 *   站点设置页（#41 / #56 / #116 / #157）：五块标题与顺序从对照表取（标签页标题、标签页图标、
 *   收起的内容、整页变灰、删除这个网站的设置）、标签页标题自动保存并可回读、图标上传与清除、收起的内容清单（名称 / 收起方式 /
 *   人话范围）、删除后 5 秒内可撤销且按原下标插回、「在页面上编辑」（无页面时有提示、有页面时打开编辑面板）、
 *   页脚「删除这个网站的设置」与二次确认（标题带域名、默认聚焦「取消」、危险按钮实底红）、
 *   0 条规则时不出现「0 项」；列表行上没有删除入口；
 *   设置 tab 的默认标题自动保存、编辑态不被存储变化覆盖；
 *   整体替换导入用原生模态 <dialog>，默认聚焦「取消」、列出影响，取消不改数据；
 *   导入失败用人话；待授权站点在行里给出「授权并启用」，两个以上出现「一次授权全部」；空状态有引导文案；
 *   所有表单控件都有关联的标签
 * - 旧入口清理（#56）：`#/add/<来源>`（「待添加」页）不再可达，落到网站列表；
 *   只想改标题改走页面右下角 ⋯ 菜单的「标签页标题和图标」
 * - 引导页：3 步（含「固定到工具栏」），第 2/3 步直接渲染真实弹窗与真实胶囊（#103），aria-current="step" 跟随「下一步」
 * - 三个页面：lang="zh-CN"、color-scheme meta；浅色 / 深色下 body 背景与前景等于 tokens 值；
 *   所有可见文字与其背景的对比度 ≥ 4.5、字号 ≥ 12px；可见文案（以及模板源码）里没有「伪装 / 泄露」
 *
 * 不写截图、不留临时文件（临时图片 / 导入文件放系统临时目录，结束即删）。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { REPO_ROOT } from './lib/browser.mjs';
import { removeTempDir } from './lib/tmp.mjs';
import { createReporter, poll, siteKeyOf, sitePatternsOf, startServer, waitFor } from './lib/harness.mjs';
import { getProfile, getSettings, grantPermissions, launchExtension, openPopup, patchProfile, patchSettings, removePermission, setProfile } from './lib/extension.mjs';
import { waitForShadow } from './lib/shadow.mjs';
import { loadSurfaces } from './lib/surfaces.mjs';

const r = createReporter();
const { check } = r;
const tid = (id) => `[data-testid="${id}"]`;
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
/** 三处界面的唯一对照表（docs/design-surfaces.md）：顺序与叫法只从这一份取（#157） */
const SURFACES = loadSurfaces();

/** 面板自身的内容高度（px）：Chrome 弹窗上限 600，超了就要滚动 */
const popupHeight = (page) => page.$eval('main.popup', (m) => m.getBoundingClientRect().height);

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
  icon: { kind: 'none' },
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
    // 装饰性嵌入（欢迎页里的真实弹窗预览）带 aria-hidden：读屏读不到，也就不该算作页面的标题
    h1: [...document.querySelectorAll('h1')].filter((el) => !el.closest('[aria-hidden="true"]')).length,
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
  for (const name of ['popup', 'management', 'settings', 'onboarding']) {
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

/**
 * 面板只留三件事（#54）：遮住开关 + 底部两个入口，高度不超过 Chrome 弹窗上限。
 * 三种站点状态都调这一份（未添加 / 已添加 / 待授权）。
 */
async function checkPopupChrome(popup, label) {
  check(!(await popup.$(tid('pm-popup-title-settings'))), `${label}：面板里不再有「设置标题和图标」`);
  check(
    (await popup.$eval(`${tid('pm-popup-cover')} .popup-cover-label`, (b) => b.textContent.trim())) === '遮住这一页',
    `${label}：未遮住时开关写「遮住这一页」`,
  );
  // 快捷键提示（#101）：按钮上带当前平台的实际绑定
  const coverKbd = await popup.evaluate((s) => document.querySelector(`${s} .pm-kbd`)?.textContent.trim() ?? '', tid('pm-popup-cover'));
  check(coverKbd.length > 0, `${label}：遮住按钮带当前快捷键（${coverKbd}）`);
  const entries = await popup.evaluate(
    (s) =>
      s.map((x) => {
        const el = document.querySelector(x);
        const box = el.getBoundingClientRect();
        return { text: el.textContent.trim(), top: box.top, height: box.height };
      }),
    [tid('pm-popup-manage'), tid('pm-popup-settings')],
  );
  check(
    entries[0].text === '全部网站设置' && entries[1].text === '插件设置',
    `${label}：底部是「${entries[0].text}」「${entries[1].text}」`,
  );
  const minH = Math.min(entries[0].height, entries[1].height);
  check(
    Math.abs(entries[0].top - entries[1].top) < 1 && minH >= 24,
    `${label}：两个入口并排一行、高度 ${minH.toFixed(1)}px ≥ 24px`,
  );
  const h = await popupHeight(popup);
  check(h <= 600, `${label}：面板高度 ${h.toFixed(1)}px 不超过 Chrome 弹窗上限 600px`);
  // ── #148 结构断言 ──
  // 头部「查看使用说明」链接从底部独占一行挪到 h1 右侧；命中区 ≥24（WCAG 2.5.8 / C42）
  const guide = await popup.evaluate(() => {
    const a = document.querySelector('[data-testid="pm-popup-replay-intro"]');
    const box = a?.getBoundingClientRect();
    return {
      inHead: !!a?.closest('.popup-head'),
      afterLogo: !!a?.previousElementSibling?.classList.contains('popup-logo'),
      href: a?.getAttribute('href') ?? '',
      hit: box ? Math.min(box.height, box.width) : 0,
      noBottomReplay: !document.querySelector('.link-replay'),
    };
  });
  check(
    guide.inHead && guide.afterLogo && guide.href === '/onboarding.html' && guide.noBottomReplay,
    `${label}：「查看使用说明」在头部 h1 右侧、指向介绍页，底部不再独占一行`,
  );
  check(guide.hit >= 24, `${label}：头部链接命中区 ${guide.hit.toFixed(1)}px ≥ 24px`);
  // 遮住卡（#148 / ADR-0007）：与设置卡同款卡片框，但内部是按钮、没有开关
  const coverCard = await popup.evaluate((s) => {
    const card = document.querySelector(s)?.closest('.popup-card');
    return { inCard: !!card, noSwitch: !!card && !card.querySelector('input[role="switch"]'), hasHint: !!card?.querySelector('.cover-hint') };
  }, tid('pm-popup-cover'));
  check(coverCard.inCard && coverCard.noSwitch && coverCard.hasHint, `${label}：遮住是卡片框内的按钮、卡内无开关、有临时说明`);
  // new / ready 才有四块功能（pending 走自己的重新授权分支）：两颗编辑入口顺序与并排等高、
  // 辅助行无卡片框、说明字号一致、卡头 label[for] 两态正确（#148 / 方案 v3 §三①）
  if (await popup.$(tid('pm-popup-disguise'))) {
    const layout = await popup.evaluate(() => {
      const g = document.querySelector('[data-testid="pm-popup-disguise"]');
      const btns = [...g.querySelectorAll('button[data-testid]')].map((b) => b.getAttribute('data-testid'));
      const auxRow = document.querySelector('.aux-row');
      const title = document.querySelector('[data-testid="pm-popup-title"]')?.getBoundingClientRect();
      const setup = document.querySelector('[data-testid="pm-popup-setup"]')?.getBoundingClientRect();
      // 0.9.3：辅助行的常驻说明删掉，字号一致的只剩卡内这几条
      const hintSizes = ['.card-switch-hint', '.media-hint', '.cover-hint']
        .map((s) => document.querySelector(s))
        .filter((el) => el)
        .map((el) => getComputedStyle(el).fontSize);
      return {
        btns,
        auxExists: !!auxRow,
        hasCapsuleSwitch: !!document.querySelector('[data-testid="pm-popup-capsule"]'),
        auxNoCard: !!auxRow && !auxRow.closest('.popup-card'),
        topDelta: title && setup ? Math.abs(title.top - setup.top) : Infinity,
        titleH: title?.height ?? 0,
        setupH: setup?.height ?? 0,
        hintSizes,
        forLabel: !!g.querySelector('.switch-row label[for]'),
        hasSwitch: !!document.querySelector('[data-testid="pm-popup-switch"]'),
      };
    });
    // 弹窗条目顺序从对照表派生（#157）：不再各写一份中文串 / testid 顺序
    const popupEditOrder = SURFACES.popup
      .filter((row) => row.item === '标题和图标' || row.item === '收起内容')
      .map((row) => row.control);
    check(
      layout.btns.join(' / ') === popupEditOrder.join(' / '),
      `${label}：面具卡内两颗编辑入口的顺序与对照表一致（${layout.btns.join(' → ')}）`,
    );
    check(layout.topDelta < 1.5, `${label}：两颗编辑入口并排同一行（top 差 ${layout.topDelta.toFixed(1)}px）`);
    check(
      layout.titleH >= 40 && layout.setupH >= 40,
      `${label}：两颗编辑入口等高 ≥40px（次 ${layout.titleH.toFixed(1)} / 主 ${layout.setupH.toFixed(1)}）`,
    );
    check(
      (layout.hintSizes.length === 2 || layout.hintSizes.length === 3) && new Set(layout.hintSizes).size === 1 && layout.hintSizes[0] === '13px',
      `${label}：卡内说明字号一致 13px（${layout.hintSizes.join(' / ')}；ready 态 2 条、new 态 3 条，0.9.3 删掉辅助行的常驻说明）`,
    );
    check(layout.forLabel === layout.hasSwitch, `${label}：卡头 label[for] 只在有开关时出现（new 态不放假可点 label）`);
    check(
      layout.hasCapsuleSwitch ? layout.auxNoCard : !layout.auxExists,
      `${label}：辅助行只在有「悬浮按钮」开关时出现且无卡片框（新网站不显示这一行）`,
    );
  }
  // 弹窗整体顺序（#157）：渲染后的条目先后必须与对照表一致；只在场的项参与比较（new 态没有删除入口）
  const popupOrder = await popup.evaluate(
    (controls) =>
      [...document.querySelectorAll('[data-testid]')]
        .map((el) => el.getAttribute('data-testid'))
        .filter((id) => controls.includes(id)),
    SURFACES.popup.map((row) => row.control),
  );
  const popupExpected = SURFACES.popup.map((row) => row.control).filter((id) => popupOrder.includes(id));
  check(
    popupOrder.join(' / ') === popupExpected.join(' / '),
    `${label}：弹窗条目顺序与对照表一致（${popupOrder.join(' / ')}）`,
  );
}

/**
 * 遮住 → 重开面板写「恢复本页」→ 点一下恢复。两半都验证页面与面板：
 * 幕布宿主出现 / 消失、面板关闭、遮住状态下重开的面板仍然不超过 600px。
 */
async function coverAndRestore(ext, popup, page, label) {
  await popup.click(tid('pm-popup-cover'));
  await waitFor(page, `${label}：页面铺上幕布`, (h) => !!document.querySelector(h), ['pagemask-curtain'], { timeout: 5000 });
  check(true, `${label}：点「遮住这一页」后页面被遮住`);
  await poll(() => popup.isClosed(), `${label}：遮住后面板关闭`);
  check(true, `${label}：遮住后面板关闭`);

  popup = await openPopup(ext, page);
  await popup.waitForSelector(tid('pm-popup-cover'), { timeout: 5000 });
  await waitFor(
    popup,
    `${label}：重开面板显示「恢复这一页」`,
    (s) => document.querySelector(`${s} .popup-cover-label`)?.textContent.trim() === '恢复这一页',
    [tid('pm-popup-cover')],
    { timeout: 5000 },
  );
  check(true, `${label}：遮住后重新打开面板，按钮显示「恢复这一页」`);
  const h = await popupHeight(popup);
  check(h <= 600, `${label}：遮住状态下重开的面板高度 ${h.toFixed(1)}px 不超过 600px`);

  await popup.click(tid('pm-popup-cover'));
  await waitFor(page, `${label}：幕布撤掉`, (h) => !document.querySelector(h), ['pagemask-curtain'], { timeout: 5000 });
  check(true, `${label}：点「恢复这一页」后页面恢复`);
  await poll(() => popup.isClosed(), `${label}：恢复后面板关闭`);
  check(true, `${label}：恢复后面板关闭`);
}

/** 底部两个入口各自落到对应的页面（点完面板关闭） */
async function footerLandings(ext, browser, page, label) {
  const openAndClick = async (testid, urlPart) => {
    const popup = await openPopup(ext, page);
    await popup.waitForSelector(tid(testid), { timeout: 5000 });
    const opened = browser.waitForTarget((t) => t.url().includes(urlPart), { timeout: 8000 });
    await popup.click(tid(testid));
    const tab = await (await opened).asPage();
    await tab.waitForFunction(() => document.readyState === 'complete');
    await poll(() => popup.isClosed(), `${label}：点入口后面板关闭`);
    return tab;
  };
  const mgmt = await openAndClick('pm-popup-manage', '/management.html#/sites');
  check(mgmt.url().endsWith('/management.html#/sites'), `${label}：「全部网站设置」落到 ${mgmt.url()}`);
  await mgmt.close();
  const settings = await openAndClick('pm-popup-settings', '/settings.html');
  check(settings.url().endsWith('/settings.html'), `${label}：「插件设置」落到 ${settings.url()}`);
  // 快捷键区块（#101）：显示 Chrome 里当前绑定，不是写死的默认值
  await settings.waitForSelector(tid('pm-settings-shortcut-value'), { timeout: 5000 });
  const shortcutText = await settings.$eval(tid('pm-settings-shortcut-value'), (e) => e.textContent.trim());
  check(shortcutText.length > 0, `${label}：插件设置显示当前快捷键（${shortcutText}）`);
  await settings.close();
}

async function main() {
  const t0 = Date.now();
  const srv = await startServer(handler);
  const srv2 = await startServer(handler);
  const ORIGIN = srv.origin; // 已配置、已授权
  const ORIGIN2 = srv2.origin; // 没有配置（未添加的站点）；站点权限在用例里单独授，让一次性幕布脚本可注入
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
    check(sw.node?.name === '按你的设置显示' && sw.node.checked === false, `无障碍树：switch「${sw.node?.name}」checked=${sw.node?.checked}`);
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
    // 两颗编辑入口定义的是「打开之后生效什么」，不是开关的从属设置（#148）：
    // 主开关关 / 开都保持可点，卡内用肯定句说明开关管什么，不再有「开关关着」的禁用说明行。
    const offState = await popup.evaluate(() => {
      const g = document.querySelector('[data-testid="pm-popup-disguise"]');
      return {
        setupDisabled: document.querySelector('[data-testid="pm-popup-setup"]')?.disabled ?? null,
        titleDisabled: document.querySelector('[data-testid="pm-popup-title"]')?.disabled ?? null,
        offHint: !!document.querySelector('[data-testid="pm-popup-disguise-off"]'),
        cardHint: g?.querySelector('.card-switch-hint')?.textContent.trim() ?? '',
      };
    });
    check(
      offState.setupDisabled === false && offState.titleDisabled === false && offState.offHint === false,
      `主开关关着：两颗编辑入口仍可点、无禁用说明行（${JSON.stringify(offState)}）`,
    );
    // 0.8.16（#153）：ready 态面具卡不再有说明行——开关标签 + 两颗写明名字的按钮已把卡说清，
    // new 态才有一句「设置好之后，这里会出现开关。」
    check(
      offState.cardHint.length === 0,
      `ready 态面具卡没有说明行（0.8.16 #153 收文字；「${offState.cardHint}」应为空）`,
    );
    await popup.click(tid('pm-popup-switch'));
    await waitFor(popup, '开关重新变为开', (s) => document.querySelector(s).checked, [tid('pm-popup-switch')]);
    const onState = await popup.evaluate(() => ({
      setupDisabled: document.querySelector('[data-testid="pm-popup-setup"]')?.disabled ?? null,
      titleDisabled: document.querySelector('[data-testid="pm-popup-title"]')?.disabled ?? null,
      offHint: !!document.querySelector('[data-testid="pm-popup-disguise-off"]'),
    }));
    check(
      onState.setupDisabled === false && onState.titleDisabled === false && onState.offHint === false,
      `主开关开着：两颗编辑入口仍可点、无禁用说明行（${JSON.stringify(onState)}）`,
    );
    await popup.click(tid('pm-popup-switch'));
    await waitFor(popup, '开关再关（沿用旧流程的关态基线）', (s) => !document.querySelector(s).checked, [tid('pm-popup-switch')]);
    // 体检回写失效：popup 显示可读文字（不只靠红点 / title），标记结构与「需要允许访问」是同一套
    await patchProfile(ext.control, ORIGIN, { hideRules: [rule('r1', '页头', ['#site-header'], 'stale'), rule('r2', '侧栏', ['#side'])] });
    await popup.waitForSelector(tid('pm-popup-stale'), { timeout: 5000 });
    check((await popup.$eval(tid('pm-popup-stale'), (e) => e.innerText)).includes('1 项可能失效'), 'popup 以文字显示「1 项可能失效」');
    const staleMark = await popup.$eval(tid('pm-popup-stale'), (e) => ({
      classes: [...e.classList],
      first: e.firstElementChild?.className ?? '',
      dots: e.querySelectorAll('.pm-mark-dot').length,
    }));
    check(
      staleMark.classes.includes('pm-mark-danger') && staleMark.first === 'pm-mark-dot' && staleMark.dots === 1,
      `「可能失效」用统一标记：圆点在最前、文字跟上（${staleMark.classes.join('.')}）`,
    );
    // ===================== popup：空设置时开关下的一句说明（#158） =====================
    console.log('\n--- popup：空设置时主开关旁的一句说明（#158） ---');
    // 只开灰度：主开关管不到灰度（ADR-0014）→ 仍算「空设置」，说明要出现
    await patchProfile(ext.control, ORIGIN, { hideRules: [], disguisedTitle: null, titleIconSet: false, mediaGray: true });
    await popup.waitForSelector(tid('pm-popup-switch-empty'), { timeout: 5000 });
    const emptyHint = await popup.evaluate(
      (s, sw) => {
        const hint = document.querySelector(s);
        const input = document.querySelector(sw);
        const h = hint.getBoundingClientRect();
        const i = input.getBoundingClientRect();
        return {
          text: hint.textContent.trim(),
          belowSwitch: h.top >= i.bottom - 1,
          inCard: !!hint.closest('[data-testid="pm-popup-disguise"]'),
          disabled: input.disabled,
          fontSize: getComputedStyle(hint).fontSize,
          // 说明与开关关联（GOV.UK：hint 用 aria-describedby 挂在字段上，读屏一起播报）
          describedby: input.getAttribute('aria-describedby') === hint.id && !!hint.id,
        };
      },
      tid('pm-popup-switch-empty'),
      tid('pm-popup-switch'),
    );
    check(emptyHint.text === '打开后页面不变', `空设置时开关下方写「${emptyHint.text}」（只有灰度也算空）`);
    check(emptyHint.inCard && emptyHint.belowSwitch, '说明在面具卡内、开关下方（跟着它解释的那个开关走）');
    check(emptyHint.disabled === false, '开关照常可拨：不禁用、不隐藏（GOV.UK 禁用态口径）');
    check(emptyHint.fontSize === '13px', `说明与卡内其他说明同档 13px（${emptyHint.fontSize}）`);
    check(emptyHint.describedby, '说明用 aria-describedby 挂在开关上（读屏一起播报）');
    // 空设置时开关仍然照常写入存储（不是死开关）
    await popup.click(tid('pm-popup-switch'));
    await poll(async () => (await getProfile(ext.control, ORIGIN)).switchState === 'disguised', '空设置时开关仍能拨到「按设置」');
    check(true, '空设置时开关照常切换');
    // 有了一条收起内容 → 判据不成立，说明自动消失
    await patchProfile(ext.control, ORIGIN, { hideRules: [rule('r1', '页头', ['#site-header'])] });
    await waitFor(popup, '有了收起内容后说明消失', (s) => !document.querySelector(s), [tid('pm-popup-switch-empty')], { timeout: 5000 });
    check(true, '有收起内容后说明自动消失');
    // 改过标签页标题同样算「有设置」（只改图标同口径，单测覆盖四种情形）
    await patchProfile(ext.control, ORIGIN, { hideRules: [], disguisedTitle: '阅读', titleIconSet: true });
    await new Promise((res) => setTimeout(res, 250));
    check(!(await popup.$(tid('pm-popup-switch-empty'))), '改过标题后说明也不出现');
    // 复原成后续用例的基线（2 条规则、无灰度、原样态）
    await setProfile(ext.control, ORIGIN, profileOf(ORIGIN));
    await poll(async () => {
      const p = await getProfile(ext.control, ORIGIN);
      return p.hideRules.length === 2 && p.mediaGray === undefined && p.switchState === 'original';
    }, '复原 popup 用例基线');

    await checkSchemes(popup, 'popup', 'bg');
    await checkPopupChrome(popup, '已添加');
    await coverAndRestore(ext, popup, site, '已添加的网站');
    await footerLandings(ext, browser, site, '已添加的网站');

    // ===================== popup：删除与「悬浮按钮」开关（#112） =====================
    console.log('\n--- popup：删除与胶囊显示开关 ---');
    const HOST1 = new URL(ORIGIN).hostname; // 确认框标题用 hostname（去 www.，不带端口）
    popup = await openPopup(ext, site); // footerLandings 会关面板：重开一个干净的 ready 弹窗
    await popup.waitForSelector(tid('pm-popup-capsule'), { timeout: 5000 });
    // 高度红线（#112）：加开关行与删除入口后仍要一屏放下（Chrome 弹窗最高 600）
    const popupHeight = await popup.evaluate(() => document.body.scrollHeight);
    check(popupHeight <= 600, `弹窗高度 ${popupHeight} ≤ 600，无纵向滚动`);
    // 开关默认开；关掉 → 页面胶囊卸下，弹窗里站点四件仍然都在
    check(!!(await popup.$(tid('pm-popup-capsule'))), 'ready 状态有「悬浮按钮」开关，默认开');
    check((await popup.$eval(tid('pm-popup-capsule'), (e) => e.checked)) === true, '开关默认为「显示」');
    await popup.click(tid('pm-popup-capsule'));
    await waitFor(site, '页面胶囊卸下', (h) => !document.querySelector(h), ['pagemask-toggle'], { timeout: 5000 });
    check(!(await site.$('pagemask-toggle')), '关掉开关：页面上的胶囊消失');
    for (const id of ['pm-popup-setup', 'pm-popup-title', 'pm-popup-cover', 'pm-popup-delete']) {
      check(!!(await popup.$(tid(id))), `关掉开关后弹窗里仍有 ${id.replace('pm-popup-', '')}`);
    }
    // 重开弹窗：仍是关（按站点持久化）
    await popup.close();
    popup = await openPopup(ext, site);
    await popup.waitForSelector(tid('pm-popup-capsule'), { timeout: 5000 });
    check((await popup.$eval(tid('pm-popup-capsule'), (e) => e.checked)) === false, '重开弹窗：开关仍是关');
    // 藏着时塞旧残留（非默认位置），再打开开关 → 重置为右下角（0.8.6 起无形态之分）
    await patchProfile(ext.control, ORIGIN, { floatingBtnPos: { x: 0, y: 100 } });
    await popup.click(tid('pm-popup-capsule'));
    await site.waitForSelector('pagemask-toggle', { timeout: 5000 });
    await poll(async () => {
      const p = await getProfile(ext.control, ORIGIN);
      return p.floatingBtnPos == null;
    }, '打开开关重置位置');
    check(true, '打开开关：自定义位置残留被清掉（回右下角）');
    // 删除确认框：标题带域名、默认焦点在「取消」；Esc 关闭后焦点回删除按钮
    await popup.click(tid('pm-popup-delete'));
    await popup.waitForSelector(tid('pm-popup-delete-dialog'), { timeout: 3000 });
    const dlgTitle = await popup.$eval(tid('pm-popup-delete-title'), (e) => e.textContent ?? '');
    check(dlgTitle.includes(HOST1), `确认框标题带域名（${dlgTitle}）`);
    check(
      (await popup.evaluate(() => document.activeElement?.getAttribute('data-testid'))) === 'pm-popup-delete-cancel',
      '默认焦点在「取消」',
    );
    await popup.keyboard.press('Escape');
    await waitFor(popup, 'Esc 关闭确认框', () => !document.querySelector('[data-testid="pm-popup-delete-dialog"]').open);
    check(
      (await popup.evaluate(() => document.activeElement?.getAttribute('data-testid'))) === 'pm-popup-delete',
      'Esc 关闭后焦点回到删除按钮',
    );
    // 取消：什么都不动
    await popup.click(tid('pm-popup-delete'));
    await popup.click(tid('pm-popup-delete-cancel'));
    check((await getProfile(ext.control, ORIGIN)) !== null, '取消后设置还在');
    // 确认：配置删除、权限收回、页面胶囊消失、弹窗自动关闭
    await popup.click(tid('pm-popup-delete'));
    await popup.click(tid('pm-popup-delete-confirm'));
    await poll(async () => (await getProfile(ext.control, ORIGIN)) === null, '确认后配置删除');
    await poll(async () => !(await site.$('pagemask-toggle')), '页面上的胶囊随站点删除消失');
    check(
      (await ext.control.evaluate(async (o) => chrome.permissions.contains({ origins: [`${o}/*`] }), ORIGIN)) === false,
      '浏览器给这个站点的访问权限已收回',
    );
    await poll(async () => popup.isClosed(), '删除成功后弹窗自动关闭');
    // 删除是毁伤动作：把站点与权限恢复原样，后续用例继续用
    await setProfile(ext.control, ORIGIN, profileOf(ORIGIN));
    await grantPermissions(ext, [ORIGIN]);

    console.log('\n--- popup：不支持的页面 ---');
    const blank = await browser.newPage();
    await blank.goto('about:blank');
    popup = await openPopup(ext, blank);
    await popup.waitForSelector(tid('pm-popup-unsupported'), { timeout: 5000 });
    const reason = await popup.$eval(tid('pm-popup-unsupported'), (e) => e.textContent.trim());
    check(reason === 'Chrome 自己的页面不让扩展改动，换一个普通网页再试', `不支持页面显示原因（${reason}）`);
    check(!(await popup.$(tid('pm-popup-setup'))), '不支持页面不显示开启按钮');
    await popup.close().catch(() => undefined);
    await blank.close();

    console.log('\n--- popup：新站点（未添加）三件事与遮住开关 ---');
    // 真实入口是点工具栏图标——activeTab 在那一刻才临时授予，自动化点不到工具栏；
    // 这里先授站点权限，让「没有内容脚本、由后台注入一次性脚本」这条路可走（线上靠 activeTab 等价）
    await grantPermissions(ext, [ORIGIN, ORIGIN2]);
    const site2 = await browser.newPage();
    await site2.goto(`${ORIGIN2}/index.html`, { waitUntil: 'load' });
    check(!(await site2.$('pagemask-toggle')), '未添加的网站页面上没有悬浮按钮');
    popup = await openPopup(ext, site2);
    await popup.waitForSelector(tid('pm-popup-setup'), { timeout: 5000 });
    check((await popup.$eval(tid('pm-popup-setup'), (b) => b.textContent.trim())) === '收起内容', '新站点主按钮写「收起内容」');
    check(
      (await popup.$eval(tid('pm-popup-title'), (b) => b.textContent.trim())) === '标题和图标',
      '新站点也有「标题和图标」次按钮（#81 弹窗同构）',
    );
    const newSiteHint = await popup.$eval(tid('pm-popup-hint-new'), (e) => e.textContent.trim()).catch(() => null);
    check(!!newSiteHint && newSiteHint.includes('还没设置过'), `未配置站点有一句说明（${newSiteHint}）`);
    // #148：new 态与 ready 同构，但不放假开关；两颗编辑入口任何状态可点，同位置用肯定句说明开关将来做什么
    const newState = await popup.evaluate(() => {
      const g = document.querySelector('[data-testid="pm-popup-disguise"]');
      return {
        setupDisabled: document.querySelector('[data-testid="pm-popup-setup"]')?.disabled ?? null,
        titleDisabled: document.querySelector('[data-testid="pm-popup-title"]')?.disabled ?? null,
        noFakeSwitch: !g.querySelector('input[role="switch"]'),
        noCapsule: !document.querySelector('[data-testid="pm-popup-capsule"]'),
        cardHint: g.querySelector('.card-switch-hint')?.textContent.trim() ?? '',
      };
    });
    check(
      newState.setupDisabled === false && newState.titleDisabled === false,
      `new 态两颗编辑入口都可点（${JSON.stringify(newState)}）`,
    );
    check(newState.noFakeSwitch && newState.noCapsule, 'new 态面具卡 / 辅助行都不放假开关');
    check(newState.cardHint.length > 0, `new 态同位置有肯定句说明开关设置好之后做什么（${newState.cardHint}）`);
    await checkPopupChrome(popup, '未添加的网站');
    await coverAndRestore(ext, popup, site2, '未添加的网站');

    console.log('\n--- popup：新站点处理中 / 授权被拒 ---');
    popup = await openPopup(ext, site2);
    await popup.waitForSelector(tid('pm-popup-setup'), { timeout: 5000 });
    // 权限请求现在由后台发起（payload 由 core/background-engine.test.ts 覆盖），
    // 这里替换 popup 的消息通道，验证「点击后进入处理中」与「后台回复 denied 时的界面表现」。
    await popup.evaluate(() => {
      window.__pmCalls = 0;
      chrome.runtime.sendMessage = (msg) => {
        if (msg && msg.t === 'enableSite') {
          window.__pmCalls += 1;
          return new Promise((res) => {
            window.__pmReply = res;
          });
        }
        return Promise.resolve(undefined);
      };
    });
    await popup.click(tid('pm-popup-setup'));
    await waitFor(popup, '处理中状态', (s) => document.querySelector(s).textContent.trim() === '正在打开…', [tid('pm-popup-setup')]);
    const busy = await popup.evaluate((s) => ({
      text: document.querySelector(s).textContent.trim(),
      ariaBusy: document.querySelector('main').getAttribute('aria-busy'),
      disabled: document.querySelector(s).disabled,
    }), tid('pm-popup-setup'));
    check(
      busy.text === '正在打开…' && busy.ariaBusy === 'true' && busy.disabled === false,
      `处理中：按钮文字变「${busy.text}」、aria-busy=${busy.ariaBusy}，不设禁用态（原因由文字自己说）`,
    );
    // 处理中再点一次：按钮仍然可点，但不会重复发请求（GOV.UK：不用禁用态挡重复提交）
    await popup.click(tid('pm-popup-setup'));
    check((await popup.evaluate(() => window.__pmCalls)) === 1, '处理中再点一次被忽略，没有重复发请求');
    await popup.evaluate(() => window.__pmReply({ ok: false, code: 'denied' }));
    await popup.waitForSelector(tid('pm-popup-error'), { timeout: 5000 });
    const denied = await popup.evaluate((e, b) => ({
      text: document.querySelector(e).textContent,
      role: document.querySelector(e).getAttribute('role'),
      buttonText: document.querySelector(b).textContent.trim(),
      enabled: !document.querySelector(b).disabled,
    }), tid('pm-popup-error'), tid('pm-popup-setup'));
    check(
      denied.text.includes('允许 PageMask 访问这个网站') && denied.role === 'alert' && denied.enabled && denied.buttonText === '收起内容',
      `授权被拒：role=alert「${denied.text}」，按钮文字回到「${denied.buttonText}」、仍可点`,
    );

    // 遮住失败：给一句人话，按钮恢复可点（页面上没有接收方、后台也注入不了）
    await popup.evaluate(() => {
      chrome.tabs.sendMessage = () => Promise.reject(new Error('没有接收方'));
      chrome.runtime.sendMessage = () => Promise.resolve({ ok: false });
    });
    await popup.click(tid('pm-popup-cover'));
    await popup.waitForSelector(tid('pm-popup-error'), { timeout: 5000 });
    const coverErr = await popup.evaluate((e, b) => ({
      text: document.querySelector(e).textContent,
      enabled: !document.querySelector(b).disabled,
    }), tid('pm-popup-error'), tid('pm-popup-cover'));
    check(coverErr.text.includes('没能遮住这个页面') && coverErr.enabled, `遮住失败给一句人话「${coverErr.text}」，按钮恢复可点`);

    // 遮住开关在处理中同样不禁用：文字变「正在遮住…」，第二次点击被忽略
    await popup.evaluate(() => {
      chrome.tabs.sendMessage = () => new Promise(() => undefined);
      chrome.runtime.sendMessage = () => new Promise(() => undefined);
    });
    await popup.click(tid('pm-popup-cover'));
    await waitFor(
      popup,
      '遮住处理中',
      (s) => document.querySelector(`${s} .popup-cover-label`)?.textContent.trim() === '正在遮住…',
      [tid('pm-popup-cover')],
    );
    const busyCover = await popup.evaluate((s) => ({
      text: document.querySelector(`${s} .popup-cover-label`)?.textContent.trim() ?? '',
      ariaBusy: document.querySelector('main').getAttribute('aria-busy'),
      disabled: document.querySelector(s).disabled,
    }), tid('pm-popup-cover'));
    check(
      busyCover.text === '正在遮住…' && busyCover.ariaBusy === 'true' && busyCover.disabled === false,
      `遮住处理中：按钮文字变「${busyCover.text}」、aria-busy=${busyCover.ariaBusy}，不设禁用态`,
    );

    await popup.close().catch(() => undefined);
    await site2.close();

    // ===================== 管理页 =====================
    console.log('\n--- 管理页：两个 tab 与网站列表 ---');
    await site.close(); // 关掉已配置站点的页面，避免页面里的体检回写干扰下面的断言
    await setProfile(ext.control, ORIGIN, profileOf(ORIGIN));
    let m = await browser.newPage(); // grantPermissions 会重载扩展：扩展页会死，后面用新页替换（#113 段落）
    await m.goto(`${extOrigin}/management.html`, { waitUntil: 'load' });
    await m.waitForSelector(tid('pm-mgmt-site-link'), { timeout: 5000 });
    await m.bringToFront();
    await checkCommon(m, '管理页');
    const HOST = new URL(ORIGIN).host;
    const SITE_HASH = `#/sites/${HOST}`;
    const hash = () => m.evaluate(() => location.hash);

    await poll(async () => (await hash()) === '#/sites', '没有 hash 时落到 #/sites');
    check(true, '首次进入没有 hash 时落到 #/sites');
    check(
      !(await m.$('nav[aria-label="管理页视图"]')) && !(await m.$(tid('pm-mgmt-tab-settings'))),
      '网站列表页没有页内 tab 切换（插件设置是独立页面，#55）',
    );
    const rowText = await m.$eval(`li[data-origin="${siteKeyOf(ORIGIN)}"]`, (e) => e.innerText);
    check(rowText.includes('原样') && rowText.includes('2 项收起设置'), `一行一站：${rowText.split('\n').join(' / ')}`);
    check((await m.$eval(tid('pm-mgmt-site-link'), (a) => a.getAttribute('href'))) === SITE_HASH, `行链接指向 ${SITE_HASH}`);
    // #113：行尾「⋯」收删除菜单；链接与按钮是兄弟不嵌套；读屏名带域名
    check(!!(await m.$(tid('pm-mgmt-site-more'))), '每行行尾有「⋯」按钮（删除收进溢出菜单，不常驻红钮）');
    check(
      (await m.$eval(tid('pm-mgmt-site-more'), (e) => e.getAttribute('aria-label'))) === `更多操作：${HOST}`,
      '「⋯」的读屏名带域名',
    );
    check(
      (await m.$eval(tid('pm-mgmt-site-link'), (a) => a.querySelector('button'))) === null,
      '链接里没有按钮（HTML 合法，读屏不会把两件事读成一个）',
    );
    await checkSchemes(m, '管理页 · 网站', 'bgSubtle');

    console.log('\n--- 管理页：站点设置页（标签页标题、标签页图标、收起的内容、整页变灰、删除设置） ---');
    await m.click(tid('pm-mgmt-site-link'));
    await poll(async () => (await hash()) === SITE_HASH, '点网站行进入 #/sites/<域名>');
    await m.waitForSelector(tid('pm-mgmt-switch'), { timeout: 5000 });
    check((await m.$eval('#pm-site-title', (h) => h.textContent.trim())) === HOST, `站点设置页标题显示域名（${HOST}）`);
    const mgmtSwitch = await findSwitch(m);
    check(mgmtSwitch.node?.name === '按你的设置显示', `站点设置页开关在无障碍树中为 switch「${mgmtSwitch.node?.name}」`);
    await checkCommon(m, '管理页 · 站点设置');
    // 五块标题与顺序从对照表派生（#157；不再各写一份中文串）
    const sections = await m.$$eval('main h3', (hs) => hs.map((h) => h.textContent.trim()));
    const expectedSections = SURFACES.siteSettings.map((row) => row.labelZh);
    check(
      sections.join(' / ') === expectedSections.join(' / '),
      `站点设置页五块标题与顺序来自对照表（${sections.join(' / ')}）`,
    );
    const cardOrder = await m.$$eval('[data-testid^="pm-mgmt-card-"]', (els) => els.map((el) => el.getAttribute('data-testid')));
    check(
      cardOrder.join(' / ') === SURFACES.siteSettings.map((row) => row.control).join(' / '),
      `站点设置页区块渲染顺序与对照表一致（${cardOrder.join(' / ')}）`,
    );
    const bodyText = await m.evaluate(() => document.body.innerText);
    check(
      !/清空|一键|屏蔽|拦截|移除这个网站|配置/.test(bodyText),
      '站点设置页没有「清空 / 一键 / 屏蔽 / 拦截 / 移除这个网站 / 配置」这些旧叫法',
    );

    // 标签页标题：停止输入后自动保存；重新打开管理页值仍在
    const siteTitle = tid('pm-mgmt-title');
    check((await m.$$eval(`${tid('pm-mgmt-title-quick')} button`, (b) => b.length)) === 4, '标签页标题有 4 个快捷填入');
    const SITE_TITLE = '工作台';
    await m.click(siteTitle);
    await m.type(siteTitle, SITE_TITLE);
    await sleep(1200);
    check(
      (await getProfile(ext.control, ORIGIN)).disguisedTitle === SITE_TITLE,
      `停止输入后站点标题自动保存到存储（${SITE_TITLE}）`,
    );
    await m.reload({ waitUntil: 'load' });
    await m.waitForSelector(siteTitle, { timeout: 5000 });
    check((await m.$eval(siteTitle, (i) => i.value)) === SITE_TITLE, '重新打开管理页，站点标题值仍在');
    // 回退出口（#99）：保存过标题和图标之后才出现
    check(!!(await m.$(tid('pm-mgmt-title-reset'))), '站点设置页出现「恢复网站原来的标题和图标」');

    // 标签页图标三态（#121）：选「换成别的图标」→ 点一个预置图标；再切回「网站原来的图标」
    await m.click(tid('pm-mgmt-icon-kind-preset'));
    await m.waitForSelector(tid('pm-mgmt-icon-preset-doc'), { timeout: 3000 });
    await m.click(tid('pm-mgmt-icon-preset-doc'));
    await poll(async () => {
      const icon = (await getProfile(ext.control, ORIGIN)).icon;
      return icon?.kind === 'preset' && icon.id === 'doc';
    }, '选预置图标后写入站点配置（preset:doc）');
    await m.click(tid('pm-mgmt-icon-kind-site'));
    await poll(async () => (await getProfile(ext.control, ORIGIN)).icon?.kind === 'site', '切回网站原来的图标');

    // 收起项清单：名称 + 收起方式 + 人话范围
    check((await m.$$eval(tid('pm-mgmt-rule-row'), (rows) => rows.length)) === 2, '收起的内容按行列出（2 行）');
    const ruleRowText = await m.$eval('li[data-rule-id="r1"]', (e) => e.innerText);
    check(
      ruleRowText.includes('页头') && ruleRowText.includes('消失') && ruleRowText.includes('整个网站'),
      `每行有名称、收起方式与人话范围（${ruleRowText.split('\n').join(' / ')}）`,
    );
    await checkSchemes(m, '管理页 · 站点设置', 'bgSubtle');

    // 另一处（模拟另一个标签页里的体检）回写 lastHealth：触发管理页 storage.onChanged
    await patchProfile(ext.control, ORIGIN, { hideRules: [rule('r1', '页头', ['#site-header'], 'stale'), rule('r2', '侧栏', ['#side'])] });
    await m.waitForSelector(tid('pm-mgmt-rule-stale'), { timeout: 5000 });
    const staleRowText = await m.$eval('li[data-rule-id="r1"]', (e) => e.innerText);
    check(
      staleRowText.includes('可能失效') && staleRowText.includes('「页头」最近在网站上找不到'),
      '「可能失效」写在那一行里，用可读文字说明（不只靠颜色）',
    );

    // 删除 → 5 秒内撤销：撤销后按原下标插回、id 不变
    await m.click(tid('pm-mgmt-rule-delete-r1'));
    await poll(async () => (await getProfile(ext.control, ORIGIN)).hideRules.length === 1, '删除一条后只剩 1 条');
    const undoText = await m.$eval(tid('pm-mgmt-undo'), (e) => e.innerText);
    check(undoText.includes('已删除「页头」'), `出现可撤销提示（${undoText.trim()}）`);
    await m.click(tid('pm-mgmt-undo-btn'));
    const restored = await poll(async () => {
      const p = await getProfile(ext.control, ORIGIN);
      return p.hideRules.length === 2 ? p : null;
    }, '撤销后规则回到 2 条');
    check(
      restored.hideRules.map((x) => x.id).join() === 'r1,r2',
      `撤销按原下标插回、id 不变（${restored.hideRules.map((x) => x.id).join('、')}）`,
    );

    // ===================== 恢复网站原来的内容（#160） =====================
    console.log('\n--- 站点设置页：恢复网站原来的内容（只动收起项） ---');
    // 换成「只有收起项」的站点：标题图标空着、灰度与开关各有值，验证复位只碰 hideRules
    await setProfile(ext.control, ORIGIN, {
      ...profileOf(ORIGIN),
      switchState: 'disguised',
      disguisedTitle: null,
      titleIconSet: false,
      mediaGray: true,
    });
    await m.waitForSelector(tid('pm-mgmt-rules-reset-row'), { timeout: 5000 });
    const resetRowText = await m.$eval(tid('pm-mgmt-rules-reset-row'), (e) => e.innerText.trim());
    check(
      resetRowText.includes('恢复网站原来的内容') && resetRowText.includes('只恢复收起的内容，标题和图标不受影响'),
      `有已保存的收起项时出现复位行，文字逐字对（${resetRowText.split('\n').join(' / ')}）`,
    );
    check((await m.$$eval(tid('pm-mgmt-rule-row'), (rows) => rows.length)) === 2, '复位行出现时清单仍是 2 行');

    // 取消分支：标题 / 正文 / 按钮文字、默认焦点在「取消」；关闭后规则与 updatedAt 都不动
    const beforeCancel = await getProfile(ext.control, ORIGIN);
    await m.click(tid('pm-mgmt-rules-reset'));
    await waitFor(m, '恢复内容确认框打开', (s) => document.querySelector(s).matches(':modal'), [tid('pm-mgmt-rules-reset-dialog')]);
    const rulesResetInfo = await m.evaluate(
      (dlgSel, cancelSel, confirmSel) => {
        const d = document.querySelector(dlgSel);
        const confirm = document.querySelector(confirmSel);
        return {
          focus: document.activeElement?.textContent?.trim(),
          title: document.querySelector('[data-testid="pm-mgmt-rules-reset-title"]')?.textContent.trim() ?? '',
          impact: document.querySelector('[data-testid="pm-mgmt-rules-reset-impact"]')?.textContent.trim() ?? '',
          cancel: document.querySelector(cancelSel)?.textContent.trim() ?? '',
          confirm: confirm?.textContent.trim() ?? '',
          confirmDanger: confirm?.classList.contains('danger') === true,
          confirmSolid: confirm?.classList.contains('primary') === true,
        };
      },
      tid('pm-mgmt-rules-reset-dialog'),
      tid('pm-mgmt-rules-reset-cancel'),
      tid('pm-mgmt-rules-reset-confirm'),
    );
    check(rulesResetInfo.focus === '取消', `原生模态框，默认焦点在「${rulesResetInfo.focus}」`);
    check(
      rulesResetInfo.title === '恢复网站原来的内容？' && rulesResetInfo.impact === '2 项收起设置会全部删除。',
      `确认框标题与正文逐字对（${rulesResetInfo.title} / ${rulesResetInfo.impact}）`,
    );
    check(
      rulesResetInfo.cancel === '取消' && rulesResetInfo.confirm === '恢复内容' && rulesResetInfo.confirmDanger && !rulesResetInfo.confirmSolid,
      `按钮文字逐字对，确认是红字红边、不填实心红（${rulesResetInfo.cancel} / ${rulesResetInfo.confirm}）`,
    );
    await m.click(tid('pm-mgmt-rules-reset-cancel'));
    await waitFor(m, '取消后确认框关闭', (s) => !document.querySelector(s).open, [tid('pm-mgmt-rules-reset-dialog')]);
    const afterCancel = await getProfile(ext.control, ORIGIN);
    check(
      afterCancel.hideRules.length === 2 && afterCancel.updatedAt === beforeCancel.updatedAt,
      '取消：收起项与 updatedAt 都没变',
    );
    await poll(
      async () => (await m.evaluate(() => document.activeElement?.textContent?.trim())) === '恢复网站原来的内容',
      '取消后焦点回到触发按钮（原生 dialog 行为，不去抢）',
    );

    // 先删一条（撤销条挂着）→ 复位 → 撤销条消失，不能把那条插回空列表
    await m.click(tid('pm-mgmt-rule-delete-r1'));
    await poll(async () => (await getProfile(ext.control, ORIGIN)).hideRules.length === 1, '删除一条后只剩 1 条');
    await m.waitForSelector(tid('pm-mgmt-undo-btn'), { timeout: 3000 });
    await m.click(tid('pm-mgmt-rules-reset'));
    await waitFor(m, '复位确认框再次打开', (s) => document.querySelector(s).matches(':modal'), [tid('pm-mgmt-rules-reset-dialog')]);
    await m.click(tid('pm-mgmt-rules-reset-confirm'));
    const cleared = await poll(async () => {
      const p = await getProfile(ext.control, ORIGIN);
      return p.hideRules.length === 0 ? p : null;
    }, '确认后收起项清空');
    check(
      cleared.switchState === 'disguised' && cleared.titleIconSet === false && cleared.mediaGray === true,
      `复位只动收起项：开关 / 标题图标 / 灰度原样（${JSON.stringify({ state: cleared.switchState, titleIconSet: cleared.titleIconSet, mediaGray: cleared.mediaGray })}）`,
    );
    await m.waitForSelector(tid('pm-mgmt-no-rules'), { timeout: 5000 });
    check(!(await m.$(tid('pm-mgmt-rule-list'))), '清单消失，换成空状态');
    check(!(await m.$(tid('pm-mgmt-rules-reset-row'))), '没有收起项后复位行自己消失');
    const clearedCount = await m.$eval(tid('pm-mgmt-count'), (e) => e.innerText.trim());
    check(clearedCount.includes('还没有收起设置'), `计数改成「${clearedCount}」`);
    const undoAfterReset = await m.$eval(tid('pm-mgmt-undo'), (e) => e.innerText.trim());
    check(!undoAfterReset.includes('已删除'), `复位后撤销条消失（${undoAfterReset || '空'}）`);
    // 标题图标都空着时，#158 那句「打开后页面不变」跟着出现
    await m.waitForSelector(tid('pm-mgmt-switch-empty'), { timeout: 5000 });
    check(true, '清到空设置后，开关旁那句「打开后页面不变」出现（#158）');
    await poll(
      async () => (await m.evaluate(() => document.activeElement?.textContent?.trim())) === '收起的内容',
      '确认后焦点回到「收起的内容」卡标题（触发按钮已随列表消失）',
    );
    await setProfile(ext.control, ORIGIN, profileOf(ORIGIN));
    await m.waitForSelector(tid('pm-mgmt-rules-reset-row'), { timeout: 5000 });

    // 这一页只读清单：不再有「在页面上编辑」，改成一句指回页面的话（#71）
    check(!(await m.$(tid('pm-mgmt-edit-on-page'))), '「在页面上编辑」已经拿掉（它不知道该去哪个页面）');
    const editHint = await m.$eval(tid('pm-mgmt-edit-hint'), (e) => e.textContent.trim());
    check(
      editHint.includes('工具栏上的 PageMask 图标') && editHint.includes('收起内容'),
      `改成一句指回页面的话（${editHint}）`,
    );

    // 开关
    await m.click(tid('pm-mgmt-switch'));
    await poll(async () => (await getProfile(ext.control, ORIGIN)).switchState === 'disguised', '站点设置页切换清爽模式写入存储');
    check(true, '站点设置页切换清爽模式写入存储');

    // 删除这个网站的设置：入口在本页页脚，二次确认带域名、列明影响、默认聚焦「取消」、Esc 不删
    await m.click(tid('pm-mgmt-reset'));
    await waitFor(m, '删除确认框打开', (s) => document.querySelector(s).matches(':modal'), [tid('pm-mgmt-reset-dialog')]);
    const resetInfo = await m.evaluate(
      (s, confirmSel) => {
        const d = document.querySelector(s);
        const title = document.getElementById(d.getAttribute('aria-labelledby'));
        const btn = document.querySelector(confirmSel);
        const probe = document.createElement('span');
        probe.style.color = getComputedStyle(document.body).getPropertyValue('--pm-danger');
        document.body.appendChild(probe);
        const danger = getComputedStyle(probe).color;
        probe.remove();
        return {
          focus: document.activeElement?.textContent?.trim(),
          title: title?.textContent ?? '',
          impact: d.querySelector('[data-testid="pm-mgmt-reset-impact"]')?.innerText ?? '',
          confirm: btn?.textContent?.trim() ?? '',
          confirmBg: btn ? getComputedStyle(btn).backgroundColor : '',
          danger,
        };
      },
      tid('pm-mgmt-reset-dialog'),
      tid('pm-mgmt-reset-confirm'),
    );
    check(resetInfo.focus === '取消', `原生模态 <dialog>，默认聚焦安全按钮「${resetInfo.focus}」`);
    check(
      resetInfo.title === `删除 ${HOST} 的设置？` && resetInfo.impact.includes('标签页标题、图标、收起的内容都会删掉'),
      `确认框标题带域名、正文说清删什么（${resetInfo.title} / ${resetInfo.impact}）`,
    );
    check(
      resetInfo.confirm === '删除设置' && resetInfo.confirmBg === resetInfo.danger,
      `危险按钮是实底红、写「${resetInfo.confirm}」（${resetInfo.confirmBg}）`,
    );
    await m.keyboard.press('Escape');
    await waitFor(m, 'Esc 关闭确认框', (s) => !document.querySelector(s).open, [tid('pm-mgmt-reset-dialog')]);
    check((await getProfile(ext.control, ORIGIN)) !== null, 'Esc 关闭确认框不删除');

    // 浏览器后退回到列表
    await m.evaluate(() => history.back());
    await poll(async () => (await hash()) === '#/sites', '浏览器后退回到 #/sites');
    await m.waitForSelector(tid('pm-mgmt-site-link'), { timeout: 5000 });
    check((await m.$eval(`li[data-origin="${siteKeyOf(ORIGIN)}"]`, (e) => e.innerText)).includes('按设置'), '列表反映刚切换的状态');

    // 直接打开带 hash 的地址（含站点设置页）
    await m.goto(`${extOrigin}/management.html${SITE_HASH}`, { waitUntil: 'load' });
    await m.waitForSelector(tid('pm-mgmt-switch'), { timeout: 5000 });
    check((await hash()) === SITE_HASH, '直接粘贴站点设置地址能落在该站的设置页');

    console.log('\n--- 管理页：空设置时页头开关下的一句说明（#158） ---');
    // 只有灰度：灰度不受主开关管 → 说明仍在（灰-only 站点不该被当成「有设置」）
    await setProfile(ext.control, ORIGIN, { ...profileOf(ORIGIN), hideRules: [], disguisedTitle: null, mediaGray: true });
    await m.waitForSelector(tid('pm-mgmt-switch-empty'), { timeout: 5000 });
    const mgmtEmpty = await m.evaluate(
      (s, sw) => {
        const hint = document.querySelector(s);
        const input = document.querySelector(sw);
        const h = hint.getBoundingClientRect();
        const i = input.getBoundingClientRect();
        return { text: hint.textContent.trim(), belowSwitch: h.top >= i.bottom - 1, disabled: input.disabled, describedby: input.getAttribute('aria-describedby') === hint.id && !!hint.id };
      },
      tid('pm-mgmt-switch-empty'),
      tid('pm-mgmt-switch'),
    );
    check(mgmtEmpty.text === '打开后页面不变', `站点设置页同一句话（${mgmtEmpty.text}）`);
    check(mgmtEmpty.belowSwitch, '说明在页头开关下方');
    check(mgmtEmpty.disabled === false, '设置页开关照常可拨（不禁用、不隐藏）');
    check(mgmtEmpty.describedby, '说明用 aria-describedby 挂在开关上（读屏一起播报）');
    // 有收起内容 → 说明自动消失
    await setProfile(ext.control, ORIGIN, profileOf(ORIGIN));
    await waitFor(m, '有设置后站点设置页的说明消失', (s) => !document.querySelector(s), [tid('pm-mgmt-switch-empty')], { timeout: 5000 });
    check(true, '有设置后站点设置页的说明自动消失');

    console.log('\n--- 管理页：0 条规则的站点 ---');
    await setProfile(ext.control, ORIGIN, { ...profileOf(ORIGIN), disguisedTitle: SITE_TITLE, hideRules: [] });
    await m.waitForSelector(tid('pm-mgmt-no-rules'), { timeout: 5000 });
    const zeroCount = await m.$eval(tid('pm-mgmt-count'), (e) => e.innerText.trim());
    check(zeroCount.includes('还没有收起设置') && !zeroCount.includes('0 项'), `0 条规则时本页说「${zeroCount}」`);
    await m.click(tid('pm-mgmt-reset'));
    await waitFor(m, '0 条规则的确认框打开', (s) => document.querySelector(s).matches(':modal'), [tid('pm-mgmt-reset-dialog')]);
    const zeroImpact = await m.$eval(tid('pm-mgmt-reset-impact'), (e) => e.innerText);
    check(
      !/\d+\s*个收起项/.test(zeroImpact) && zeroImpact.includes('标签页标题、图标、收起的内容'),
      `0 条规则时确认框不出现「0 个收起项」（${zeroImpact}）`,
    );
    await m.keyboard.press('Escape');
    await waitFor(m, 'Esc 关闭确认框（0 条规则）', (s) => !document.querySelector(s).open, [tid('pm-mgmt-reset-dialog')]);
    await m.evaluate(() => {
      location.hash = '#/sites';
    });
    await m.waitForSelector(tid('pm-mgmt-site-link'), { timeout: 5000 });
    const zeroRow = await m.$eval(`li[data-origin="${siteKeyOf(ORIGIN)}"]`, (e) => e.innerText);
    check(
      zeroRow.includes('还没有收起设置') && !zeroRow.includes('0 项'),
      `列表行也不写「0 项」（${zeroRow.split('\n').join(' / ')}）`,
    );
    await setProfile(ext.control, ORIGIN, profileOf(ORIGIN));

    // ===================== 管理页：列表行尾删除（#113） =====================
    console.log('\n--- 管理页：行尾「⋯」菜单与逐行删除 ---');
    // 打开菜单：焦点进菜单项；Esc 关闭、焦点回「⋯」；点外面也关
    await m.click(tid('pm-mgmt-site-more'));
    await m.waitForSelector(tid('pm-mgmt-site-menu'), { timeout: 3000 });
    check((await m.$eval(tid('pm-mgmt-site-more'), (e) => e.getAttribute('aria-expanded'))) === 'true', '⋯ aria-expanded=true');
    check(
      (await m.evaluate(() => document.activeElement?.getAttribute('data-testid'))) === 'pm-mgmt-row-delete',
      '菜单打开后焦点进菜单项',
    );
    await m.keyboard.press('Escape');
    await waitFor(m, 'Esc 关菜单', () => !document.querySelector('[data-testid="pm-mgmt-site-menu"]'));
    check(
      (await m.evaluate(() => document.activeElement?.getAttribute('data-testid'))) === 'pm-mgmt-site-more',
      'Esc 关闭后焦点回「⋯」',
    );
    await m.click(tid('pm-mgmt-site-more'));
    await m.waitForSelector(tid('pm-mgmt-site-menu'), { timeout: 3000 });
    await m.click('.view-title');
    await waitFor(m, '点外面关菜单', () => !document.querySelector('[data-testid="pm-mgmt-site-menu"]'));
    // 菜单项 → 共用确认框：标题带域名、取消不动
    await m.click(tid('pm-mgmt-site-more'));
    await m.waitForSelector(tid('pm-mgmt-site-menu'), { timeout: 3000 });
    await m.click(tid('pm-mgmt-row-delete'));
    await m.waitForSelector(tid('pm-mgmt-reset-dialog'), { timeout: 3000 });
    check((await m.$eval(tid('pm-mgmt-reset-dialog'), (d) => d.open)) === true, '列表发起的删除也走共用确认框');
    check((await m.$eval(tid('pm-mgmt-reset-title'), (e) => e.textContent)).includes(HOST), `确认框标题带域名（${HOST}）`);
    await m.click(tid('pm-mgmt-reset-cancel'));
    check((await getProfile(ext.control, ORIGIN)) !== null, '取消后设置还在');
    // 确认：行消失、留在列表、权限收回
    await m.click(tid('pm-mgmt-site-more'));
    await m.waitForSelector(tid('pm-mgmt-site-menu'), { timeout: 3000 });
    await m.click(tid('pm-mgmt-row-delete'));
    await m.waitForSelector(tid('pm-mgmt-reset-dialog'), { timeout: 3000 });
    await m.click(tid('pm-mgmt-reset-confirm'));
    await poll(async () => (await getProfile(ext.control, ORIGIN)) === null, '确认后配置删除');
    await poll(async () => !(await m.$(`li[data-origin="${siteKeyOf(ORIGIN)}"]`)), '列表行消失');
    check((await hash()) === '#/sites', '删除后仍留在列表');
    check(
      (await ext.control.evaluate(async (o) => chrome.permissions.contains({ origins: [`${o}/*`] }), ORIGIN)) === false,
      '权限收回（与详情页删除同一套收尾）',
    );
    // 恢复现场给下面的用例（grantPermissions 重载扩展会杀掉扩展页：关掉重建一个）
    await setProfile(ext.control, ORIGIN, profileOf(ORIGIN));
    await grantPermissions(ext, [ORIGIN]);
    await m.close().catch(() => undefined);
    m = await browser.newPage();
    await m.goto(`${extOrigin}/management.html`, { waitUntil: 'load' });
    await m.waitForSelector(tid('pm-mgmt-site-link'), { timeout: 5000 });
    // 两个入口必须是同一个控件（#124）：先把「全部网站设置」那颗量下来，等下比对
    const mgmtLinkLook = await m.$eval(tid('pm-mgmt-settings-link'), (a) => {
      const s = getComputedStyle(a);
      const r = a.getBoundingClientRect();
      return { cls: a.className, h: Math.round(r.height), font: s.fontSize, weight: s.fontWeight, border: s.borderTopWidth };
    });

    console.log('\n--- 插件设置页（默认标题、关于） ---');
    await m.goto(`${extOrigin}/settings.html`, { waitUntil: 'load' });
    await m.waitForSelector(tid('pm-settings-default-title'), { timeout: 5000 });
    await checkCommon(m, '插件设置');
    const backLink = await m.$eval(tid('pm-settings-sites-link'), (a) => {
      const s = getComputedStyle(a);
      const r = a.getBoundingClientRect();
      return {
        text: a.textContent.trim(),
        href: a.getAttribute('href'),
        cls: a.className,
        h: Math.round(r.height),
        font: s.fontSize,
        weight: s.fontWeight,
        border: s.borderTopWidth,
      };
    });
    check(
      backLink.text === '全部网站设置' && backLink.href === 'management.html#/sites',
      '标题行右侧有回「全部网站设置」的入口',
    );
    check(
      backLink.cls === mgmtLinkLook.cls &&
        backLink.h === mgmtLinkLook.h &&
        backLink.font === mgmtLinkLook.font &&
        backLink.weight === mgmtLinkLook.weight &&
        Number.parseFloat(backLink.border) > 0,
      `两页的互跳入口是同一个控件（两处 class=“${backLink.cls}”、高 ${backLink.h} / ${mgmtLinkLook.h}、字号 ${backLink.font}）`,
    );
    const manifest = JSON.parse(fs.readFileSync(ext.manifestPath, 'utf8'));
    check(manifest.options_ui?.page === 'settings.html' && manifest.options_ui?.open_in_tab === true, '插件设置页注册为扩展程序选项，且在标签页里打开');
    const shownVersion = await m.$eval(tid('pm-settings-version'), (e) => e.textContent.trim());
    check(shownVersion === manifest.version, `「关于」显示版本号 ${shownVersion}`);
    check(!!(await m.$('a[href="https://github.com/cherishfall/page-mask/issues"]')), '「关于」有指向 GitHub issues 的反馈入口');

    // 胶囊不透明度（#110）：一根 10%–100% 的滑杆，预览即时、存储在松手时写
    const previewOpacity = () =>
      m.$eval(`${tid('pm-settings-toggle')} ${tid('pm-toggle')}`, (e) => parseFloat(getComputedStyle(e).opacity));
    check((await previewOpacity()) === 1, '默认 100%：预览胶囊不透明度为 1');
    const setSlider = async (v) => {
      await m.$eval(
        tid('pm-settings-opacity'),
        (el, val) => {
          el.value = String(val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        },
        v,
      );
      await m.$eval(tid('pm-settings-opacity'), (el) => el.dispatchEvent(new Event('change', { bubbles: true })));
    };
    await setSlider(30);
    await poll(async () => (await getSettings(ext.control)).toggleOpacity === 0.3, '松手后 30% 写入存储');
    check((await previewOpacity()) === 0.3, `预览当场变淡（${await previewOpacity()}）`);
    check(!!(await m.$(tid('pm-settings-opacity-low'))), '≤30% 出现「调得太淡会不容易找到」提示（role=status）');
    check(
      (await m.$eval(tid('pm-settings-opacity'), (e) => e.getAttribute('aria-valuetext'))) === '30%',
      '滑杆 aria-valuetext 是百分比',
    );
    await setSlider(10);
    await poll(async () => (await getSettings(ext.control)).toggleOpacity === 0.1, '下限 10% 可写');
    await setSlider(100);
    await poll(async () => (await getSettings(ext.control)).toggleOpacity === 1, '拖回 100% 写入存储');
    check((await previewOpacity()) === 1, '拖回 100%：预览恢复全不透明');
    check(!(await m.$(tid('pm-settings-opacity-low'))), '回到 100% 后低档提示消失');

    // 编辑态与存储态分离：插件设置页的全局默认标题
    const titleSel = tid('pm-settings-default-title');
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

    console.log('\n--- 插件设置页：导入 ---');
    const writeJson = (name, data) => {
      const f = path.join(tmp, name);
      fs.writeFileSync(f, typeof data === 'string' ? data : JSON.stringify(data));
      return f;
    };
    const importInput = () => m.$(tid('pm-settings-import-input'));
    // 导入方式在按钮之前
    const order = await m.evaluate(
      (s) => !!(document.querySelector('fieldset.import-mode').compareDocumentPosition(document.querySelector(s)) & Node.DOCUMENT_POSITION_FOLLOWING),
      tid('pm-settings-import-input'),
    );
    check(order, '导入方式（fieldset）排在选择文件按钮之前');
    // 导入失败用人话
    await (await importInput()).uploadFile(writeJson('broken.json', '{ not json'));
    await waitFor(m, '导入失败提示', (s) => document.querySelector(s).textContent.includes('导入失败'), [tid('pm-settings-import-result')]);
    const failText = await m.$eval(tid('pm-settings-import-result'), (e) => e.textContent.trim());
    check(failText.startsWith('导入失败：这个文件不是 PageMask') && !/[A-Za-z]/.test(failText.replace(/PageMask/g, '')), `导入失败用人话（${failText}）`);
    // 整体替换：先确认，列出影响
    const OTHER = 'https://example.com';
    const bundle = { app: 'pagemask', formatVersion: 1, exportedAt: new Date().toISOString(), profiles: [profileOf(OTHER, { hideRules: [rule('x1', '广告', ['.ad'])] })] };
    const bundleFile = writeJson('replace.json', bundle);
    await m.click('label[for="pm-settings-import-replace"]');
    await (await importInput()).uploadFile(bundleFile);
    await waitFor(m, '替换确认框打开', (s) => document.querySelector(s).matches(':modal'), [tid('pm-settings-replace-dialog')]);
    const impact = await m.evaluate((s) => ({ text: document.querySelector(s).innerText, focus: document.activeElement?.textContent?.trim() }), tid('pm-settings-replace-impact'));
    check(
      impact.text.includes('1 个网站、2 项收起设置会全部被替换') && impact.text.includes('本机不再保留') && impact.text.includes('127.0.0.1') && impact.text.includes('换成文件里的 1 个网站、1 项收起设置'),
      `替换确认框列出影响：\n      ${impact.text.split('\n').join('\n      ')}`,
    );
    check(impact.focus === '取消', '替换确认框默认聚焦「取消」');
    await (await m.waitForSelector(`xpath/.//dialog[@data-testid="pm-settings-replace-dialog"]//button[normalize-space()="取消"]`)).click();
    await waitFor(m, '取消后提示', (s) => document.querySelector(s).textContent.includes('已取消导入'), [tid('pm-settings-import-result')]);
    check((await getProfile(ext.control, ORIGIN)) !== null && (await getProfile(ext.control, OTHER)) === null, '取消整体替换：本机数据没有改动');

    // 深浅色 / 对比度（确认框打开时也检查一次）
    await checkSchemes(m, '插件设置', 'bgSubtle');
    await (await importInput()).uploadFile(bundleFile);
    await waitFor(m, '替换确认框再次打开', (s) => document.querySelector(s).open, [tid('pm-settings-replace-dialog')]);
    await checkSchemes(m, '插件设置（确认框打开）', 'bgSubtle');
    await (await m.waitForSelector(`xpath/.//dialog[@data-testid="pm-settings-replace-dialog"]//button[normalize-space()="确认替换"]`)).click();
    await waitFor(m, '整体替换完成', (s) => document.querySelector(s).textContent.includes('导入完成'), [tid('pm-settings-import-result')]);
    check(
      (await getProfile(ext.control, ORIGIN)) === null && (await getProfile(ext.control, OTHER)) !== null,
      `确认后整体替换生效（${await m.$eval(tid('pm-settings-import-result'), (e) => e.textContent.trim())}）`,
    );

    console.log('\n--- 管理页：待授权站点 ---');
    // 整体替换后只剩 example.com（从没授权过）；再补回原站点并收回它的授权，两个站点都待授权。
    // 原站点留一条可能失效的收起项：同一行里同时出现「需要允许访问」（warning）与「可能失效」（danger），
    // 用来核对两种异常标记是不是同一套结构（#72）。
    await setProfile(ext.control, ORIGIN, profileOf(ORIGIN, { hideRules: [rule('r1', '页头', ['#site-header'], 'stale'), rule('r2', '侧栏', ['#side'])] }));
    await removePermission(ext.control, ORIGIN);
    await m.click(tid('pm-settings-sites-link'));
    await poll(
      async () => (await m.evaluate(() => location.pathname)) === '/management.html' && (await hash()) === '#/sites',
      '点返回链接回到「全部网站设置」',
    );
    await m.waitForSelector(tid('pm-mgmt-pending-all'), { timeout: 5000 });
    const pendingText = await m.$eval(tid('pm-mgmt-pending-all'), (e) => e.innerText);
    check(pendingText.includes('2 个网站还没允许访问') && pendingText.includes('全部允许'), `两个以上待授权时出现「一次授权全部」（${pendingText.split('\n')[0]}）`);
    const pendingRows = await m.$$eval(tid('pm-mgmt-pending'), (rows) => rows.length);
    check(pendingRows === 2, `待授权站点在行里给出「授权并启用」（${pendingRows} 行）`);
    // 两种异常标记：同一个类、同一个圆点位置，只有颜色不同（#72）
    const marks = await m.evaluate((row) => {
      const el = document.querySelector(row);
      const shape = (node) => ({
        classes: [...node.classList],
        first: node.firstElementChild?.className ?? '',
        dotCount: node.querySelectorAll('.pm-mark-dot').length,
        color: getComputedStyle(node).color,
        text: node.textContent.trim(),
      });
      return {
        danger: shape(el.querySelector('[data-testid="pm-mgmt-row-stale"]')),
        warning: shape(el.querySelector('.pm-mark-warning')),
      };
    }, `li[data-origin="${siteKeyOf(ORIGIN)}"]`);
    check(
      marks.danger.classes.includes('pm-mark') && marks.warning.classes.includes('pm-mark') &&
        marks.danger.first === 'pm-mark-dot' && marks.warning.first === 'pm-mark-dot' &&
        marks.danger.dotCount === 1 && marks.warning.dotCount === 1,
      `两种异常标记结构一致：都是 .pm-mark、圆点在最前（${marks.warning.text} / ${marks.danger.text}）`,
    );
    check(
      marks.danger.color !== marks.warning.color && marks.danger.classes.includes('pm-mark-danger') && marks.warning.classes.includes('pm-mark-warning'),
      `只用颜色区分「要你处理」与「已经坏了」（warning ${marks.warning.color} / danger ${marks.danger.color}）`,
    );
    await checkSchemes(m, '管理页 · 待授权', 'bgSubtle');

    // 站点设置页顶部也能授权，授权成功后本页立即变为可用
    // （直接落到站点设置页：列表行里也有 pm-mgmt-pending，等它会误判成"已经在设置页上"）
    await m.evaluate((o) => {
      location.hash = `#/sites/${new URL(o).host}`;
    }, ORIGIN);
    await m.waitForSelector(tid('pm-mgmt-pending'), { timeout: 5000 });
    // 权限弹窗本身无法自动化：替换 contains / request 两个替身，验证「允许」之后本页立即刷新
    await m.evaluate(() => {
      window.__pmRequests = [];
      chrome.permissions.contains = async () => true;
      chrome.permissions.request = async (p) => {
        window.__pmRequests.push(p);
        return true;
      };
    });
    await m.click(tid('pm-mgmt-authorize'));
    await waitFor(m, '授权后本页不再显示待授权', (s) => !document.querySelector(s), [tid('pm-mgmt-pending')]);
    const authReq = await m.evaluate(() => window.__pmRequests);
    check(
      authReq.length === 1 && sitePatternsOf(ORIGIN).every((p) => authReq[0].origins.includes(p)),
      `「授权并启用」为这个站点发起了权限请求（${JSON.stringify(authReq[0]?.origins)}）`,
    );
    await m.evaluate(() => {
      location.hash = '#/sites';
    });
    await m.waitForSelector(tid('pm-mgmt-site-link'), { timeout: 5000 });

    console.log('\n--- 管理页：空状态 ---');
    await ext.control.evaluate(() => chrome.storage.local.clear());
    await m.waitForSelector(tid('pm-mgmt-empty'), { timeout: 5000 });
    const emptyText = await m.$eval(tid('pm-mgmt-empty'), (e) => e.innerText);
    check(emptyText.includes('还没有添加任何网站') && emptyText.includes('PageMask 图标'), '没有网站时给出引导文案');
    await checkSchemes(m, '管理页 · 空状态', 'bgSubtle');
    await m.close();

    // ===================== 存储懒迁移（#162：旧 profile:<origin> 键 → 站点 key） =====================
    console.log('\n--- 存储：旧 profile:<origin> 键懒迁移到站点 key ---');
    {
      // 独立端口，避免与本文件里其它站点配置互相干扰
      const srvLegacy = await startServer(handler);
      const LEGACY = srvLegacy.origin; // 升级前写进 key 与 origin 字段的旧形态
      const LEGACY_KEY = siteKeyOf(LEGACY); // 站点 key：保留端口、不含协议
      const older = now - 60_000;
      const legacyHttp = profileOf(LEGACY, {
        hideRules: [rule('old-http', '页头', ['#site-header'])],
        disguisedTitle: '旧标题',
        createdAt: older,
        updatedAt: older,
      });
      // 同站点的另一条旧协议键：合并后规则并集、站点级字段取较新者
      const legacyHttps = profileOf(`https://${LEGACY_KEY}`, {
        hideRules: [rule('old-https', '侧栏', ['#side'])],
        disguisedTitle: '新标题',
        createdAt: older,
        updatedAt: now,
      });
      await ext.control.evaluate(
        async (a, b, pa, pb) => {
          await chrome.storage.local.clear();
          await chrome.storage.local.set({ [a]: pa, [b]: pb });
        },
        `profile:${LEGACY}`,
        `profile:https://${LEGACY_KEY}`,
        legacyHttp,
        legacyHttps,
      );
      let mm;
      try {
        // 管理页读列表时触发懒迁移（listProfiles → ensureMigrated）
        mm = await browser.newPage();
        await mm.goto(`${extOrigin}/management.html#/sites`, { waitUntil: 'load' });
        await mm.waitForSelector(tid('pm-mgmt-site-link'), { timeout: 5000 });
        const rows = await mm.$$eval(tid('pm-mgmt-site-link'), (els) => els.length);
        check(rows === 1, `迁移后列表里只有这 1 个站点（实际 ${rows} 行）`);

        const after = await ext.control.evaluate(
          async (oldHttpKey, oldHttpsKey, newKey) => {
            const all = await chrome.storage.local.get(null);
            return {
              oldHttp: oldHttpKey in all,
              oldHttps: oldHttpsKey in all,
              legacyProfile: all[newKey] ?? null,
            };
          },
          `profile:${LEGACY}`,
          `profile:https://${LEGACY_KEY}`,
          `profile:${LEGACY_KEY}`,
        );
        check(!after.oldHttp && !after.oldHttps, '两条旧 origin 键都已删除');
        check(after.legacyProfile !== null, `新键是 profile:${LEGACY_KEY}`);
        const merged = after.legacyProfile;
        check(merged?.origin === LEGACY_KEY, `合并后的 origin 字段是站点 key（${merged?.origin}）`);
        check(
          merged?.hideRules?.length === 2 && new Set(merged.hideRules.map((r) => r.id)).size === 2,
          `规则取并集（${merged?.hideRules?.map((r) => r.id).join(' + ')}）`,
        );
        check(merged?.disguisedTitle === '新标题', `站点级字段取 updatedAt 较新的一方（标题：${merged?.disguisedTitle}）`);
      } finally {
        await mm?.close().catch(() => undefined);
        await ext.control.evaluate(() => chrome.storage.local.clear()).catch(() => undefined);
        await srvLegacy.close();
      }
    }

    // ===================== 旧入口清理（#56） =====================
    console.log('\n--- 旧地址 #/add 不再可达，落到网站列表 ---');
    await grantPermissions(ext, [ORIGIN, ORIGIN2]);
    const HOST2 = new URL(ORIGIN2).host;
    await setProfile(ext.control, ORIGIN2, profileOf(ORIGIN2));
    const oldAdd = await browser.newPage();
    await oldAdd.goto(`${extOrigin}/management.html#/add/${encodeURIComponent(ORIGIN2)}`, { waitUntil: 'load' });
    await poll(async () => (await oldAdd.evaluate(() => location.hash)) === '#/sites', '#/add 被改写成 #/sites');
    await oldAdd.waitForSelector(tid('pm-mgmt-site-link'), { timeout: 5000 });
    check(
      !(await oldAdd.$(tid('pm-mgmt-add-site'))) && !(await oldAdd.$('#pm-add-title-input')),
      '旧「待添加」页的「添加这个网站」与标题输入框都不在了，落在网站列表上',
    );
    check(
      (await oldAdd.evaluate((h) => [...document.querySelectorAll('.site-host')].some((e) => e.textContent.trim() === h), HOST2)) === true,
      `列表里能看到 ${HOST2}（它已经作为正常站点存在）`,
    );
    await oldAdd.close();

    // ===================== 引导页（0.8.11，#139：分步单屏） =====================
    console.log('\n--- 引导页 ---');
    const o = await browser.newPage();
    await o.goto(`${extOrigin}/onboarding.html`, { waitUntil: 'load' });
    await o.waitForSelector('[data-testid="onboard-card"]', { timeout: 5000 });
    await o.bringToFront();
    const ob = await checkCommon(o, '引导页');
    check(!BRANDS.test(ob.text), '引导页无 🎭 与第三方品牌举例');
    check(ob.text.includes('固定到工具栏') && ob.text.includes('拼图') && ob.text.includes('图钉'), '引导页有「把 PageMask 固定到工具栏」一步（拼图图标 → 图钉）');
    check((await o.$$eval('.card', (els) => els.length)) === 1, '分步单屏：一次只显示当前步的一张卡（#139）');
    const stepTitle = () => o.$eval('[data-testid="onboard-card"] h2', (e) => (e.textContent ?? '').trim());
    check((await stepTitle()).includes('固定到工具栏'), '默认第 1 步');
    // #103：示意图就是真实组件，不是照着画的假图——分步后第 2/3 步的组件要翻页才能见到
    await (await o.waitForSelector('xpath/.//button[normalize-space()="下一步"]')).click();
    await waitFor(o, '切到第 2 步', () => !document.querySelector('[data-testid="onboard-card"] h2')?.textContent?.includes('固定到工具栏'));
    check((await stepTitle()).includes('四件事'), `第 2 步讲弹窗能做的四件事（${await stepTitle()}）`);
    check(!!(await o.$(tid('pm-popup-setup'))) && !!(await o.$(tid('pm-popup-cover'))), '第 2 步是真实弹窗组件（三个入口都在）');
    // #148：示意图用 preview 隐藏头部「查看使用说明」链接（介绍页里不该有指向介绍页自己的链接）
    check(!(await o.$(tid('pm-popup-replay-intro'))), '第 2 步示意图（preview）隐藏头部介绍链接');
    const featuresText = await o.$eval('.features', (e) => e.textContent ?? '');
    check(
      ['收起内容', '标题和图标', '整页变灰', '遮住这一页'].every((k) => featuresText.includes(k)),
      `四件主要功能各说了一句（${featuresText.split('：').join(': ').slice(0, 60)}…）`,
    );
    await (await o.waitForSelector('xpath/.//button[normalize-space()="下一步"]')).click();
    await waitFor(o, '切到第 3 步', () => !!(document.querySelector('[data-testid="pm-toggle"]')));
    check(!!(await o.$(tid('pm-toggle'))), '第 3 步是真实胶囊组件');
    check(
      (await o.$$eval('.art', (els) => els.every((e) => e.hasAttribute('inert') && e.getAttribute('aria-hidden') === 'true'))),
      '示意图能看不能点、读屏不重复朗读（inert + aria-hidden）',
    );
    check(await o.$eval('.dots', (d) => d.getAttribute('aria-hidden') === 'true'), '步骤圆点 aria-hidden');
    check((await o.$$eval('.dots i', (els) => els.findIndex((e) => e.classList.contains('on')))) === 2, '圆点停在第 3 步');
    await checkSchemes(o, '引导页', 'bgSubtle');

    // ---- 矮视口是欢迎页的一等约束（#108）：滚动在内容区，底栏固定、不压内容 ----
    // 用全新页面跑矮视口（0.8.11 实测：复用走过完整流程的页面 + reload 后点击偶发无效，
    // 全新页面无此问题；根因待第二轮深查）
    const oShort = await browser.newPage();
    await oShort.setViewport({ width: 1084, height: 544 });
    await oShort.goto(`${extOrigin}/onboarding.html`, { waitUntil: 'load' });
    await oShort.waitForSelector('[data-testid="onboard-card"]', { timeout: 5000 });
    // 切到第 2 步（内嵌真实弹窗，是最高的一步），当前卡应自动滚进视野。
    // 注意：waitFor 的谓词会被序列化到页面里执行，**闭包里的辅助函数（tid）带不进去**，
    // 谓词里必须用字面量选择器（0.8.11 的「点击无效」假象就是它）
    await oShort.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '下一步')?.click());
    await waitFor(oShort, '矮窗切到第 2 步', () => !!document.querySelector('[data-testid="pm-popup-setup"]'));
    await new Promise((res) => setTimeout(res, 700)); // 等平滑滚动到位
    const shortVp = await oShort.evaluate(() => {
      const scroll = document.querySelector('.scroll');
      const nav = document.querySelector('.nav');
      const card = document.querySelector('[data-testid="onboard-card"]');
      const s = scroll.getBoundingClientRect();
      const n = nav.getBoundingClientRect();
      const st = card.getBoundingClientRect();
      return {
        scrollable: scroll.scrollHeight > scroll.clientHeight,
        navBelowScroll: n.top >= s.bottom - 1, // 底栏不覆盖内容区（允许 1px 误差）
        stepTopVisible: st.top >= s.top - 1, // 切步后卡片顶部进入可视区
        pageOverflow: document.documentElement.scrollHeight <= window.innerHeight, // 整页不滚
      };
    });
    check(shortVp.pageOverflow, '1084×544：整页不出现滚动条，滚动属于内容区');
    check(shortVp.navBelowScroll, `底栏不覆盖内容区（nav.top >= scroll.bottom）`);
    check(shortVp.stepTopVisible, '切步后卡片的顶部自动滚进内容区视野');
    // 滚到底：第 2 步卡片底部完整可见（不被底栏切掉）
    await oShort.evaluate(() => document.querySelector('.scroll').scrollTo(0, 999999));
    await new Promise((res) => setTimeout(res, 200));
    const bottom = await oShort.evaluate(() => {
      const scroll = document.querySelector('.scroll');
      const s = scroll.getBoundingClientRect();
      const st = document.querySelector('[data-testid="onboard-card"]').getBoundingClientRect();
      return { cardBottomVisible: st.bottom <= s.bottom + 1 };
    });
    check(bottom.cardBottomVisible, '内容区滚到底后卡片完整可见');
    // 读屏播报：切步更新为「第 N 步，共 M 步：<标题>」
    const statusText = await oShort.$eval('[role="status"]', (e) => e.textContent ?? '');
    check(/第 2 步/.test(statusText) && statusText.includes('弹窗里能做的四件事'), `role="status" 播报当前步（${statusText}）`);
    await oShort.close();
    // 高窗口：分步单屏（#139）后内容不满一屏，整页与内容区都无滚动条，底栏贴底。
    await o.setViewport({ width: 1440, height: 900 });
    await new Promise((res) => setTimeout(res, 300));
    const tall = await o.evaluate(() => {
      const nav = document.querySelector('.nav');
      return {
        pageNoOverflow: document.documentElement.scrollHeight <= window.innerHeight,
        navAtBottom: Math.abs(nav.getBoundingClientRect().bottom - window.innerHeight) <= 1,
      };
    });
    check(tall.pageNoOverflow, '1440×900：整页无滚动条（滚动只属于内容区）');
    check(tall.navAtBottom, '1440×900：底栏仍贴窗口底部');
    // Tab 顺序：上一步 → 下一步（示意图 inert，圆点装饰不可聚焦，滚动区没有别的焦点目标）。
    // 矮视口那轮在另一页（oShort）上跑，o 还停在第 3 步——先退回第 2 步再验
    await o.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '上一步')?.click());
    await new Promise((res) => setTimeout(res, 300));
    await o.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
    await o.keyboard.press('Tab');
    const tab1 = await o.evaluate(() => (document.activeElement?.textContent ?? '').trim());
    await o.keyboard.press('Tab');
    const tab2 = await o.evaluate(() => (document.activeElement?.textContent ?? '').trim());
    check(tab1 === '上一步' && tab2 === '下一步', `Tab 顺序：上一步 → 下一步（${JSON.stringify([tab1, tab2])}）`);
    await o.close();

    // ===================== popup 待授权（最后做：撤销权限） =====================
    console.log('\n--- popup：待授权 ---');
    await setProfile(ext.control, ORIGIN, profileOf(ORIGIN));
    // 先开页面再撤权限：页面里的内容脚本仍然活着（线上撤权限后已打开的页面就是这样），
    // 遮住开关走内容脚本这条路；全新打开的页面没有内容脚本，只能靠 activeTab 注入，自动化点不到工具栏
    const site3 = await browser.newPage();
    await site3.goto(`${ORIGIN}/index.html`, { waitUntil: 'load' });
    await removePermission(ext.control, ORIGIN);
    popup = await openPopup(ext, site3);
    await popup.waitForSelector(tid('pm-popup-pending-badge'), { timeout: 5000 });
    check(!(await popup.$(tid('pm-popup-switch'))) && !!(await popup.$(tid('pm-popup-reauth'))), 'popup 显示「待授权」与「重新授权」，不显示开关');
    // #112：待授权站点页面上本来就没有胶囊，开关先不出现；删除仍可用（删掉待授权站点）
    check(!(await popup.$(tid('pm-popup-capsule'))), '待授权站点不显示「悬浮按钮」开关');
    check(!!(await popup.$(tid('pm-popup-delete'))), '待授权站点仍有「删除这个网站的设置」入口');
    // #148：new / ready 同构只针对这两态；pending 保留自己的「重新授权」分支，不渲染四块功能卡
    for (const id of ['pm-popup-disguise', 'pm-popup-media', 'pm-popup-setup', 'pm-popup-capsule']) {
      check(!(await popup.$(tid(id))), `待授权站点不渲染四块功能卡里的 ${id.replace('pm-popup-', '')}`);
    }
    // 「需要允许访问」与「可能失效」是同一套标记：都是 .pm-mark + 圆点在最前，只用颜色区分
    const pendingMark = await popup.$eval(tid('pm-popup-pending-badge'), (e) => ({
      classes: [...e.classList],
      first: e.firstElementChild?.className ?? '',
      dots: e.querySelectorAll('.pm-mark-dot').length,
      color: getComputedStyle(e).color,
    }));
    check(
      pendingMark.classes.includes('pm-mark-warning') && pendingMark.first === 'pm-mark-dot' && pendingMark.dots === 1,
      `「需要允许访问」用统一标记：圆点在最前、文字跟上（${pendingMark.classes.join('.')}，${pendingMark.color}）`,
    );
    await checkSchemes(popup, 'popup（待授权）', 'bg');
    await checkPopupChrome(popup, '待授权的网站');
    await coverAndRestore(ext, popup, site3, '待授权的网站');
    await site3.close();

    // ===================== popup：站点已授权、当前页面未覆盖（#162） =====================
    // 典型场景：只在 weibo.com 允许过访问，却打开 s.weibo.com——站点能找到配置、站点级也算已授权，
    // 但内容脚本没在这个页面上。弹窗必须走 pending 档并说明是「这个页面」没允许。
    // 独立实例：只授 https 模式，当前页面是 http，页面不在覆盖范围内。
    console.log('\n--- popup：站点已授权但当前页面未覆盖（#162） ---');
    {
      const srvUncovered = await startServer(handler);
      const UNCOVERED = srvUncovered.origin; // http://127.0.0.1:<端口>
      const UNCOVERED_KEY = siteKeyOf(UNCOVERED);
      const ext2 = await launchExtension({
        hostPatterns: [`https://${UNCOVERED_KEY}/*`], // 只授 https，不授 http
        extraPermissions: ['tabs'],
      });
      try {
        await setProfile(ext2.control, UNCOVERED, profileOf(UNCOVERED));
        const page2 = await ext2.browser.newPage();
        await page2.goto(`${UNCOVERED}/index.html`, { waitUntil: 'load' });

        let p2 = await openPopup(ext2, page2);
        await p2.waitForSelector(tid('pm-popup-pending-badge'), { timeout: 5000 });
        const uncoveredHint = await p2.$eval(tid('pm-popup-pending'), (e) => e.textContent.trim());
        check(uncoveredHint === '这个页面还没允许访问', `未覆盖页面的提示是新的那一句（${uncoveredHint}）`);
        const uncoveredBadge = await p2.$eval(tid('pm-popup-pending-badge'), (e) => e.textContent.trim());
        check(uncoveredBadge === '需要允许访问', `徽标仍复用「需要允许访问」（${uncoveredBadge}）`);
        check(
          !!(await p2.$(tid('pm-popup-reauth'))) &&
            (await p2.$eval(tid('pm-popup-reauth'), (e) => e.textContent.trim())) === '允许访问',
          '未覆盖页面给出「允许访问」按钮',
        );
        // 不是「就绪」：没有主开关，也没有 new / ready 才有的功能卡
        check(
          !(await p2.$(tid('pm-popup-switch'))) && !(await p2.$(tid('pm-popup-disguise'))) && !(await p2.$(tid('pm-popup-media'))),
          '未覆盖页面不显示「就绪」态的主开关与功能卡',
        );
        await checkPopupChrome(p2, '未覆盖的页面');
        await p2.close();

        // 回归：站点一条授权都没有时仍是原来的「浏览器收回了…」提示（两种情形要能区分）
        await removePermission(ext2.control, UNCOVERED); // 按站点收 http + https 两条
        p2 = await openPopup(ext2, page2);
        await p2.waitForSelector(tid('pm-popup-pending-badge'), { timeout: 5000 });
        const revokedHint = await p2.$eval(tid('pm-popup-pending'), (e) => e.textContent.trim());
        check(
          revokedHint.startsWith('浏览器收回了这个网站的访问权限'),
          `站点一条授权都没有时仍是原来的待授权提示（${revokedHint.slice(0, 20)}…）`,
        );
        await p2.close();
        await page2.close();
      } finally {
        await ext2.cleanup();
        await srvUncovered.close();
      }
    }

    console.log(`\n用时 ${((Date.now() - t0) / 1000).toFixed(1)} 秒`);
  } catch (e) {
    r.fail(e);
  } finally {
    await ext.cleanup();
    await srv.close();
    await srv2.close();
    removeTempDir(tmp); // 收尾失败不改用例结论（受管环境会拦一次删大量文件的调用）
  }
  process.exitCode = r.summary();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
