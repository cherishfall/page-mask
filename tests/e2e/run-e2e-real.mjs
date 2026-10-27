/**
 * 真实网站 E2E：在用户指定的几个阅读/学习类网站的匿名可访问页面上，
 * 走完整向导流程（真鼠标点选 → 预览 → 保存），验证清爽模式真实生效。
 * 只访问匿名页面，使用临时浏览器配置，不涉及任何登录态。不进 test:e2e（依赖外网）。
 * 权限预授予方式同本地 E2E（产物拷贝写入 host_permissions）。截图写到 test-results/real/。
 * 运行：npm run build && node tests/e2e/run-e2e-real.mjs
 */
import path from 'node:path';
import { resultsDir, waitFor } from './lib/harness.mjs';
import { getProfile, launchExtension, sendToBackground, sendToTab, setProfile, tabIdOf } from './lib/extension.mjs';
import { clickInShadow, waitForShadow } from './lib/shadow.mjs';

const OUT = resultsDir('real');
const WIZARD_HOST = 'pagemask-wizard';

/** 每个站点：入口 URL 与一个"可点选目标"的取点策略（匿名页面稳定存在的元素）。名称直接用域名 */
const SITES = [
  { url: 'https://weread.qq.com/', pick: 'a, button, [class*=nav]' },
  { url: 'https://www.dedao.cn/', pick: 'a, button, header *' },
  // 该站对本机当前网络出口一律 451（含直连），页面无可选元素；属环境受限，容忍失败如实记录
  { url: 'https://time.geekbang.org/', pick: 'a, button, header *', tolerateFailure: true },
  { url: 'https://mowen.cn/', pick: 'a, button, header *' },
].map((s) => ({ ...s, name: new URL(s.url).hostname }));

function assert(cond, msg) {
  if (!cond) throw new Error(`真机断言失败: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function main() {
  // 授权整站含子域（站点可能重定向到 www 等子域）
  const hosts = [...new Set(SITES.map((s) => new URL(s.url).hostname))];
  const ext = await launchExtension({ hostPatterns: hosts.map((h) => `*://*.${h}/*`), revocable: false });
  const { browser, control } = ext;
  try {
    console.log('✓ 扩展已加载（真机模式）');
    await control.evaluate((st) => chrome.storage.local.set({ settings: st }), { defaultTitle: '阅读' });

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
        // 等首屏渲染稳定（真实站点长连接多，网络空闲等不到也继续）
        await page.waitForNetworkIdle({ idleTime: 800, timeout: 8000 }).catch(() => undefined);

        // 以落地 URL 的真实 origin 为准（站点可能重定向到子域）
        const origin = new URL(page.url()).origin;
        const now = Date.now();
        await setProfile(control, origin, {
          formatVersion: 1,
          origin,
          switchState: 'original',
          disguisedTitle: null,
          faviconDataUrl: null,
          hideRules: [],
          floatingBtnPos: null,
          createdAt: now,
          updatedAt: now,
        });
        const tabId = await tabIdOf(control, `${origin}/*`);
        const res = await sendToBackground(control, { t: 'enableSite', origin, tabId });
        assert(res?.ok, `${site.name}：enableSite 成功`);
        await page.waitForSelector('pagemask-toggle', { timeout: 10000 });

        // 打开向导（新站点）
        await sendToTab(control, tabId, { t: 'openWizard', mode: 'newSite' });
        await waitForShadow(page, WIZARD_HOST, '[data-testid="pm-wizard-toolbar"]');
        assert(true, `${site.name}：向导打开`);

        // 找一个可见可点选的元素（避开链接跳转：点选不触发导航，preventDefault 兜底）
        const pt = await page.evaluate((pickSel) => {
          const ok = (el) => {
            const r = el.getBoundingClientRect();
            const s = getComputedStyle(el);
            return (
              r.width >= 80 && r.height >= 24 && r.top >= 60 && r.bottom <= innerHeight && r.left >= 0 &&
              s.visibility !== 'hidden' && s.pointerEvents !== 'none' && el.tagName !== 'HTML' && el.tagName !== 'BODY'
            );
          };
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
        await waitFor(
          page,
          '元素已选中',
          (h) => (document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-wiz-preview"]')?.textContent ?? '').includes('1'),
          [WIZARD_HOST],
        );
        assert(true, `${site.name}：元素已选中`);

        // 预览 → 保存
        await clickInShadow(page, WIZARD_HOST, '[data-testid="pm-wiz-preview"]');
        await waitForShadow(page, WIZARD_HOST, '[data-testid="pm-wiz-save"]');
        await clickInShadow(page, WIZARD_HOST, '[data-testid="pm-wiz-save"]');
        await waitForShadow(page, WIZARD_HOST, '[data-testid="pm-wiz-save-yes"]');
        await clickInShadow(page, WIZARD_HOST, '[data-testid="pm-wiz-save-yes"]');
        await waitFor(page, '保存后向导关闭', (h) => !document.querySelector(h), [WIZARD_HOST]);
        await waitFor(page, '标题已伪装', () => document.title === '阅读');
        assert(true, `${site.name}：保存后向导关闭、标题已伪装`);
        assert(await page.$('pagemask-toggle'), `${site.name}：悬浮按钮在`);

        // 硬校验：保存的规则候选在页面真实命中且已被隐藏
        const candidates = (await getProfile(control, origin))?.hideRules?.[0]?.candidates ?? null;
        if (candidates) {
          const hidden = await page.evaluate((sels) => {
            const el = document.querySelector(sels.join(', '));
            if (!el) return 'no-match';
            const s = getComputedStyle(el);
            return `${s.display}/${s.visibility}`;
          }, candidates);
          assert(hidden.startsWith('none') || hidden.includes('hidden'), `${site.name}：规则真实命中并隐藏（${hidden}）`);
        }
        await page.screenshot({ path: path.join(OUT, `real-${site.name}.png`) });

        // 清理该站点配置，保持下一站点互不影响
        await sendToBackground(control, { t: 'resetSite', origin });
      } catch (e) {
        if (site.tolerateFailure) {
          console.log(`  ⚠ ${site.name} 环境受限，跳过不计失败：${e.message.split('\n')[0]}`);
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
      console.log(`\n真实网站 E2E 全部通过（451 视为环境受限跳过）✅ 截图在 ${path.relative(process.cwd(), OUT)}/`);
      process.exitCode = 0;
    }
  } catch (e) {
    console.error('\n真实网站 E2E 失败 ❌\n', e);
    process.exitCode = 1;
  } finally {
    await ext.cleanup();
  }
}

main();
