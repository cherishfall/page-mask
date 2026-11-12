/**
 * E2E 通用工具：断言与"预期失败"、本地测试服务器（随机端口）、产物目录、按条件等待。
 *
 * 用法：
 *   const r = createReporter();
 *   r.check(cond, '说明');                         // 不满足即抛错（主流程快速失败）
 *   await r.expectFail('SW 空闲后还原', 20, async () => { ...; r.check(...) });
 *   process.exitCode = r.summary();
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './browser.mjs';
import { siteKey as coreSiteKey, sitePatterns as coreSitePatterns } from './site-key.mjs';

export class CheckError extends Error {}

export function createReporter() {
  let passed = 0;
  let failed = 0;
  let expectedFailures = 0;
  const unexpectedPasses = [];

  function check(cond, msg) {
    if (!cond) throw new CheckError(`断言失败: ${msg}`);
    passed++;
    console.log(`  ✓ ${msg}`);
  }

  /**
   * 已知缺陷的回归用例：fn 抛错 → 打印「预期失败 → #NN」，不计入失败；
   * fn 意外通过 → 打印提醒并计为失败，提示负责的票把它转为普通用例。
   */
  async function expectFail(name, issue, fn) {
    console.log(`\n--- [预期失败 #${issue}] ${name} ---`);
    try {
      await fn();
    } catch (e) {
      expectedFailures++;
      console.log(`  ⚠ 预期失败 → #${issue}：${e instanceof Error ? e.message.split('\n')[0] : e}`);
      return;
    }
    failed++;
    unexpectedPasses.push(`${name}（#${issue}）`);
    console.log(`  ✗ 意外通过：「${name}」已不再失败，请在 #${issue} 中把它从 expectFail 转为普通用例`);
  }

  function fail(e) {
    failed++;
    console.error('\nE2E 失败 ❌\n', e);
  }

  /** 打印汇总并返回进程退出码 */
  function summary() {
    console.log(`\n汇总：通过 ${passed} 项，预期失败 ${expectedFailures} 项，失败 ${failed} 项`);
    if (unexpectedPasses.length) console.log(`意外通过：${unexpectedPasses.join('、')}`);
    console.log(failed === 0 ? '全部 E2E 断言通过 ✅' : 'E2E 未通过 ❌');
    return failed === 0 ? 0 : 1;
  }

  return { check, expectFail, fail, summary };
}

/**
 * 本地测试服务器，监听随机端口（listen(0)）。
 * 用法：const srv = await startServer((req, res) => {...}); srv.origin; await srv.close();
 */
export async function startServer(handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    port,
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

/** 产物目录 test-results/<name>（已在 .gitignore），不存在则创建 */
export function resultsDir(name) {
  const dir = path.join(REPO_ROOT, 'test-results', name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * 页面 origin / 主机名 → 站点 key。直接复用内核实现（core/site-key.ts，#162，经
 * tests/e2e/lib/site-key.mjs 转译加载）：可注册域名按 eTLD+1 合并（weread.qq.com → qq.com），
 * IP 字面量 / localhost / 单标签主机名 / 带端口保留 host[:port] 不合并——真站 E2E 写档案的
 * 存储键与内容脚本读的必须是同一个（0.9.1 的简版只保留 host[:port]，#192 修复）。
 * 内核返回 null（无法解析）时退回原值，不让断言工具在坏输入上先炸。
 * 用法：const key = siteKeyOf(srv.origin); // '127.0.0.1:54321'
 *       siteKeyOf('https://weread.qq.com/'); // 'qq.com'
 */
export function siteKeyOf(origin) {
  return coreSiteKey(origin) ?? origin;
}

/**
 * 站点 key → 规范匹配模式，与内核 sitePatterns 同一实现。
 * 带端口的 key 不能写 `*://host:port/*`（Chrome 判 Invalid port），要拆成 http / https 两条；
 * 可注册域名是裸域在前、子域在后两条。
 * 用法：sitePatternsOf(srv.origin); // ['http://127.0.0.1:54321/*', 'https://127.0.0.1:54321/*']
 */
export function sitePatternsOf(origin) {
  return coreSitePatterns(siteKeyOf(origin));
}

/**
 * page.waitForFunction 的包装：超时时报出可读的说明，而不是裸 TimeoutError。
 * 用法：await waitFor(page, '标题变为 x', (t) => document.title === t, ['x']);
 */
export async function waitFor(page, label, fn, args = [], { timeout = 8000 } = {}) {
  try {
    await page.waitForFunction(fn, { timeout, polling: 50 }, ...args);
  } catch (e) {
    throw new CheckError(`等待超时（${timeout}ms）：${label}（${e instanceof Error ? e.message.split('\n')[0] : e}）`);
  }
}

/** 轮询 Node 侧条件（不涉及页面时用），满足返回值为真时结束 */
export async function poll(fn, label, { timeout = 8000, interval = 100 } = {}) {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - start > timeout) throw new CheckError(`等待超时（${timeout}ms）：${label}`);
    await new Promise((r) => setTimeout(r, interval));
  }
}
