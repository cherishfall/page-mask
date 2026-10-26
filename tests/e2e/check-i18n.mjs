/**
 * #28 manifest 多语言实测：分别以英文 / 简体中文界面启动 Chrome for Testing，加载 .output/chrome-mv3，
 * 在扩展页面里读取扩展名称、描述、按钮提示，确认按界面语言取到对应文本。
 *
 * 注意：getManifest() 返回的是未解析的 __MSG_x__ 占位，所以用 chrome.management.getSelf()
 * （不需要 management 权限）与 chrome.i18n.getMessage() 读取解析后的文本。
 *
 * 界面语言的设置方式因平台而异：
 *   - macOS（实测 CfT 157，系统语言 zh-Hans-CN）：--lang=en-US、--accept-lang=en-US 都不生效，界面仍是 zh-CN；
 *     只有 Cocoa 命令行参数 `-AppleLanguages (en-US)` 生效（只影响这一次启动的进程，不改系统设置）。
 *   - Linux / Windows：按 Chrome 文档 --lang 生效；Linux 另设 LANGUAGE 环境变量（未在本机实测）。
 * 两种都传，互不干扰。
 *
 * 用法：npm run build && node tests/e2e/check-i18n.mjs   （不进 test:e2e，手动跑）
 */
import fs from 'node:fs';
import path from 'node:path';
import { launchWithExtension, REPO_ROOT } from './lib/browser.mjs';

const extDir = path.join(REPO_ROOT, '.output/chrome-mv3');
const messagesOf = (locale) =>
  JSON.parse(fs.readFileSync(path.join(extDir, '_locales', locale, 'messages.json'), 'utf8'));

const CASES = [
  { lang: 'en-US', locale: 'en' },
  { lang: 'zh-CN', locale: 'zh_CN' },
];

function langArgs(lang) {
  return [`--lang=${lang}`, '-AppleLanguages', `(${lang})`];
}

let failed = 0;
for (const { lang, locale } of CASES) {
  const expected = messagesOf(locale);
  process.env.LANGUAGE = lang.replace('-', '_');
  const { browser, extOrigin, cleanup } = await launchWithExtension({ extDir, args: langArgs(lang) });
  try {
    const page = await browser.newPage();
    // 用一个不会主动调用其他接口的扩展页面即可；manifest 解析与页面无关
    await page.goto(`${extOrigin}/management.html`, { waitUntil: 'domcontentloaded' });
    const got = await page.evaluate(async () => {
      const self = await chrome.management.getSelf();
      return {
        uiLanguage: chrome.i18n.getUILanguage(),
        name: self.name,
        description: self.description,
        msgName: chrome.i18n.getMessage('extName'),
        actionTitle: await chrome.action.getTitle({}),
      };
    });
    const checks = [
      ['management.getSelf().name', got.name, expected.extName.message],
      ['management.getSelf().description', got.description, expected.extDescription.message],
      ['i18n.getMessage(extName)', got.msgName, expected.extName.message],
      ['action.getTitle()', got.actionTitle, expected.actionTitle.message],
    ];
    console.log(`\n▶ 启动语言 ${lang}（Chrome 报告的界面语言：${got.uiLanguage}）`);
    for (const [what, actual, want] of checks) {
      const ok = actual === want;
      if (!ok) failed++;
      console.log(`  ${ok ? '✔' : '✖'} ${what} = 「${actual}」${ok ? '' : ` ≠ 期望「${want}」`}`);
    }
  } finally {
    await cleanup();
  }
}

if (failed) {
  console.error(`\n✖ 多语言检查失败 ${failed} 项`);
  process.exit(1);
}
console.log('\n✔ 多语言检查通过');
