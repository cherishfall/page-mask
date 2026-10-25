/**
 * 真实网站 E2E：在微信读书 / 得到 / 极客时间 / 墨问 的匿名可访问页面上，
 * 走完整向导流程（真鼠标点选 → 预览 → 保存），验证伪装真实生效。
 * 权限预授予方式同本地 E2E（产物拷贝写入 host_permissions）。
 * 运行：node tests/e2e/run-e2e-real.mjs
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = '/tmp/cft/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const EXT_DIR = path.resolve('.output/chrome-mv3');
const TEST_EXT_DIR = '/tmp/pm-e2e-real-ext';
const PROFILE_DIR = '/tmp/pm-e2e-real-profile';
const EVIDENCE_DIR = 'docs/dev/evidence';

/** 每个站点：入口 URL 与一个"可点选目标"的取点策略（匿名页面稳定存在的元素） */
const SITES = [
  // 极客时间主站 www.geekbang.org 对当前网络返回 451，产品站实际在 time.geekbang.org
  { name: '微信读书', key: 'weread', url: 'https://weread.qq.com/', pick: 'a, button, [class*=nav]' },
  { name: '得到', key: 'dedao', url: 'https://www.dedao.cn/', pick: 'a, button, header *' },
  // 极客时间对本机当前网络出口一律 451（含 --no-proxy-server 直连），页面无可选元素；
  // 属环境受限，容忍失败如实记录，不算插件问题
  { name: '极客时间', key: 'geekbang', url: 'https://time.geekbang.org/', pick: 'a, button, header *', tolerateFailure: true },
  { name: '墨问', key: 'mowen', url: 'https://mowen.cn/', pick: 'a, button, header *' },
];

