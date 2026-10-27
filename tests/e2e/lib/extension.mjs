/**
 * E2E 扩展工具：加载构建产物、预授予主机权限、控制页、SW 生命周期、重载、撤销权限、存储读写。
 *
 * 典型用法：
 *   const ext = await launchExtension({ hostOrigins: [srv.origin] });
 *   const ctl = ext.control;                                   // 扩展控制页（可调 chrome.* API）
 *   await setProfile(ctl, origin, profile);
 *   await sendToBackground(ctl, { t: 'enableSite', origin, tabId });
 *   await waitForServiceWorkerIdle(ext);                       // 让 SW 自然空闲回收（约 30 秒）
 *   await reloadExtension(ext);                                // chrome.runtime.reload()
 *   await removePermission(ext.control, origin);               // chrome.permissions.remove
 *   await grantPermissions(ext, [origin]);                     // 不经弹窗授予站点权限（两次重载）
 *   const popup = await openPopup(ext, page);                  // 以 page 为当前标签页打开 popup
 *   await ext.cleanup();
 *
 * 关于 SW：本文件里所有函数都不附加调试器（不调用 target.worker()），
 * puppeteer 会对 SW 静默分离，SW 能按正常的 30 秒空闲规则被回收。
 * SW 是否在运行用浏览器级 CDP `Target.getTargets` 查询（puppeteer 的 browser.targets()
 * 对已静默分离的 SW 不会及时移除，实测不可靠）。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { REPO_ROOT, launchWithExtension } from './browser.mjs';
import { CheckError, poll } from './harness.mjs';

export const BUILD_DIR = path.join(REPO_ROOT, '.output/chrome-mv3');
export const CONTROL_PAGE = 'e2e-control.html';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 拷贝构建产物到临时目录，并把 hostOrigins（来源，自动补 /*）与 hostPatterns（匹配模式原样）写进拷贝的 manifest.host_permissions
 * （安装即授权，等价于用户在授权弹窗里点了「允许」；弹窗本身无法自动化点击）。
 * 同时放一个空白控制页 e2e-control.html，用来在扩展上下文里执行 chrome.* 调用。
 * 返回 { dir, manifestPath, cleanup }。
 */
