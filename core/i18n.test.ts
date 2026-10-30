/**
 * 界面语言与文案表的测试（#57）。
 *
 * 最要紧的一条：中英两套文案的键集合必须完全一致——`Messages = typeof zh` 在编译期挡住了
 * 大部分漂移，但函数参数个数、数组长度这类差异编译器不一定报；这里再递归比较一遍结构，
 * 防止「英文漏了一句」上线。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MESSAGES, en, resolveLocale, zh, type Locale } from './i18n';

describe('resolveLocale 三档偏好 → 渲染语言', () => {
  it.each([
    ['zh', 'zh-CN', 'zh'], // 锁定中文：浏览器语言再是英文也用中文
    ['en', 'zh-CN', 'en'], // 锁定英文：浏览器语言再是中文也用英文
    ['auto', 'zh-CN', 'zh'], // 自动：简体中文浏览器 → 中文
    ['auto', 'zh', 'zh'],
    ['auto', 'zh_CN', 'zh'],
    ['auto', 'zh-Hans-CN', 'zh'],
    ['auto', 'en-US', 'en'],
    ['auto', 'en', 'en'],
    ['auto', 'fr', 'en'], // 需求口径：zh 开头以外的语言一律英文
    ['auto', 'zh-TW', 'en'], // 需求口径：繁体中文没有对应语言包，按英文
    ['auto', 'zh-HK', 'en'],
    ['auto', 'zh-Hant', 'en'],
    ['auto', '', 'en'], // 拿不到语言：按英文兜底
    ['auto', undefined, 'en'],
    [null, 'zh-CN', 'zh'], // 偏好缺失 = auto
    [undefined, 'en-US', 'en'],
  ] as const)('pref=%s browser=%s → %s', (pref, browser, want) => {
    expect(resolveLocale(pref as Parameters<typeof resolveLocale>[0], browser as string)).toBe(want as Locale);
  });

  it('auto 不传浏览器语言时读当前环境（chrome.i18n 优先）', () => {
    vi.stubGlobal('chrome', { i18n: { getUILanguage: () => 'fr' } });
    expect(resolveLocale('auto')).toBe('en');
    vi.unstubAllGlobals();
    vi.stubGlobal('chrome', { i18n: { getUILanguage: () => 'zh-CN' } });
    expect(resolveLocale('auto')).toBe('zh');
  });

  afterEach(() => vi.unstubAllGlobals());
});

describe('两套文案表结构完全一致（防漏翻）', () => {
  /** 递归取键集合：函数与基本类型都是叶子，不再往下看 */
  function shape(v: unknown, path = ''): Set<string> {
    const keys = new Set<string>([path]);
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
        for (const key of shape(child, path ? `${path}.${k}` : k)) keys.add(key);
      }
    }
    return keys;
  }

  it('zh 与 en 的键集合完全一致', () => {
    const zhKeys = shape(zh);
    const enKeys = shape(en);
    expect([...enKeys].filter((k) => !zhKeys.has(k))).toEqual([]);
    expect([...zhKeys].filter((k) => !enKeys.has(k))).toEqual([]);
  });

  it('函数文案的参数个数一致（拼图函数签名不同会 silently 出错）', () => {
    function arity(v: unknown, path = ''): Map<string, number> {
      const out = new Map<string, number>();
      if (typeof v === 'function') out.set(path, v.length);
      else if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
          for (const [p, n] of arity(child, path ? `${path}.${k}` : k)) out.set(p, n);
        }
      }
      return out;
    }
    expect(arity(en)).toEqual(arity(zh));
  });

  it('两套表都挂在 MESSAGES 上（t() 取的就是它）', () => {
    expect(MESSAGES.zh).toBe(zh);
    expect(MESSAGES.en).toBe(en);
  });

  it('英文表里没有残留中文（键名一致之外，值也必须真是英文）', () => {
    const walk = (v: unknown, path = ''): void => {
      if (typeof v === 'string') {
        if (path.endsWith('languageNameZh') || path.endsWith('languageZh')) return; // 语言名各用本语言书写，不翻译
        expect(v, path).not.toMatch(/[\u4e00-\u9fff]/);
      } else if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        for (const [k, child] of Object.entries(v as Record<string, unknown>)) walk(child, path ? `${path}.${k}` : k);
      }
    };
    walk(en);
  });
});
