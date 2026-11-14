/**
 * 常驻 hint 标点守门（#184；docs/design-copy.md 二、d 的自动化）。
 *
 * 规矩（design-copy 二、d，0.9.1 #174 立的）：常驻 hint / intro / 行说明结尾**不带句号**，
 * 分句之间用分号。句号保留给完整句的场合——对话框正文、错误消息（role=alert）、ⓘ 浮层内容、
 * 撤销条、导入结果。本测试把这条规矩自动化：中英两份文案表（core/i18n/messages.{zh,en}.ts）全扫。
 *
 * 扫描范围：键名（路径最后一段）含 hint / intro / footnote / note / lead 的键，不区分大小写；
 * 函数键（模板串）用哑参求值后照扫，数组键逐元素扫。zh、en 各扫一遍。
 *
 * 豁免清单（键名命中上面模式、但按 design-copy 二、d 允许句号；改键名或改呈现形态时同步这里）：
 * - settings.titleIntro：插件设置页「默认标题」卡的 ⓘ 浮层正文
 *   （entrypoints/settings/App.vue `<InfoTip :text="t.settings.titleIntro">`）——ⓘ 浮层内容允许成句。
 * - settings.toggleHint：悬浮按钮卡的 ⓘ 浮层正文，同上。
 * - settings.transferIntro：导出 / 导入卡的 ⓘ 浮层正文，同上。
 *
 * 登记性说明（不占豁免清单，改文案时要知道）：
 * - popup.mediaTooltip / popup.showToggleTooltip 也是 ⓘ 浮层正文（允许句号）——键名不含上面
 *   五个词，天然不命中扫描。
 * - media.hint 在站点设置页是 ⓘ 浮层正文（design-copy 三「必须留下」清单成员），当前值恰好
 *   不带句号所以照扫；将来若改成成句写法，把它挪进豁免清单并注明。
 * - 对话框正文（wizard.exitBody*、settings.replaceDialog.*、management.deleteSite.impact、
 *   common.resetSiteContentImpact）、onboarding 步骤与功能列表、各错误消息都允许句号，
 *   键名都不含上面五个词，天然不命中。
 */
import { describe, expect, it } from 'vitest';
import { MESSAGES } from '@/core/i18n';

const PATTERN = /(hint|intro|footnote|note|lead)/i;

/** 键名命中模式但允许句号的键（完整路径，理由见文件头豁免清单） */
const EXEMPT = ['settings.titleIntro', 'settings.toggleHint', 'settings.transferIntro'];

/** 哑参：函数键求值用。占位词本身不带句号，不会污染扫描结果 */
const DUMMY = '示例';

type Found = { path: string; text: string };

function collect(value: unknown, path: string, out: Found[]): void {
  if (typeof value === 'string') {
    const key = path.replace(/\[\d+\]/g, '').split('.').pop() ?? '';
    if (PATTERN.test(key)) out.push({ path, text: value });
    return;
  }
  if (typeof value === 'function') {
    const fn = value as (...args: unknown[]) => unknown;
    collect(fn(...Array.from({ length: fn.length }, () => DUMMY)), path, out);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collect(item, `${path}[${index}]`, out));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) collect(child, path ? `${path}.${key}` : key, out);
  }
}

function collectAll(lang: 'zh' | 'en'): Found[] {
  const out: Found[] = [];
  collect(MESSAGES[lang], '', out);
  return out;
}