function assert(cond, msg) {
  if (!cond) throw new Error(`真机断言失败: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function main() {
  fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
  fs.rmSync(TEST_EXT_DIR, { recursive: true, force: true });
  fs.cpSync(EXT_DIR, TEST_EXT_DIR, { recursive: true });
  const manifestPath = path.join(TEST_EXT_DIR, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  // 授权整站含子域（站点可能重定向到 www 等子域）
  const hosts = SITES.map((s) => new URL(s.url).hostname);
  manifest.host_permissions = [...new Set(hosts.flatMap((h) => [`*://*.${h}/*`]))];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: false,
    userDataDir: PROFILE_DIR,
    args: [
      `--disable-extensions-except=${TEST_EXT_DIR}`,
      `--load-extension=${TEST_EXT_DIR}`,
      '--remote-debugging-port=9335',
      '--no-first-run',
      '--window-size=1360,900',
      '--lang=zh-CN',
    ],
  });

  try {
    const warmup = await browser.newPage();
    await warmup.goto('about:blank').catch(() => undefined);
    const swTarget = await browser.waitForTarget(
      (t) => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://'),
      { timeout: 15000 },
    );
    const sw = await swTarget.worker();
    await warmup.close().catch(() => undefined);
    console.log('✓ 扩展已加载（真机模式）');

    const failed = [];
    for (const site of SITES) {
      console.log(`\n--- ${site.name} ${site.url} ---`);
      const page = await browser.newPage();
      page.on('pageerror', () => undefined);
      try {
        const resp = await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForSelector('body *', { timeout: 20000 });
        const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
        if (resp?.status() === 451 || bodyText.includes('451')) {
          console.log(`  ⚠ ${site.name} 对当前网络出口返回 451（环境受限，非插件问题），跳过`);
          continue;
        }
        // 等首屏渲染稳定
        await new Promise((r) => setTimeout(r, 2500));

        // 以落地 URL 的真实 origin 为准（站点可能重定向到子域）
        const origin = new URL(page.url()).origin;
        // 预置空站点配置（原样态）+ 注册（与 popup enableSite 等价）
        await sw.evaluate(async (o) => {
          await chrome.storage.local.set({
            [`profile:${o}`]: {
              formatVersion: 1,
              origin: o,
              switchState: 'original',
              disguisedTitle: null,
              faviconDataUrl: null,
              hideRules: [],
              floatingBtnPos: null,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          });
          try {
            await chrome.scripting.registerContentScripts([
              {
                id: `pagemask:${o}`,
                matches: [`${o}/*`],
                js: ['content-scripts/content.js'],
                runAt: 'document_idle',
                persistAcrossSessions: true,
              },
            ]);
          } catch {
            // 已注册
          }
        }, origin);
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
        await new Promise((r) => setTimeout(r, 2500));

        // 打开向导（新站点）
        const tabId = await sw.evaluate(async (o) => (await chrome.tabs.query({ url: `${o}/*` }))[0].id, origin);
        await sw.evaluate(async (id) => {
          await chrome.tabs.sendMessage(id, { t: 'openWizard', mode: 'newSite' });
        }, tabId);
        await new Promise((r) => setTimeout(r, 600));
        const toolbar = await page.evaluate(() => {
          const host = document.getElementById('pagemask-wizard-host');
          return !!host?.shadowRoot?.querySelector('[data-testid="pm-wizard-toolbar"]');
        });
        assert(toolbar, `${site.name}：向导打开`);

        // 找一个可见可点选的元素（避开链接跳转：点选不触发导航，preventDefault 兜底）
        const pt = await page.evaluate((pickSel) => {
          const ok = (el) => {
            const r = el.getBoundingClientRect();
            const s = getComputedStyle(el);
            return (
              r.width >= 80 && r.height >= 24 && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 &&
              s.visibility !== 'hidden' && s.pointerEvents !== 'none' && el.tagName !== 'HTML' && el.tagName !== 'BODY'
            );
          };
          // 先按语义选择器找
          const cands = Array.from(document.querySelectorAll(pickSel));
          const vis = cands.find(ok);
          // 兜底：视口网格扫描第一个合格元素
          const found =
            vis ??
            (() => {
              for (let y = 100; y < innerHeight - 40; y += 90) {
                for (let x = 80; x < innerWidth - 80; x += 140) {
                  let el = document.elementFromPoint(x, y);
                  while (el && !ok(el)) el = el.parentElement;
                  if (el) return el;
                }
              }
              return null;
            })();
          if (!found) return null;
          const r = found.getBoundingClientRect();
          return { x: Math.floor(r.x + r.width / 2), y: Math.floor(r.y + r.height / 2), tag: found.tagName };
        }, site.pick);
        assert(pt, `${site.name}：找到可点选元素`);

        await page.mouse.click(pt.x, pt.y);
        await new Promise((r) => setTimeout(r, 400));
        const countText = await page.evaluate(() => {
          const host = document.getElementById('pagemask-wizard-host');
          return host?.shadowRoot?.querySelector('[data-testid="pm-wiz-preview"]')?.textContent ?? '';
        });
        assert(countText.includes('1'), `${site.name}：元素已选中（${countText.trim()}）`);

        // 预览 → 保存
        await page.evaluate(() => {
          document.getElementById('pagemask-wizard-host')?.shadowRoot?.querySelector('[data-testid="pm-wiz-preview"]')?.click();
        });
        await new Promise((r) => setTimeout(r, 900));
        await page.evaluate(() => {
          document.getElementById('pagemask-wizard-host')?.shadowRoot?.querySelector('[data-testid="pm-wiz-save"]')?.click();
        });
        await new Promise((r) => setTimeout(r, 400));
        await page.evaluate(() => {
          document.getElementById('pagemask-wizard-host')?.shadowRoot?.querySelector('[data-testid="pm-wiz-save-yes"]')?.click();
        });
        await new Promise((r) => setTimeout(r, 1200));

        const after = await page.evaluate(() => ({
          title: document.title,
          wizardGone: !document.getElementById('pagemask-wizard-host'),
          toggle: !!document.getElementById('pagemask-floating-host'),
        }));
        assert(after.wizardGone, `${site.name}：保存后向导关闭`);
        assert(after.title === '新建标签页', `${site.name}：标题已伪装（实际 "${after.title}"）`);
        assert(after.toggle, `${site.name}：悬浮按钮在`);

        // 硬校验：保存的规则候选在页面真实命中且已被隐藏
        const ruleCheck = await sw.evaluate(async (o) => {
          const items = await chrome.storage.local.get(`profile:${o}`);
          return items[`profile:${o}`]?.hideRules?.[0]?.candidates ?? null;
        }, origin);
        if (ruleCheck) {
          const hidden = await page.evaluate((sels) => {
            const el = document.querySelector(sels.join(', '));
            if (!el) return 'no-match';
            const s = getComputedStyle(el);
            return `${s.display}/${s.visibility}`;
          }, ruleCheck);
          assert(hidden.startsWith('none') || hidden.includes('hidden'), `${site.name}：规则真实命中并隐藏（${hidden}）`);
        }
        await page.screenshot({ path: `${EVIDENCE_DIR}/real-${site.key}.png` });

        // 清理该站点配置，保持下一站点互不影响
        await sw.evaluate(async (o) => {
          await chrome.storage.local.remove(`profile:${o}`);
        }, origin);
      } catch (e) {
        if (site.tolerateFailure) {
          console.log(`  ⚠ ${site.name} 环境受限（详见脚本注释与 DEVLOG），跳过不计失败：${e.message.split('\n')[0]}`);
        } else {
          failed.push(site.name);
          console.log(`  ✗ ${site.name} 失败：${e.message.split('\n')[0]}`);
        }
      } finally {
        await page.close().catch(() => undefined);
      }
    }

    if (failed.length > 0) {
      console.error(`\n真实网站 E2E 失败站点：${failed.join('、')} ❌`);
      process.exitCode = 1;
    } else {
      console.log('\n真实网站 E2E 全部通过（451 视为环境受限跳过）✅');
      process.exitCode = 0;
    }
  } catch (e) {
    console.error('\n真实网站 E2E 失败 ❌\n', e);
    process.exitCode = 1;
  } finally {
    await browser.close().catch(() => undefined);
  }
}

main();
