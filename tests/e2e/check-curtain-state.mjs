/**
 * 幕布状态唯一控制器（#107，ADR-0011）：真实浏览器回归。
 *
 * 运行：npm run build && node tests/e2e/check-curtain-state.mjs   （HEADFUL=1 有界面运行）
 *
 * 背景：浏览器级按键无法自动化（#101 的结论），快捷键在消息层的等价物就是后台发出的
 * curtainToggle——本脚本所有「快捷键切」都用它代替；「弹窗遮 / 撤」也走同一条消息（弹窗点击
 * 发的就是 curtainToggle）。三处入口在消息层归一后，下面的组合即用户可见的组合。
 *
 * 覆盖：
 * - 已添加网站：消息遮 / 消息撤、胶囊遮 / 按钮撤、消息遮 / 按钮撤、胶囊遮 / 消息撤——
 *   任意组合互通；连按三次（遮 → 撤 → 再遮）第三次必须成功（原缺陷：一次性脚本不认 curtainCover）
 * - 任何时刻文档里 pagemask-curtain 宿主 ≤ 1（跨入口反复切换、重复注入、接管前后都断言）
 * - 一次性脚本见到内容脚本的登记：只委托遮住，不铺第二层、不重复注册监听；消息应答状态一致
 * - 内容脚本（再次注入的新实例）见到一次性脚本的登记：让位接管，遮住状态不丢
 * - 未添加网站：注入遮 → 消息撤 → 再遮（第 3 次必须成功）→ 再撤；重复注入不叠加
 * - coverPage（后台兜底）：有接收方时让页面控制器遮，不注入第二套；没接收方才注入
 *
 * 不写截图、不留临时文件。
 */
import { createReporter, siteKeyOf, startServer, waitFor } from './lib/harness.mjs';
import { getProfile, launchExtension, sendToBackground, sendToTab, setProfile, tabIdOf } from './lib/extension.mjs';
import { clickInShadow, waitForShadow } from './lib/shadow.mjs';

const r = createReporter();
const { check } = r;
const TOGGLE = 'pagemask-toggle';
const CURTAIN = 'pagemask-curtain';
const WIZARD = 'pagemask-wizard';
const tid = (id) => `[data-testid="${id}"]`;

const pageHtml = () => `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>Acme 阅读</title>
<link rel="icon" href="/site-icon.png">
<style>body{margin:0;background:#ffffff;font:14px system-ui}
#content{min-height:900px;padding:24px}
.ad{height:60px;margin:12px 16px;background:#fc0}</style></head><body>
<div class="ad" id="ad">广告位（示例）</div>
<main id="content"><h1>正文</h1><p>段落内容</p></main>
</body></html>`;

const handler = (_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(pageHtml());
};

const now = Date.now();
const profileOf = (origin) => ({
  formatVersion: 1,
  origin,
  switchState: 'disguised',
  disguisedTitle: '低调阅读',
  icon: { kind: 'none' },
  hideRules: [
    {
      id: 'r-ad',
      elementName: '广告位',
      candidates: ['.ad'],
      strategy: 'remove',
      scope: { type: 'all' },
      onlyThis: false,
      createdAt: now,
      lastHealth: 'ok',
    },
  ],
  floatingBtnPos: null,
  createdAt: now,
  updatedAt: now,
});

/** 发消息给标签页；没有接收方时返回 undefined（与弹窗的口径一致），不当成错误 */
const safeSend = async (control, tabId, msg) => {
  try {
    return await sendToTab(control, tabId, msg);
  } catch {
    return undefined;
  }
};

/** 文档里的幕布宿主数与恢复按钮数（同一层里按钮应只有一颗） */
const curtainShape = (page) =>
  page.evaluate((h) => {
    const hosts = document.querySelectorAll(h);
    return {
      hosts: hosts.length,
      buttons: hosts[0]?.shadowRoot?.querySelectorAll('[data-testid="pm-curtain-restore"]').length ?? 0,
      hit: document.elementFromPoint(500, 300)?.tagName?.toLowerCase() ?? null,
    };
  }, CURTAIN);

