/**
 * 方案C遮罩验收（#23，REVIEW N25 / N42）：后加载元素、滚动跟手、深色页面颜色、遮罩下不可点、静止停帧、原样态不观察。
 *
 * 运行：npm run build && node tests/e2e/check-mask.mjs     （约 15 秒；HEADFUL=1 有界面运行）
 *
 * 覆盖：
 * - /late：页面加载 2 秒后插入的命中元素被遮住（遮罩矩形与元素矩形各边偏差 ≤1px）；页面滚动、
 *   页面里的滚动容器滚动后等两帧，遮罩仍与元素重合；元素被移除后遮罩撤掉
 * - /dark：body #111、卡片 #1e1e1e，卡片里的链接被遮：遮罩颜色 = 卡片背景；点链接中心，命中测试落在遮罩宿主上，
 *   链接的 click 监听没触发、地址没变；遮罩跟随链接的圆角
 * - 静止 2 秒内，内容脚本隔离环境里的 requestAnimationFrame 调用 ≤ 2 次（evalInContentWorld 挂计数钩子，
 *   先滚动一次证明钩子有效）
 * - 切到原样：观察整页的 MutationObserver 数量为 0（隔离环境里给 observe / disconnect 挂钩子计数），
 *   之后插入的命中元素不出现遮罩
 *
 * 不写截图、不留临时文件。
 */
import { createReporter, startServer, waitFor } from './lib/harness.mjs';
import { evalInContentWorld, launchExtension, patchProfile, sendToBackground, setProfile, tabIdOf } from './lib/extension.mjs';

const r = createReporter();
const { check } = r;
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const MASK_HOST = 'pagemask-mask';
const TOGGLE_HOST = 'pagemask-toggle';

const PAGES = {
  '/blank': '<!doctype html><html><head><meta charset="utf-8"><title>blank</title></head><body><p>blank</p></body></html>',
  '/late': `<!doctype html><html><head><meta charset="utf-8"><title>late</title>
<style>body{margin:0;font-family:system-ui,sans-serif;background:#fff}.spacer{height:300px}
#scroller{height:200px;overflow:auto;border:1px solid #ccc;margin:16px}#scroller .inner{height:900px;padding-top:120px}
.inner-ad{height:40px;background:#fc0}.late-ad{height:60px;margin:0 16px;background:#f60;border-radius:12px}.tall{height:2400px}</style>
</head><body><main><h1>正文</h1><p class="spacer">段落</p><div id="slot"></div>
<div id="scroller"><div class="inner"><div class="inner-ad">滚动容器里的推广</div></div></div>
<div class="tall"></div></main>
<script>setTimeout(() => {
  const d = document.createElement('div');
  d.className = 'late-ad';
  d.textContent = '后加载的推广';
  document.getElementById('slot').appendChild(d);
}, 2000);</script></body></html>`,
  '/dark': `<!doctype html><html><head><meta charset="utf-8"><title>dark</title>
<style>body{margin:0;background:#111;color:#eee;font-family:system-ui,sans-serif}
.card{background:#1e1e1e;padding:24px;margin:40px;border-radius:8px}
.promo-link{display:inline-block;padding:12px 20px;color:#9cf;border-radius:6px;background:#334}</style>
</head><body><div class="card"><p>卡片正文</p><a class="promo-link" href="#clicked">推广链接</a></div>
<div style="height:2000px"></div>
<script>window.__clicks = 0; document.querySelector('.promo-link').addEventListener('click', () => { window.__clicks++; });</script>
</body></html>`,
};

const handler = (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  const body = PAGES[pathname];
  if (!body) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(body);
};

const now = Date.now();
const maskRule = (id, name, candidates) => ({
  id,
  elementName: name,
  candidates,
  strategy: 'mask',
  scope: { type: 'all' },
  onlyThis: false,
  createdAt: now,
  lastHealth: 'ok',
});
const profileOf = (origin) => ({
  formatVersion: 1,
  origin,
  switchState: 'disguised',
  disguisedTitle: null,
  faviconDataUrl: null,
  hideRules: [
    maskRule('m1', '后加载推广', ['.late-ad']),
    maskRule('m2', '滚动容器推广', ['.inner-ad']),
    maskRule('m3', '推广链接', ['.promo-link']),
  ],
  floatingBtnPos: null,
  createdAt: now,
  updatedAt: now,
});

/** 页面里：sel 命中的第一个元素与「最贴合的那块遮罩」各边的最大偏差（px）；没有元素或遮罩时返回 null */
function coverage(sel, host) {
  const el = document.querySelector(sel);
  const boxes = document.querySelector(host)?.shadowRoot?.querySelectorAll('[data-pm-mask]') ?? [];
  if (!el || boxes.length === 0) return null;
  const e = el.getBoundingClientRect();
  let best = Infinity;
  for (const b of boxes) {
    const m = b.getBoundingClientRect();
    if (m.width === 0) continue;
    best = Math.min(best, Math.max(Math.abs(m.left - e.left), Math.abs(m.top - e.top), Math.abs(m.right - e.right), Math.abs(m.bottom - e.bottom)));
  }
  return best === Infinity ? null : best;
}

