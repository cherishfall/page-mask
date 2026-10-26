/**
 * E2E 浏览器解析 / 下载 / 启动（所有 E2E 脚本共用）。
 *
 * 自动化加载未打包扩展需要 Chrome for Testing（CfT；品牌版 Chrome 137+ 不再允许命令行加载扩展），
 * 这里用 @puppeteer/browsers 下载固定版本到被忽略的缓存目录，首次运行自动下载，之后直接复用。
 *
 * 环境变量：
 *   CHROME_PATH    直接指定浏览器可执行文件，跳过下载（例如本机已有的 CfT）
 *   CFT_CACHE_DIR  下载缓存目录，默认 <仓库>/.cache/chrome（已在 .gitignore）
 *   CFT_BASE_URL   下载源，默认 Google 官方存储；国内可用
 *                  https://registry.npmmirror.com/-/binary/chrome-for-testing
 *   HEADFUL=1      有界面运行（默认新 headless，扩展可正常加载）
 *
 * 用法：
 *   const { browser, cleanup } = await launchWithExtension({ extDir });
 *   try { ... } finally { await cleanup(); }
 */
import { Browser, detectBrowserPlatform, install, computeExecutablePath } from '@puppeteer/browsers';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** 固定的 CfT 版本（升级时改这里；npmmirror 同步了全部 CfT 版本） */
export const CHROME_BUILD_ID = '157.0.8103.15';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const DEFAULT_CACHE_DIR = path.join(REPO_ROOT, '.cache/chrome');

/**
 * 返回可执行文件路径：CHROME_PATH 优先；否则确保固定版本 CfT 已下载（已有则不重复下载）。
 * 用法：const executablePath = await resolveChrome();
 */
export async function resolveChrome() {
  if (process.env.CHROME_PATH) {
    if (!fs.existsSync(process.env.CHROME_PATH)) {
      throw new Error(`CHROME_PATH 指向的文件不存在：${process.env.CHROME_PATH}`);
    }
    return process.env.CHROME_PATH;
  }
  const cacheDir = path.resolve(process.env.CFT_CACHE_DIR || DEFAULT_CACHE_DIR);
  const platform = detectBrowserPlatform();
  if (!platform) throw new Error(`不支持的平台：${os.platform()} ${os.arch()}，请用 CHROME_PATH 指定浏览器`);
  const executablePath = computeExecutablePath({ browser: Browser.CHROME, buildId: CHROME_BUILD_ID, cacheDir, platform });
  if (fs.existsSync(executablePath)) return executablePath;

  const baseUrl = process.env.CFT_BASE_URL || undefined;
  console.log(`⇣ 下载 Chrome for Testing ${CHROME_BUILD_ID}（${platform}）→ ${cacheDir}${baseUrl ? `，源：${baseUrl}` : ''}`);
  let lastPct = -10;
  const installed = await install({
    browser: Browser.CHROME,
    buildId: CHROME_BUILD_ID,
    cacheDir,
    platform,
    baseUrl,
    downloadProgressCallback: (done, total) => {
      const pct = total ? Math.floor((done / total) * 100) : 0;
      if (pct >= lastPct + 10) {
        lastPct = pct - (pct % 10);
        console.log(`  … ${lastPct}%（${(done / 1048576).toFixed(0)} / ${(total / 1048576).toFixed(0)} MB）`);
      }
    },
  });
  console.log(`✓ 浏览器已就绪：${installed.executablePath}`);
  return installed.executablePath;
}

/**
 * 启动加载了扩展的浏览器（新 headless + 临时用户目录）。
 * 扩展通过 browser.installExtension 加载（CDP Extensions.loadUnpacked），id 由扩展目录路径决定。
 * 返回 { browser, extensionId, extOrigin, userDataDir, cleanup }。
 */
export async function launchWithExtension({ extDir, headless = !process.env.HEADFUL, args = [] } = {}) {
  const executablePath = await resolveChrome();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-e2e-profile-'));
  const browser = await puppeteer.launch({
    executablePath,
    headless,
    userDataDir,
    pipe: true,
    // 单次 CDP 调用超时：默认 180 秒太长，挂起时尽快暴露
    protocolTimeout: 30000,
    // 注意：不用 enableExtensions: [dir]（puppeteer 25 内部没有等待安装完成），改为手动 installExtension
    enableExtensions: true,
    defaultViewport: { width: 1280, height: 800 },
    args: ['--no-first-run', '--no-default-browser-check', '--window-size=1280,900', ...args],
  });
  await enableDeveloperMode(browser);
  const extensionId = await browser.installExtension(extDir);
  const cleanup = async () => {
    await browser.close().catch(() => undefined);
    fs.rmSync(userDataDir, { recursive: true, force: true });
  };
  return { browser, extensionId, extOrigin: `chrome-extension://${extensionId}`, userDataDir, cleanup };
}

/**
 * 打开「开发者模式」。不开的话 chrome.runtime.reload() 之后未打包扩展会被禁用
 * （disable_reasons: DISABLE_UNSUPPORTED_DEVELOPER_EXTENSION）。
 * 预写 Preferences 无效（实测 CfT 157），只能经 chrome://extensions 页面的 developerPrivate 接口设置。
 */
export async function enableDeveloperMode(browser) {
  const page = await browser.newPage();
  try {
    await page.goto('chrome://extensions');
    await page.evaluate(() => chrome.developerPrivate.updateProfileConfiguration({ inDeveloperMode: true }));
  } finally {
    await page.close();
  }
}