async function main() {
  const srv = await startServer(handler);
  const ORIGIN = srv.origin;
  const ext = await launchExtension({ hostOrigins: [ORIGIN] });
  try {
    await setProfile(ext.control, ORIGIN, profileOf(ORIGIN));
    const page = await ext.browser.newPage();
    await page.setViewport({ width: 1000, height: 700 });
    page.on('pageerror', (e) => console.log(`  [pageerror] ${e.message}`));
    await page.goto(`${ORIGIN}/`, { waitUntil: 'load' });
    await sendToBackground(ext.control, { t: 'enableSite', origin: ORIGIN, tabId: await tabIdOf(ext.control, `${ORIGIN}/*`) });
    await page.waitForSelector(TOGGLE, { timeout: 8000 });
    const tabId = () => tabIdOf(ext.control, `${ORIGIN}/*`);

    // ===================== 已添加网站：三处入口任意组合 =====================
    console.log('\n--- 已添加网站：消息（弹窗 / 快捷键等价）与胶囊任意组合 ---');

    // 消息遮（= 弹窗点「遮住这一页」或快捷键按下时后台发出的那条）
    let reply = await safeSend(ext.control, await tabId(), { t: 'curtainToggle' });
    check(reply?.ok === true && reply.covered === true, `toggle 遮上，回复动作后的状态（${JSON.stringify(reply)}）`);
    await waitForShadow(page, CURTAIN, tid('pm-curtain-restore'), { timeout: 3000 });
    let shape = await curtainShape(page);
    check(shape.hosts === 1, `遮上后文档里只有一个幕布宿主（${shape.hosts}）`);
    check(shape.hit === 'pagemask-curtain', `页面内容不可见（视口中心命中 ${shape.hit}）`);

    // 消息撤（= 再按一次快捷键）
    reply = await safeSend(ext.control, await tabId(), { t: 'curtainToggle' });
    await waitFor(page, 'toggle 撤掉幕布', (h) => !document.querySelector(h), [CURTAIN], { timeout: 3000 });
    check(reply?.ok === true && reply.covered === false, `toggle 撤掉，回复动作后的状态（${JSON.stringify(reply)}）`);

    // 连按三次：遮 → 撤 → 再遮（原缺陷正是第三次遮不上）
    for (const [round, want] of [
      ['第 1 次', true],
      ['第 2 次', false],
      ['第 3 次', true],
    ]) {
      reply = await safeSend(ext.control, await tabId(), { t: 'curtainToggle' });
      check(reply?.covered === want, `快捷键连按 ${round}：covered=${want}（${JSON.stringify(reply)}）`);
      if (want) await waitForShadow(page, CURTAIN, tid('pm-curtain-restore'), { timeout: 3000 });
      else await waitFor(page, `第 ${round} 撤掉`, (h) => !document.querySelector(h), [CURTAIN], { timeout: 3000 });
      shape = await curtainShape(page);
      check(shape.hosts <= 1, `${round} 切换后宿主数 ≤1（${shape.hosts}）`);
    }
    await safeSend(ext.control, await tabId(), { t: 'curtainToggle' }); // 撤掉，留给下一组
    await waitFor(page, '幕布撤掉', (h) => !document.querySelector(h), [CURTAIN], { timeout: 3000 });

    // 胶囊遮（消息撤）→ 消息遮（恢复按钮撤）→ 消息遮（消息撤）：三种「谁遮谁撤」组合
    await clickInShadow(page, TOGGLE, tid('pm-toggle-cover'));
    await waitForShadow(page, CURTAIN, tid('pm-curtain-restore'), { timeout: 3000 });
    reply = await safeSend(ext.control, await tabId(), { t: 'curtainToggle' });
    await waitFor(page, '胶囊遮 / 快捷键撤', (h) => !document.querySelector(h), [CURTAIN], { timeout: 3000 });
    check(reply?.covered === false, `胶囊遮 → 快捷键撤（${JSON.stringify(reply)}）`);

    reply = await safeSend(ext.control, await tabId(), { t: 'curtainToggle' });
    await waitForShadow(page, CURTAIN, tid('pm-curtain-restore'), { timeout: 3000 });
    check(reply?.covered === true, `快捷键遮（${JSON.stringify(reply)}）`);
    await clickInShadow(page, CURTAIN, tid('pm-curtain-restore'));
    await waitFor(page, '快捷键遮 / 按钮撤', (h) => !document.querySelector(h), [CURTAIN], { timeout: 3000 });

    await clickInShadow(page, TOGGLE, tid('pm-toggle-cover'));
    await waitForShadow(page, CURTAIN, tid('pm-curtain-restore'), { timeout: 3000 });
    reply = await safeSend(ext.control, await tabId(), { t: 'curtainState' });
    check(reply?.covered === true, `胶囊遮 → 查询回 true（${JSON.stringify(reply)}）`);
    await clickInShadow(page, CURTAIN, tid('pm-curtain-restore'));
    await waitFor(page, '幕布撤掉', (h) => !document.querySelector(h), [CURTAIN], { timeout: 3000 });

    // ===================== 接管：一次性脚本与内容脚本在同一文档相遇 =====================
    console.log('\n--- 一次性脚本先到：内容脚本让位接管，遮住状态不丢 ---');
    // 内容脚本活着时注入一次性脚本：它应当只委托内容脚本的控制器遮住，不铺第二层、不注册监听
    const injectOneshot = async () => {
      const id = await tabId();
      await ext.control.evaluate(async (tid2) => {
        await chrome.scripting.executeScript({ target: { tabId: tid2 }, files: ['curtain-oneshot.js'] });
      }, id);
    };
    await injectOneshot();
    await waitForShadow(page, CURTAIN, tid('pm-curtain-restore'), { timeout: 5000 });
    shape = await curtainShape(page);
    check(shape.hosts === 1 && shape.buttons === 1, `委托遮住：还是一层、一颗按钮（hosts=${shape.hosts}, buttons=${shape.buttons}）`);
    reply = await safeSend(ext.control, await tabId(), { t: 'curtainState' });
    check(reply?.covered === true, `消息状态一致（${JSON.stringify(reply)}）`);
    // 撤掉再遮上：委托路径下方向切换同样成立
    reply = await safeSend(ext.control, await tabId(), { t: 'curtainToggle' });
    await waitFor(page, '委托层撤掉', (h) => !document.querySelector(h), [CURTAIN], { timeout: 3000 });
    check(reply?.covered === false, `委托路径 toggle 撤掉（${JSON.stringify(reply)}）`);
    reply = await safeSend(ext.control, await tabId(), { t: 'curtainToggle' });
    await waitForShadow(page, CURTAIN, tid('pm-curtain-restore'), { timeout: 3000 });
    check(reply?.covered === true, `委托路径 toggle 再遮上（${JSON.stringify(reply)}）`);
    await safeSend(ext.control, await tabId(), { t: 'curtainToggle' });
    await waitFor(page, '委托层撤掉（收尾）', (h) => !document.querySelector(h), [CURTAIN], { timeout: 3000 });

    // 真正的采纳路径：未添加的页面先被一次性脚本遮住，随后站点被添加、内容脚本注入——
    // 新运行时让位旧控制器（撤它的层、登记自己的），并接着遮（遮住状态不丢）
    await ext.control.evaluate((o) => chrome.storage.local.remove(`profile:${o}`), siteKeyOf(ORIGIN));
    await page.goto(`${ORIGIN}/`, { waitUntil: 'load' });
    await new Promise((res) => setTimeout(res, 800)); // 等内容脚本注销、页面进入「未添加」状态
    await injectOneshot();
    await waitForShadow(page, CURTAIN, tid('pm-curtain-restore'), { timeout: 5000 });
    await setProfile(ext.control, ORIGIN, profileOf(ORIGIN));
    await sendToBackground(ext.control, { t: 'enableSite', origin: ORIGIN, tabId: await tabId() });
    await new Promise((res) => setTimeout(res, 1200)); // 等新运行时读配置、让位接管、接着遮
    shape = await curtainShape(page);
    check(shape.hosts === 1, `接管后仍只有一层（${shape.hosts}）`);
    check(shape.hit === 'pagemask-curtain', `接管期间遮住状态不丢（命中 ${shape.hit}）`);
    const adoptedTitle = await page.evaluate(() => document.title);
    check(adoptedTitle === '低调阅读', `接管后标题仍被幕布压住（${adoptedTitle}）`);
    reply = await safeSend(ext.control, await tabId(), { t: 'curtainToggle' });
    await waitFor(page, '接管后的控制器能撤', (h) => !document.querySelector(h), [CURTAIN], { timeout: 3000 });
    check(reply?.covered === false, `接管后 toggle 撤掉（${JSON.stringify(reply)}）`);
    await page.waitForSelector(TOGGLE, { timeout: 8000 });

    // ===================== 未添加网站：注入 → 撤 → 再遮（原缺陷场景） =====================
    console.log('\n--- 未添加网站：注入遮 → 消息撤 → 再遮（第 3 次必须成功） ---');
    await ext.control.evaluate((o) => chrome.storage.local.remove(`profile:${o}`), siteKeyOf(ORIGIN));
    await page.goto(`${ORIGIN}/`, { waitUntil: 'load' });
    await new Promise((res) => setTimeout(res, 800)); // 负向断言：等过内容脚本注入时机
    check(!(await page.$(TOGGLE)), '没添加的网站上没有悬浮按钮');
    const bareReply = await safeSend(ext.control, await tabId(), { t: 'curtainToggle' });
    check(bareReply === undefined, '页面里没有接收方（内容脚本已注销）');

    await injectOneshot();
    await waitForShadow(page, CURTAIN, tid('pm-curtain-restore'), { timeout: 5000 });
    shape = await curtainShape(page);
    check(shape.hosts === 1 && shape.buttons === 1, `一次性脚本遮上：一层、一颗按钮（hosts=${shape.hosts}）`);

    // 遮 → 撤 → 再遮 → 再撤：全部走消息（原缺陷第 3 次遮不上）
    for (const [round, want] of [
      ['第 1 次', false],
      ['第 2 次', true],
      ['第 3 次', false],
      ['第 4 次', true],
    ]) {
      reply = await safeSend(ext.control, await tabId(), { t: 'curtainToggle' });
      check(reply?.covered === want, `未添加网站 toggle ${round}：covered=${want}（${JSON.stringify(reply)}）`);
      if (want) await waitForShadow(page, CURTAIN, tid('pm-curtain-restore'), { timeout: 3000 });
      else await waitFor(page, `${round} 撤掉`, (h) => !document.querySelector(h), [CURTAIN], { timeout: 3000 });
      shape = await curtainShape(page);
      check(shape.hosts <= 1, `${round} 切换后宿主数 ≤1（${shape.hosts}）`);
    }

    // 幂等：重复注入不叠加第二层、不重复注册监听
    await injectOneshot();
    await injectOneshot();
    shape = await curtainShape(page);
    check(shape.hosts === 1 && shape.buttons === 1, `重复注入不叠加（hosts=${shape.hosts}, buttons=${shape.buttons}）`);
    reply = await safeSend(ext.control, await tabId(), { t: 'curtainToggle' });
    await waitFor(page, '撤掉（收尾）', (h) => !document.querySelector(h), [CURTAIN], { timeout: 3000 });
    check(reply?.covered === false, `重复注入后消息仍由唯一控制器应答（${JSON.stringify(reply)}）`);

    // ===================== coverPage（后台兜底） =====================
    console.log('\n--- coverPage：有接收方让页面遮，没接收方才注入 ---');
    // 当前页面没添加过、没有任何脚本：coverPage 注入一次性脚本并遮上
    const coverRes = await sendToBackground(ext.control, { t: 'coverPage', tabId: await tabId() });
    check(coverRes?.ok === true, `coverPage 注入成功（${JSON.stringify(coverRes)}）`);
    await waitForShadow(page, CURTAIN, tid('pm-curtain-restore'), { timeout: 5000 });
    shape = await curtainShape(page);
    check(shape.hosts === 1, `coverPage 遮上后只有一层（${shape.hosts}）`);
    // 再来一次：一次性脚本已在（有接收方），不注入第二套
    const coverRes2 = await sendToBackground(ext.control, { t: 'coverPage', tabId: await tabId() });
    check(coverRes2?.ok === true, `coverPage 幂等（${JSON.stringify(coverRes2)}）`);
    shape = await curtainShape(page);
    check(shape.hosts === 1 && shape.buttons === 1, `第二次 coverPage 不叠加（hosts=${shape.hosts}, buttons=${shape.buttons}）`);
    await safeSend(ext.control, await tabId(), { t: 'curtainDismiss' });
    await waitFor(page, 'coverPage 场景撤幕布', (h) => !document.querySelector(h), [CURTAIN], { timeout: 3000 });

    // ===================== 图标三态 × 幕布（#121） =====================
    console.log('\n--- 图标三态：网站原图标不被接管；遮住固定空白；撤掉后回来 ---');
    const iconHrefNow = () =>
      page.evaluate(() => document.querySelector('link[rel~="icon"]')?.getAttribute('href') ?? null);
    await setProfile(ext.control, ORIGIN, { ...profileOf(ORIGIN), icon: { kind: 'site' } });
    await sendToBackground(ext.control, { t: 'enableSite', origin: ORIGIN, tabId: await tabId() });
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector(TOGGLE, { timeout: 8000 });
    const siteIcon = await iconHrefNow();
    check(siteIcon === '/site-icon.png', `「网站原来的图标」不接管站点图标（实际 ${siteIcon}）`);
    await clickInShadow(page, TOGGLE, tid('pm-toggle-cover'));
    await waitForShadow(page, CURTAIN, tid('pm-curtain-restore'), { timeout: 3000 });
    const coveredIcon = await iconHrefNow();
    check(
      typeof coveredIcon === 'string' && coveredIcon.startsWith('data:image/png'),
      `遮住时图标固定为空白图，不露出网站真图标（${String(coveredIcon).slice(0, 30)}…）`,
    );
    reply = await safeSend(ext.control, await tabId(), { t: 'curtainDismiss' });
    await waitFor(page, '撤幕布（图标三态）', (h) => !document.querySelector(h), [CURTAIN], { timeout: 3000 });
    const restoredIcon = await iconHrefNow();
    check(restoredIcon === '/site-icon.png', `撤掉后网站自己的图标回来（实际 ${restoredIcon}）`);

    // ===================== 已添加网站 + 幕布期间胶囊不渲染（#50 不回归） =====================
    console.log('\n--- 回归：遮住期间胶囊卸掉、三入口互通不改变既有口径 ---');
    await setProfile(ext.control, ORIGIN, profileOf(ORIGIN));
    await sendToBackground(ext.control, { t: 'enableSite', origin: ORIGIN, tabId: await tabId() });
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector(TOGGLE, { timeout: 8000 });
    await clickInShadow(page, TOGGLE, tid('pm-toggle-cover'));
    await waitForShadow(page, CURTAIN, tid('pm-curtain-restore'), { timeout: 3000 });
    const noCapsule = await page.$(TOGGLE);
    check(!noCapsule, '幕布铺开后胶囊卸掉（#50）');
    const coveredProfile = await getProfile(ext.control, ORIGIN);
    check(coveredProfile.switchState === 'disguised', '遮住不改开关状态');
    reply = await safeSend(ext.control, await tabId(), { t: 'curtainToggle' });
    await waitFor(page, '最后一撤', (h) => !document.querySelector(h), [CURTAIN], { timeout: 3000 });
    check(reply?.covered === false, `弹窗/快捷键撤掉胶囊遮的幕布（${JSON.stringify(reply)}）`);
    await page.waitForSelector(TOGGLE, { timeout: 8000 });

    // 向导开着时 toggle 不把幕布盖回向导上（#107 新增的守卫）
    await sendToTab(ext.control, await tabId(), { t: 'openWizard', mode: 'editContent' });
    await waitForShadow(page, WIZARD, tid('pm-wizard-toolbar'), { timeout: 5000 });
    reply = await safeSend(ext.control, await tabId(), { t: 'curtainToggle' });
    check(reply?.covered === false, `向导开着时 toggle 不铺幕布（${JSON.stringify(reply)}）`);
    shape = await curtainShape(page);
    check(shape.hosts === 0, `向导期间没有幕布宿主（${shape.hosts}）`);
    const wizardStill = await page.$(WIZARD);
    check(!!wizardStill, '向导仍在最前');
  } catch (e) {
    r.fail(e);
  } finally {
    await ext.cleanup();
    await srv.close();
  }
  process.exitCode = r.summary();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