describe('常驻 hint 标点守门（design-copy 二、d 的自动化，#184）', () => {
  for (const lang of ['zh', 'en'] as const) {
    it(`${lang}：hint/intro/footnote/note/lead 类键的值不含句号（。或 .）`, () => {
      const found = collectAll(lang).filter(({ path }) => !EXEMPT.includes(path));
      // 扫描器本身要活着：两份表各能扫到几十条，collect 静默失效（比如键名规则写错）时这里先红
      expect(found.length, '扫到的 hint 类键数量异常，先查扫描器再查文案').toBeGreaterThan(30);
      for (const { path, text } of found) {
        expect(text, `${lang}.${path}：常驻 hint 不带句号，分句用分号（ⓘ / 对话框豁免见本文件头）`).not.toMatch(
          /[.。]/,
        );
      }
    });
  }

  it('豁免清单里的键在两份表中都真实存在（键改名时这里红，提醒同步豁免清单）', () => {
    for (const lang of ['zh', 'en'] as const) {
      const paths = new Set(collectAll(lang).map(({ path }) => path));
      for (const path of EXEMPT) {
        expect(paths.has(path), `豁免键 ${lang}.${path} 不在扫描结果里：键被改名或移出文案表了，请同步豁免清单`).toBe(
          true,
        );
      }
    }
  });

  // 反向登记（2026-11-14 #200 目检发现）：键名不含上面五个词、因此扫描天然漏掉、
  // 但呈现形态同为「常驻说明」的键——规矩相同：结尾不带句号，分句用分号。
  // - popup.mediaNotReady：弹窗 role=status 常驻说明（ui/popup/PopupBody.vue）
  // - onboarding.sub / onboarding.tip：欢迎页常驻说明（entrypoints/onboarding）
  // - wizard.staleWhy：看效果清单的失效行说明（ui/wizard/WizardApp.vue）
  // 这些键改成 ⓘ / 对话框等允许句号的形态时，从这里移回并注明理由。
  const NO_PERIOD = ['popup.mediaNotReady', 'onboarding.sub', 'onboarding.tip', 'wizard.staleWhy'];

  function textAt(lang: 'zh' | 'en', path: string): string {
    let value: unknown = MESSAGES[lang];
    for (const seg of path.split('.')) {
      if (value && typeof value === 'object') value = (value as Record<string, unknown>)[seg];
      else return '';
    }
    if (typeof value === 'function') {
      const fn = value as (...args: unknown[]) => unknown;
      value = fn(...Array.from({ length: fn.length }, () => DUMMY));
    }
    return typeof value === 'string' ? value : '';
  }

  for (const lang of ['zh', 'en'] as const) {
    it(`${lang}：反向登记的常驻说明键同样不带句号（#200 补扫描盲区）`, () => {
      for (const path of NO_PERIOD) {
        const text = textAt(lang, path);
        expect(text, `反向登记键 ${lang}.${path} 取不到值：键被改名或移出文案表了，请同步 NO_PERIOD 清单`).not.toBe('');
        expect(text, `${lang}.${path}：常驻说明不带句号，分句用分号`).not.toMatch(/[.。]$/);
      }
    });
  }
});

/** 全表拍平：路径 → 求值后的文本（函数键用哑参求值，数组带下标）。拍平两份表按路径配对 */
function flattenAll(lang: 'zh' | 'en'): Map<string, string> {
  const out = new Map<string, string>();
  function walk(value: unknown, path: string): void {
    if (typeof value === 'string') {
      out.set(path, value);
      return;
    }
    if (typeof value === 'function') {
      const fn = value as (...args: unknown[]) => unknown;
      walk(fn(...Array.from({ length: fn.length }, () => DUMMY)), path);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) walk(child, path ? `${path}.${key}` : key);
    }
  }
  walk(MESSAGES[lang], '');
  return out;
}

/** 是不是以句号收尾（中英同口径：全角句号与半角句点） */
const endsWithPeriod = (text: string): boolean => /[.。]$/.test(text);

describe('错误 / 警告消息的句尾规矩（#204）', () => {
  // design-copy 二、d 把句号「保留给」错误消息等完整句场合；产品通行的写法是
  // 「多句消息内部句号照用、句尾一律不带」（GOV.UK 错误消息同款：单句不带句尾句点）。
  // 键路径含 error / failed / warn 的键按这个口径守门（#204 之前只有两个离群键）
  const FAMILY = /(^|\.)(error|failed|warn)/i;

  for (const lang of ['zh', 'en'] as const) {
    it(`${lang}：错误 / 警告消息句尾不带句号（多句的内部句号不算）`, () => {
      for (const [path, text] of flattenAll(lang)) {
        if (!FAMILY.test(path)) continue;
        expect(text, `${lang}.${path} 是错误 / 警告消息，句尾不带句号（分句用句号或分号）`).not.toMatch(/[.。]$/);
      }
    });
  }
});

describe('中英同键句尾对称（#204）', () => {
  it('每个键两语言「是否以句号收尾」一致', () => {
    const zhAll = flattenAll('zh');
    const enAll = flattenAll('en');
    expect([...zhAll.keys()].sort()).toEqual([...enAll.keys()].sort());
    for (const [path, zhText] of zhAll) {
      const enText = enAll.get(path)!;
      expect(
        endsWithPeriod(enText),
        `${path} 句尾句号不一致：zh=${JSON.stringify(zhText)} en=${JSON.stringify(enText)}`,
      ).toBe(endsWithPeriod(zhText));
    }
  });
});