/** 等到 sel 被一块遮罩盖住（各边偏差 ≤1px） */
async function waitCovered(page, sel, label, { timeout = 8000 } = {}) {
  const deadline = Date.now() + timeout;
  let last = null;
  while (Date.now() < deadline) {
    last = await page.evaluate(coverage, sel, MASK_HOST);
    if (last !== null && last <= 1) return;
    await sleep(50);
  }
  throw new Error(`等待超时（${timeout}ms）：${label}（最后偏差 ${last}）`);
}

const boxCount = (page) =>
  page.evaluate((h) => document.querySelector(h)?.shadowRoot?.querySelectorAll('[data-pm-mask]').length ?? 0, MASK_HOST);

/** 主世界里等两个动画帧（滚动后让跟随有机会更新） */
const twoFrames = (page) => page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));

// 隔离环境里的钩子（字符串表达式，evalInContentWorld 求值）
const HOOK_RAF = `(() => {
  const w = window;
  if (!w.__pmRafHooked) {
    const orig = w.requestAnimationFrame.bind(w);
    w.requestAnimationFrame = (cb) => { w.__pmRafCount++; return orig(cb); };
    w.__pmRafHooked = true;
  }
  w.__pmRafCount = 0;
  return true;
})()`;
const HOOK_OBSERVERS = `(() => {
  const w = window;
  if (!w.__pmObsHooked) {
    const P = w.MutationObserver.prototype;
    const observe = P.observe;
    const disconnect = P.disconnect;
    w.__pmObs = new Set();
    P.observe = function (target, opts) {
      if (target === document.documentElement && opts && opts.subtree) w.__pmObs.add(this);
      return observe.call(this, target, opts);
    };
    P.disconnect = function () {
      w.__pmObs.delete(this);
      return disconnect.call(this);
    };
    w.__pmObsHooked = true;
  }
  return w.__pmObs.size;
})()`;

