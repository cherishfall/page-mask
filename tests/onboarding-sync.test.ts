/**
 * 欢迎页同步守门（0.8.11，#139）。
 *
 * 装机反馈「介绍页和最新弹窗不同步」多次复发：示意图换真实组件（#103）解决了界面形态的
 * 同步，但**文案**仍然是手写的——0.8.0 加了图片和视频变灰，欢迎页的「三件事」一直没跟上。
 * 本测试守两类最容易漏的回归：
 * 1. 示意图必须是真实组件（PopupBody / FloatingToggle），不许退回手绘；
 * 2. 欢迎页文案（中英）必须覆盖当前功能集的界面名——**加新功能时**，把它的界面名来源
 *    加进 REQUIRED（下面标了加行位置），测试会逼着欢迎页文案一起更新。
 *
 * 源码用 Node 直接读（与 tests/media-ui.test.ts 同做法）：vitest 不解析 .vue。
 */
// @ts-ignore -- node:fs 无类型声明（项目未装 @types/node）
import { readFileSync } from 'node:fs';
// @ts-ignore -- .mjs 解析器没有类型声明（项目未装 @types/node）
import { loadSurfaces } from './e2e/lib/surfaces.mjs';
import { describe, expect, it } from 'vitest';
import { MESSAGES } from '@/core/i18n';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

const app = read('../entrypoints/onboarding/App.vue');
const popupBody = read('../ui/popup/PopupBody.vue');
const icon16 = read('../assets/icon/icon-16.svg');

describe('欢迎页与当前功能集同步（#139）', () => {
  it('示意图是真实组件，不退回手绘', () => {
    expect(app, '弹窗示意图应当渲染真实 PopupBody（#103）').toContain('<PopupBody');
    expect(app, '胶囊示意图应当渲染真实 FloatingToggle（#103）').toContain('<FloatingToggle');
    expect(app, '不许再出现已退场的 mini prop').not.toContain(':mini');
  });

  // #194：第 1 步图示原先把手画的「蓝底白字 P 方块」当成扩展图标、把菜单和工具栏挤进一条
  // 300×44 横条，与真实 Chrome（拼图 → 扩展菜单列表行 → 行尾图钉）不符，也违背 GLOSSARY
  // 「不用形状 / 字母指代功能」。现在改成工具栏 + 菜单列表行，并内联真实 16px 图标。
  // 静态守门（只加不删既有断言）：第 1 步不再有字母 P，且 leading icon 与真实图标同源内联。
  it('第 1 步图示与真实 Chrome 一致（#194）：不用字母 P、内联真实扩展图标', () => {
    const step1 = app.match(/v-if="step === 1"[\s\S]*?<\/svg>/)?.[0] ?? '';
    expect(step1, '第 1 步应有一张放大的 SVG（工具栏 + 菜单面板）').not.toBe('');
    // 不再用蓝底白字「P」自造符号指代扩展（GLOSSARY Avoid）：名字一律用灰条占位，
    // 整张 SVG 不出现 <text> 文字元素，自然不会有字母 P
    expect(step1, '第 1 步不再有字母 P 方块的 sk-on-text 样式').not.toContain('sk-on-text');
    expect(step1, '第 1 步图示不放文字元素（名字用灰条占位，不用字母自造符号）').not.toContain('<text');
    expect(step1, '第 1 步不再有 <text>P</text>').not.toMatch(/<text[^>]*>\s*P\s*<\/text>/);
    // 与 assets/icon/icon-16.svg 同源内联：倾斜眼罩的 transform 与眼罩 path 两处指纹，
    // 证明 leading icon 是真实图形（不是自造符号），且不依赖外部图片加载
    expect(step1, '内联的倾斜眼罩 transform 与 icon-16.svg 同源').toContain('rotate(-10 8 6)');
    const maskPath = icon16.match(/d="(M2\.6 5\.2[^"]*)"/)?.[1] ?? '';
    expect(maskPath, '能从 icon-16.svg 解析到眼罩 path 指纹').not.toBe('');
    expect(step1, '内联的眼罩 path 与 icon-16.svg 逐字同源（#194）').toContain(maskPath);
  });

  it('弹窗里有「查看使用说明」入口，指向 onboarding 页', () => {
    expect(popupBody).toContain('pm-popup-replay-intro');
    expect(popupBody).toContain('href="/onboarding.html"');
  });

  // 弹窗对照表的行序就是全产品权威的「序」（docs/design-surfaces.md §三）；
  // 欢迎页介绍的是弹窗四件事，不含「删除这个网站的设置」。要点用的界面名来源
  // 与下面覆盖检查一致（开关名而不是卡名：整页变灰取 media.mediaGray）
  const surfaces = loadSurfaces();
  const FEATURE_KEYS: Record<string, string> = {
    '标题和图标': 'popup.editTitle',
    '收起内容': 'popup.setupMore',
    '整页变灰': 'media.mediaGray',
    '遮住这一页': 'popup.coverPage',
  };
  const valueOf = (obj: unknown, key: string): unknown =>
    key.split('.').reduce<unknown>((cur, part) => (cur as Record<string, unknown>)?.[part], obj);

  for (const lang of ['zh', 'en'] as const) {
    it(`${lang}: 欢迎页文案覆盖当前功能集的界面名`, () => {
      const m = MESSAGES[lang];
      // 欢迎页分步文案拼成一段，逐个核对功能名（这些值来自各自的权威键，别手抄字面量）
      const onboardingText = JSON.stringify(m.onboarding.steps);
      // —— 当前功能集清单；顺序随对照表（下一行测试守序）——
      const required: Array<[string, string]> = Object.entries(FEATURE_KEYS).map(
        ([what, key]) => [what, valueOf(m, key) as string] as [string, string],
      );
      for (const [what, label] of required) {
        expect(onboardingText, `${lang} 欢迎页没有介绍「${what}」（${label}）——加新功能时欢迎页文案要跟上`).toContain(label);
      }
    });

    // #187：要点顺序随对照表——welcome-2 曾把「收起内容」排在「标题和图标」前面，
    // 与「序」（1=标题和图标，2=收起内容）和同屏内嵌的真实弹窗相反
    it(`${lang}: 欢迎页要点顺序与 design-surfaces 的「序」一致（#187）`, () => {
      const features = MESSAGES[lang].onboarding.steps[1]!.features;
      const rows = surfaces.popup as Array<{ item: string }>;
      const required = rows
        .filter((row) => FEATURE_KEYS[row.item])
        .map((row) => [row.item, valueOf(MESSAGES[lang], FEATURE_KEYS[row.item]!) as string] as const);
      expect(features.length, '欢迎页第 2 步的要点数量与对照表的弹窗行数一致').toBe(required.length);
      const joined = features.join('\n');
      let at = -1;
      for (const [item, label] of required) {
        const next = joined.indexOf(label);
        expect(next, `${lang} 欢迎页要点缺少「${item}」（${label}），或没有按对照表的序排列`).toBeGreaterThan(at);
        at = next;
      }
    });
  }
});
