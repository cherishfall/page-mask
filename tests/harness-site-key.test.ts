/**
 * E2E 工具与内核的站点 key 一致性守门（#192）。
 *
 * tests/e2e/lib/harness.mjs 的 siteKeyOf / sitePatternsOf 必须与 core/site-key.ts 的
 * siteKey / sitePatterns 同一语义：0.9.1 时 harness 自己写的简版只保留 host[:port]，
 * #162 内核改 eTLD+1 后没人把它拉齐——真站多段域名的档案写进 `profile:weread.qq.com`，
 * 内容脚本按 `profile:qq.com` 找不到 → 按设计休眠，三站 E2E 全挂。现在 harness 经
 * tests/e2e/lib/site-key.mjs 直接复用内核实现，这里对一组真实主机名逐个比对锁死：
 * 以后任何一侧单方面改动，这条先红。
 */
// @ts-ignore -- .mjs 没有类型声明（项目未装 @types/node）
import { siteKey as bundleSiteKey, sitePatterns as bundleSitePatterns } from './e2e/lib/site-key.mjs';
// @ts-ignore -- .mjs 没有类型声明（项目未装 @types/node）
import { siteKeyOf, sitePatternsOf } from './e2e/lib/harness.mjs';
import { siteKey, sitePatterns } from '@/core/site-key';
import { describe, expect, it } from 'vitest';

/** 真站三站 + 本地夹具 + 边界形态（#192 点名清单，再补几个内核行为锚点） */
const CASES: Array<[string, string]> = [
  ['weread.qq.com', 'qq.com'],
  ['www.dedao.cn', 'dedao.cn'],
  ['note.mowen.cn', 'mowen.cn'],
  ['127.0.0.1:56114', '127.0.0.1:56114'],
  ['localhost', 'localhost'],
  ['[::1]', '[::1]'],
  ['weibo.cn', 'weibo.cn'],
  ['s.weibo.com', 'weibo.com'],
  ['https://weread.qq.com/', 'qq.com'],
  ['http://127.0.0.1:56114/', '127.0.0.1:56114'],
  ['com.cn', 'com.cn'],
  ['a.b.com.cn', 'b.com.cn'],
];

describe('harness 站点 key 与内核一致（#192）', () => {
  it('harness.siteKeyOf 与 core.siteKey 逐个相等', () => {
    for (const [input, expected] of CASES) {
      expect(siteKey(input), `core.siteKey(${input})`).toBe(expected);
      // E2E 实际调用的是 harness 这一层；转译产物与内核源码也直接比
      expect(siteKeyOf(input), `harness.siteKeyOf(${input})`).toBe(expected);
      expect(bundleSiteKey(input), `转译产物 siteKey(${input})`).toBe(expected);
    }
  });

  it('harness.sitePatternsOf 与 core.sitePatterns 同型：域名两条、带端口拆 http/https', () => {
    expect(sitePatterns('qq.com')).toEqual(['*://qq.com/*', '*://*.qq.com/*']);
    expect(sitePatternsOf('https://weread.qq.com/')).toEqual(sitePatterns('qq.com'));
    expect(bundleSitePatterns('qq.com')).toEqual(sitePatterns('qq.com'));
    expect(sitePatterns('127.0.0.1:56114')).toEqual(['http://127.0.0.1:56114/*', 'https://127.0.0.1:56114/*']);
    expect(sitePatternsOf('http://127.0.0.1:56114/')).toEqual(sitePatterns('127.0.0.1:56114'));
    expect(sitePatternsOf('http://localhost:3000/')).toEqual(sitePatterns('localhost:3000'));
  });
});
