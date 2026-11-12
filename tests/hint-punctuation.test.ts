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
});