async function main() {
  const srv = await startServer(handler);
  const ORIGIN = srv.origin;
  const ext = await launchExtension({ hostOrigins: [ORIGIN], revocable: false });
  try {
    await setProfile(ext.control, ORIGIN, profileOf(ORIGIN));
    // 先在空白页上启用一次（对账注册内容脚本），之后新打开的页面在 document_start 注入
    const page = await ext.browser.newPage();
    await page.setViewport({ width: 1000, height: 700 });
    await page.goto(`${ORIGIN}/blank`, { waitUntil: 'load' });
    await sendToBackground(ext.control, { t: 'enableSite', origin: ORIGIN, tabId: await tabIdOf(ext.control, `${ORIGIN}/*`) });
    await page.waitForSelector(TOGGLE_HOST, { timeout: 8000 });

    // ===================== 后加载元素 + 滚动跟手 =====================
    console.log('\n--- 后加载元素与滚动跟手 ---');
    await page.goto(`${ORIGIN}/late`, { waitUntil: 'load' });
    await waitFor(page, '内容脚本注入（悬浮按钮出现）', (h) => !!document.querySelector(h), [TOGGLE_HOST]);
    await waitCovered(page, '.inner-ad', '滚动容器里的元素被遮住');
    const covInner0 = await page.evaluate(coverage, '.inner-ad', MASK_HOST);
    check(covInner0 !== null && covInner0 <= 1, `已有元素被遮住（偏差 ${covInner0}px）`);
    check(!(await page.$('.late-ad')), '对照：2 秒前后加载元素还没出现');
    await waitFor(page, '后加载元素插入', () => !!document.querySelector('.late-ad'), [], { timeout: 5000 });
    await waitCovered(page, '.late-ad', '后加载元素被遮住', { timeout: 3000 });
    check(true, '页面加载 2 秒后插入的命中元素被遮住（遮罩与元素各边偏差 ≤1px）');
    const radius = await page.evaluate((h) => {
      const boxes = [...document.querySelector(h).shadowRoot.querySelectorAll('[data-pm-mask]')];
      return boxes.map((b) => b.style.borderRadius);
    }, MASK_HOST);
    check(radius.includes('12px'), `遮罩跟随被遮元素的圆角（${radius.join(', ')}）`);

    await page.evaluate(() => window.scrollBy(0, 150));
    await twoFrames(page);
    const covScroll = await page.evaluate(coverage, '.late-ad', MASK_HOST);
    check(covScroll !== null && covScroll <= 1, `页面滚动后两帧内遮罩跟手（偏差 ${covScroll}px）`);
    await page.evaluate(() => {
      document.getElementById('scroller').scrollTop = 80;
    });
    await twoFrames(page);
    const covInner = await page.evaluate(coverage, '.inner-ad', MASK_HOST);
    check(covInner !== null && covInner <= 1, `页面里的滚动容器滚动后两帧内遮罩跟手（偏差 ${covInner}px）`);

    const before = await boxCount(page);
    await page.evaluate(() => document.querySelector('.late-ad').remove());
    await waitFor(page, '元素移除后遮罩撤掉', (h, n) => (document.querySelector(h)?.shadowRoot?.querySelectorAll('[data-pm-mask]').length ?? 0) === n - 1, [MASK_HOST, before]);
    check(true, `命中元素被移除后对应遮罩撤掉（${before} → ${before - 1}）`);

    // ===================== 深色页面：颜色 + 不可点 =====================
    console.log('\n--- 深色页面：遮罩颜色与不可点 ---');
    await page.goto(`${ORIGIN}/dark`, { waitUntil: 'load' });
    await waitCovered(page, '.promo-link', '链接被遮住');
    const colors = await page.evaluate((h) => {
      const box = document.querySelector(h).shadowRoot.querySelector('[data-pm-mask]');
      return {
        mask: getComputedStyle(box).backgroundColor,
        card: getComputedStyle(document.querySelector('.card')).backgroundColor,
        radius: getComputedStyle(box).borderRadius,
      };
    }, MASK_HOST);
    check(colors.mask === colors.card && colors.card === 'rgb(30, 30, 30)', `遮罩颜色 = 卡片背景（遮罩 ${colors.mask}，卡片 ${colors.card}）`);
    check(colors.radius === '6px', `遮罩圆角跟随链接（${colors.radius}）`);
    const center = await page.evaluate(() => {
      const r = document.querySelector('.promo-link').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    const hitTag = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName.toLowerCase(), center);
    check(hitTag === MASK_HOST, `链接中心的命中测试落在遮罩宿主上（${hitTag}）`);
    await page.mouse.click(center.x, center.y);
    await sleep(300);
    const after = await page.evaluate(() => ({ clicks: window.__clicks, hash: location.hash }));
    check(after.clicks === 0 && after.hash === '', `点遮罩下的链接：click 未触发、地址未变（clicks=${after.clicks}，hash="${after.hash}"）`);

    // ===================== 静止停帧 =====================
    console.log('\n--- 静止页面无持续逐帧回调 ---');
    await evalInContentWorld(page, ext.extOrigin, HOOK_RAF);
    await page.mouse.wheel({ deltaY: 40 });
    await sleep(300);
    const busy = await evalInContentWorld(page, ext.extOrigin, 'window.__pmRafCount');
    check(busy > 0, `对照：滚动时内容脚本请求了动画帧（${busy} 次，钩子有效）`);
    await sleep(500);
    await evalInContentWorld(page, ext.extOrigin, 'window.__pmRafCount = 0');
    await sleep(2000);
    const idle = await evalInContentWorld(page, ext.extOrigin, 'window.__pmRafCount');
    check(idle <= 2, `静止 2 秒内内容脚本的 requestAnimationFrame 调用 ≤2（实际 ${idle}）`);

    // ===================== 原样态不观察 =====================
    console.log('\n--- 原样态下不观察 DOM ---');
    await page.goto(`${ORIGIN}/late`, { waitUntil: 'load' });
    await waitFor(page, '遮罩出现', (h) => (document.querySelector(h)?.shadowRoot?.querySelectorAll('[data-pm-mask]').length ?? 0) >= 1, [MASK_HOST]);
    await evalInContentWorld(page, ext.extOrigin, HOOK_OBSERVERS);
    // 走一遍 原样 → 清爽，让钩子看到遮罩观察器的创建
    await patchProfile(ext.control, ORIGIN, { switchState: 'original' });
    await waitFor(page, '切原样后遮罩撤掉', (h) => !document.querySelector(h), [MASK_HOST]);
    await patchProfile(ext.control, ORIGIN, { switchState: 'disguised' });
    await waitFor(page, '切回清爽后遮罩恢复', (h) => !!document.querySelector(h), [MASK_HOST]);
    const observingOn = await evalInContentWorld(page, ext.extOrigin, 'window.__pmObs.size');
    check(observingOn === 1, `对照：清爽态有 1 个观察整页的 MutationObserver（${observingOn}）`);
    await patchProfile(ext.control, ORIGIN, { switchState: 'original' });
    await waitFor(page, '切原样后遮罩撤掉', (h) => !document.querySelector(h), [MASK_HOST]);
    const observingOff = await evalInContentWorld(page, ext.extOrigin, 'window.__pmObs.size');
    check(observingOff === 0, `原样态下观察整页的 MutationObserver 数量为 0（${observingOff}）`);
    await page.evaluate(() => {
      const d = document.createElement('div');
      d.className = 'late-ad';
      d.textContent = '原样态下插入';
      document.body.prepend(d);
    });
    await sleep(600);
    check((await boxCount(page)) === 0 && !(await page.$(MASK_HOST)), '原样态下插入命中元素，没有遮罩出现');
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