export function prepareExtension({ hostOrigins = [], hostPatterns = [], extraPermissions = [], srcDir = BUILD_DIR } = {}) {
  if (!fs.existsSync(path.join(srcDir, 'manifest.json'))) {
    throw new Error(`找不到构建产物 ${srcDir}，请先运行 wxt build`);
  }
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pm-e2e-ext-')));
  fs.cpSync(srcDir, dir, { recursive: true });
  const manifestPath = path.join(dir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.host_permissions = [...hostOrigins.map((o) => `${o}/*`), ...hostPatterns];
  // 仅测试拷贝：例如 'tabs'，让用 action.openPopup() 打开的 popup 读得到当前标签页网址
  // （真实用户点工具栏图标时由 activeTab 提供；openPopup 不授予 activeTab）
  if (extraPermissions.length) manifest.permissions = [...new Set([...(manifest.permissions ?? []), ...extraPermissions])];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(dir, CONTROL_PAGE), '<!doctype html><meta charset="utf-8"><title>PageMask E2E 控制页</title>');
  return { dir, manifestPath, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

/**
 * 启动浏览器并加载扩展，hostOrigins / hostPatterns 预授予主机权限（见 prepareExtension）。
 * revocable=true（默认）时，安装后把这些来源从 manifest 必需权限挪走并重载一次：
 * 已授予的权限保留下来、变成与真实用户一致的"可选权限、运行时已授予"，因此之后能用
 * removePermission 撤销（必需权限调用 permissions.remove 会报 "You cannot remove required permissions"）。
 * 返回 ctx：{ browser, extensionId, extOrigin, extDir, control, cleanup }
 */
export async function launchExtension({
  hostOrigins = [],
  hostPatterns = [],
  extraPermissions = [],
  revocable = true,
  srcDir,
} = {}) {
  const prepared = prepareExtension({ hostOrigins, hostPatterns, extraPermissions, srcDir });
  const patterns = [...hostOrigins.map((o) => `${o}/*`), ...hostPatterns];
  const launched = await launchWithExtension({ extDir: prepared.dir });
  if (process.env.PM_E2E_DEBUG) {
    // PM_E2E_DEBUG=1：打印所有 target 变化，排查扩展页面/SW 生命周期问题
    for (const ev of ['targetcreated', 'targetchanged', 'targetdestroyed']) {
      launched.browser.on(ev, (t) => console.log(`[debug] ${ev} ${t.type()} ${t.url()}`));
    }
  }
  const ctx = {
    browser: launched.browser,
    extensionId: launched.extensionId,
    extOrigin: launched.extOrigin,
    extDir: prepared.dir,
    manifestPath: prepared.manifestPath,
    control: await openControlPage(launched.browser, launched.extOrigin),
    cleanup: async () => {
      await launched.cleanup();
      prepared.cleanup();
    },
  };
  if (revocable && patterns.length) {
    const manifest = JSON.parse(fs.readFileSync(prepared.manifestPath, 'utf8'));
    delete manifest.host_permissions;
    fs.writeFileSync(prepared.manifestPath, JSON.stringify(manifest, null, 2));
    await reloadExtension(ctx);
    // 重载会触发 onInstalled(update) 拉起新 SW；等它起来再开始用例，避免与扩展启动过程交错
    await waitForServiceWorker(ctx).catch(() => undefined);
    const granted = await ctx.control.evaluate(
      (origins) => chrome.permissions.contains({ origins }),
      patterns,
    );
    if (!granted) throw new Error('预授予的主机权限在重载后丢失');
  }
  return ctx;
}

/** 打开扩展控制页（空白扩展页面，page.evaluate 里可直接用 chrome.*） */
export async function openControlPage(browser, extOrigin) {
  const page = await browser.newPage();
  await page.goto(`${extOrigin}/${CONTROL_PAGE}`);
  return page;
}

/** 当前运行中的本扩展 SW（浏览器级 Target.getTargets，不附加） */
export async function listServiceWorkers(browser, extOrigin) {
  const session = await browser.target().createCDPSession();
  try {
    const { targetInfos } = await session.send('Target.getTargets');
    return targetInfos.filter((t) => t.type === 'service_worker' && t.url.startsWith(extOrigin));
  } finally {
    await session.detach().catch(() => undefined);
  }
}

/** 等到本扩展 SW 处于运行状态（例如发消息唤醒之后） */
export async function waitForServiceWorker({ browser, extOrigin }, { timeout = 10000 } = {}) {
  await poll(async () => (await listServiceWorkers(browser, extOrigin)).length > 0, 'SW 启动', { timeout });
}

/**
 * 让 SW 自然空闲回收：什么都不做，等 Chrome 按 30 秒空闲规则终止它，直到 SW target 消失。
 * 期间不要向扩展发消息或调用会唤醒 SW 的 API。实测 CfT 157 约 30 秒。返回实际等待毫秒数。
 * 用法：const ms = await waitForServiceWorkerIdle(ext);
 */
export async function waitForServiceWorkerIdle({ browser, extOrigin }, { timeout = 75000 } = {}) {
  const start = Date.now();
  await poll(async () => (await listServiceWorkers(browser, extOrigin)).length === 0, 'SW 自然空闲回收', {
    timeout,
    interval: 500,
  });
  return Date.now() - start;
}

/**
 * 用 CDP 立即停止本扩展的 SW（ServiceWorker.stopAllWorkers，在扩展页面的会话里执行，
 * 只影响扩展自身的存储分区）。之后经正常路径（页面消息、事件）唤醒的是全新 SW 实例。
 * 比自然空闲快，但属于"强制终止"，与真实回收略有差别；关键回归优先用 waitForServiceWorkerIdle。
 * 用法：await stopServiceWorker(ext);
 */
export async function stopServiceWorker({ browser, extOrigin, control }) {
  const session = await control.createCDPSession();
  try {
    await session.send('ServiceWorker.enable');
    await session.send('ServiceWorker.stopAllWorkers');
  } finally {
    await session.detach().catch(() => undefined);
  }
  await poll(async () => (await listServiceWorkers(browser, extOrigin)).length === 0, 'SW 被停止');
}

/**
 * 在扩展页面里调用 chrome.runtime.reload()，等扩展重新可用后换上新的控制页。
 * 未打包扩展的 id 由目录决定，重载前后不变；ctx.control 会被替换为新页面。
 * 注意：重载会关闭所有扩展页面（含管理页、旧控制页）。
 * 用法：await reloadExtension(ext); await ext.control.evaluate(...)
 */
export async function reloadExtension(ctx) {
  const { browser, extOrigin } = ctx;
  const old = ctx.control;
  const closed = new Promise((resolve) => old.once('close', resolve));
  await old.evaluate(() => {
    setTimeout(() => chrome.runtime.reload(), 0);
  });
  // 必须等旧扩展页面真正被关闭（= 旧扩展已卸载）再打开新页面；
  // 否则新页面可能在卸载前加载，随后变成失效页面，evaluate 会一直挂起。
  const closedInTime = await Promise.race([closed.then(() => true), sleep(15000).then(() => false)]);
  if (!closedInTime) throw new CheckError('runtime.reload() 后 15 秒内扩展页面未关闭');
  const page = await browser.newPage();
  await poll(
    async () => {
      try {
        await page.goto(`${extOrigin}/${CONTROL_PAGE}`, { timeout: 3000 });
        // 用一次存储读取确认扩展 API 真正可用（带超时，避免挂起）
        return await Promise.race([
          page.evaluate(async () => !!globalThis.chrome?.runtime?.id && !!(await chrome.storage.local.get(null))),
          sleep(2000).then(() => false),
        ]);
      } catch {
        return false;
      }
    },
    '扩展重载后重新可用',
    { timeout: 15000 },
  );
  ctx.control = page;
  if (process.env.PM_E2E_DEBUG) page.on('error', (e) => console.log('[debug] 控制页崩溃', e.message));
  return page;
}

/**
 * 通过扩展页面撤销某个来源的主机权限（等价于用户在扩展详情里收回网站访问权限）。
 * 返回撤销后是否仍持有该权限（应为 false）。
 * 用法：await removePermission(ext.control, 'http://127.0.0.1:1234');
 */
export async function removePermission(control, origin) {
  return control.evaluate(async (pattern) => {
    await chrome.permissions.remove({ origins: [pattern] });
    return chrome.permissions.contains({ origins: [pattern] });
  }, `${origin}/*`);
}

/**
 * 不经权限弹窗授予站点权限（弹窗无法自动化点击）：把来源临时写进拷贝 manifest 的 host_permissions 重载一次
 * （必需权限安装即授予），再删掉并重载一次，权限保留为"可选权限、运行时已授予"，与真实用户点「允许」后一致、可再撤销。
 * 注意：两次重载都会关闭所有扩展页面（popup、管理页、旧控制页），并各触发一次 onInstalled(update)；
 * 已打开网页里的旧内容脚本随之失联，断言请用新开的页面。
 * 用法：await grantPermissions(ext, [origin]);
 */
export async function grantPermissions(ctx, origins) {
  const patterns = origins.map((o) => `${o}/*`);
  const write = (hosts) => {
    const manifest = JSON.parse(fs.readFileSync(ctx.manifestPath, 'utf8'));
    if (hosts) manifest.host_permissions = hosts;
    else delete manifest.host_permissions;
    fs.writeFileSync(ctx.manifestPath, JSON.stringify(manifest, null, 2));
  };
  write(patterns);
  await reloadExtension(ctx);
  await waitForServiceWorker(ctx).catch(() => undefined);
  write(null);
  await reloadExtension(ctx);
  await waitForServiceWorker(ctx).catch(() => undefined);
  const granted = await ctx.control.evaluate((o) => chrome.permissions.contains({ origins: o }), patterns);
  if (!granted) throw new CheckError(`grantPermissions：${patterns.join(', ')} 没有授予成功`);
}

/**
 * 以 tabPage 为当前标签页打开扩展 popup（chrome.action.openPopup，与点工具栏图标打开的是同一个页面），返回 popup 的 Page。
 * popup 里 tabs.query({ active, currentWindow }) 拿到的就是 tabPage。读网址需要启动时 extraPermissions: ['tabs']。
 * 用法：const popup = await openPopup(ext, page);
 */
export async function openPopup(ctx, tabPage) {
  await tabPage.bringToFront();
  const url = `${ctx.extOrigin}/popup.html`;
  const targetP = ctx.browser.waitForTarget((t) => t.url() === url, { timeout: 8000 });
  await ctx.control.evaluate(() => chrome.action.openPopup());
  const target = await targetP;
  const popup = await target.asPage();
  await popup.waitForFunction(() => document.readyState === 'complete');
  return popup;
}

/**
 * 安装时的权限警告：在扩展页面里调用 chrome.management.getPermissionWarningsByManifest（不需要 management 权限）。
 * 传入 manifest 对象（通常是构建产物原样读出的 manifest.json）。
 * 用法：const warnings = await permissionWarnings(ext.control, manifest);  // 期望 []
 */
export async function permissionWarnings(control, manifest) {
  return control.evaluate((text) => chrome.management.getPermissionWarningsByManifest(text), JSON.stringify(manifest));
}

/** 读站点配置 */
export async function getProfile(control, origin) {
  return control.evaluate(async (key) => (await chrome.storage.local.get(key))[key] ?? null, `profile:${origin}`);
}

/** 写站点配置（整份覆盖） */
export async function setProfile(control, origin, profile) {
  await control.evaluate((key, p) => chrome.storage.local.set({ [key]: p }), `profile:${origin}`, profile);
}

/**
 * 局部修改站点配置（读 → 浅合并 patch 对象 → 写），触发内容脚本的 storage.onChanged 联动。
 * 用法：await patchProfile(ctl, origin, { switchState: 'original' });
 */
export async function patchProfile(control, origin, patch) {
  await control.evaluate(
    async (key, pt) => {
      const p = (await chrome.storage.local.get(key))[key];
      await chrome.storage.local.set({ [key]: { ...p, ...pt } });
    },
    `profile:${origin}`,
    patch,
  );
}

/** 从扩展页面向后台发消息（与 popup 走同一条消息入口），返回后台回复 */
export async function sendToBackground(control, msg) {
  return control.evaluate((m) => chrome.runtime.sendMessage(m), msg);
}

/** 向某个标签页的内容脚本发消息（与 popup 的 openWizard / openEditor 相同） */
export async function sendToTab(control, tabId, msg) {
  return control.evaluate((id, m) => chrome.tabs.sendMessage(id, m), tabId, msg);
}

/**
 * 在页面里「本扩展内容脚本的隔离环境」中求值（CDP Runtime.evaluate + 隔离环境的 contextId），
 * 用来检查网页脚本看不到的东西：window.__pagemask 登记、隔离环境里的 Navigation API 等。
 * 扩展重载后隔离环境沿用同一个（实测 contextId 不变），旧实例与新实例共享 window。
 * expression 是字符串表达式，结果须可 JSON 序列化；找不到隔离环境（内容脚本没注入）时抛错。
 * 用法：await evalInContentWorld(page, ext.extOrigin, 'window.__pagemask?.alive()')
 */
export async function evalInContentWorld(page, extOrigin, expression) {
  const session = await page.createCDPSession();
  try {
    const contexts = [];
    session.on('Runtime.executionContextCreated', (e) => contexts.push(e.context));
    await session.send('Runtime.enable'); // 启用时把已有的执行环境逐个报上来
    const ctx = contexts.find((c) => c.origin === extOrigin && c.auxData?.type === 'isolated');
    if (!ctx) throw new CheckError('页面里没有本扩展内容脚本的隔离环境');
    const { result, exceptionDetails } = await session.send('Runtime.evaluate', {
      expression,
      contextId: ctx.id,
      returnByValue: true,
      awaitPromise: true,
    });
    if (exceptionDetails) throw new CheckError(`隔离环境求值出错：${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
    return result.value;
  } finally {
    await session.detach().catch(() => undefined);
  }
}

/** 查找 URL 匹配的标签页 id（url 为匹配模式，如 `${origin}/*`） */
export async function tabIdOf(control, urlPattern) {
  const id = await control.evaluate(async (u) => (await chrome.tabs.query({ url: u }))[0]?.id ?? -1, urlPattern);
  if (id === -1) throw new CheckError(`找不到匹配 ${urlPattern} 的标签页`);
  return id;
}
