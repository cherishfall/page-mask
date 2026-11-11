/**
 * 三处界面的唯一对照表守门（#157）。
 *
 * 这张票要解决的不是「再加一份人工清单」，而是让「改一处漏两处」在提交前就红。做法：
 *
 * 1. 权威只有一处 —— `docs/design-surfaces.md`；另外三方（模板源码、i18n 文案、E2E）都从它派生。
 * 2. 源码按 **顺序** 守：每个界面的控件在模板里的首次出现位置必须依次递增，顺序与表一致。
 *    不是「源码里出现过某字符串」这种弱断言——交换两块、挪走一项都会让下标不递增。
 * 3. 叫法按 **解析值** 守：表里每一行的文案键，解析成中英文后必须与表里的界面用词逐字相等；
 *    模板里不许出现这些字面值，必须走文案键。
 * 4. E2E 按 **同一张表** 守：三条 E2E 必须 import 解析器，且不许再各写一份整串中文顺序。
 */
// @ts-ignore -- .mjs 解析器没有类型声明（项目未装 @types/node）
import { loadSurfaces } from './e2e/lib/surfaces.mjs';
// @ts-ignore -- node:fs 无类型声明（项目未装 @types/node）
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MESSAGES } from '@/core/i18n';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8') as string;

type SurfaceName = 'popup' | 'capsuleBody' | 'capsuleMenu' | 'siteSettings';

/** 每个界面对应的模板文件；模板块会先去掉 HTML 注释，避免注释里的词干扰顺序 / 写死检查 */
const SURFACE_SOURCES: Record<SurfaceName, { file: string; surface: string }> = {
  popup: { file: '../ui/popup/PopupBody.vue', surface: '插件弹窗' },
  capsuleBody: { file: '../ui/FloatingToggle.vue', surface: '悬浮胶囊 · 本体' },
  capsuleMenu: { file: '../ui/FloatingToggle.vue', surface: '悬浮胶囊 · ⋯ 菜单' },
  siteSettings: { file: '../entrypoints/management/views/SiteSettingsView.vue', surface: '站点设置页' },
};

const templateOf = (file: string) => {
  const src = read(file);
  const tpl = /<template>([\s\S]*)<\/template>\s*<script/.exec(src)?.[1] ?? '';
  return tpl.replace(/<!--[\s\S]*?-->/g, '');
};

/** 按点号取 i18n 值（只用于字符串键；函数键不在这张表里） */
const valueOf = (obj: unknown, key: string): unknown =>
  key.split('.').reduce<unknown>((cur, part) => (cur as Record<string, unknown>)?.[part], obj);

const surfaces = loadSurfaces();

describe('三处界面对照表（docs/design-surfaces.md）', () => {
  it('四个界面都有条目，序都落在规范顺序里，且同一界面的控件不重复', () => {
    const canonicalSeqs = new Set(surfaces.canonical.map((row: { seq: number }) => row.seq));
    for (const name of Object.keys(SURFACE_SOURCES) as SurfaceName[]) {
      const rows = surfaces[name] as Array<{ seq: number; item: string; control: string }>;
      expect(rows.length, `${name} 至少有一行`).toBeGreaterThan(0);
      for (const row of rows) {
        expect(canonicalSeqs.has(row.seq), `${name} 的「${row.item}」序 ${row.seq} 不在规范顺序里`).toBe(true);
        const canonical = surfaces.canonical.find((c: { seq: number }) => c.seq === row.seq);
        expect(canonical.item, `${name} 的序 ${row.seq} 功能项叫法应与规范顺序一致`).toBe(row.item);
      }
      const controls = rows.map((row) => row.control);
      expect(new Set(controls).size, `${name} 的控件锚点不应重复`).toBe(controls.length);
    }
  });

  it('每个界面的模板顺序与对照表一致（首次出现位置严格递增）', () => {
    for (const name of Object.keys(SURFACE_SOURCES) as SurfaceName[]) {
      const { file, surface } = SURFACE_SOURCES[name];
      const tpl = templateOf(file);
      const rows = surfaces[name] as Array<{ control: string; item: string }>;
      let last = -1;
      for (const row of rows) {
        const at = tpl.indexOf(row.control);
        expect(at, `${surface} 的「${row.item}」控件 ${row.control} 不在模板里`).toBeGreaterThanOrEqual(0);
        expect(at, `${surface} 的「${row.item}」排在上一项之前（顺序与对照表不符）`).toBeGreaterThan(last);
        last = at;
      }
    }
  });

  it('每一行的界面用词等于文案键解析出的中英文（叫法分叉当场报红）', () => {
    for (const name of Object.keys(SURFACE_SOURCES) as SurfaceName[]) {
      const rows = surfaces[name] as Array<{ item: string; labelZh: string; labelEn: string; key: string }>;
      for (const row of rows) {
        if (row.key === '—') continue; // 胶囊主按钮没有固定文字名（读屏名随状态变）
        expect(valueOf(MESSAGES.zh, row.key), `zh.${row.key} 与对照表「${row.item}」不一致`).toBe(row.labelZh);
        expect(valueOf(MESSAGES.en, row.key), `en.${row.key} 与对照表「${row.item}」不一致`).toBe(row.labelEn);
      }
    }
  });

  it('模板里不写死这些界面用词——必须走文案键', () => {
    const labels = new Set<string>();
    for (const name of Object.keys(SURFACE_SOURCES) as SurfaceName[]) {
      for (const row of surfaces[name] as Array<{ labelZh: string }>) {
        if (row.labelZh !== '—') labels.add(row.labelZh);
      }
    }
    for (const [name, { file, surface }] of Object.entries(SURFACE_SOURCES) as Array<
      [SurfaceName, { file: string; surface: string }]
    >) {
      const tpl = templateOf(file);
      for (const label of labels) {
        // 同一个词可能属于别的界面（“收起内容”在弹窗与菜单都出现），这里只拦「该界面自己的那一行」
        const own = (surfaces[name] as Array<{ labelZh: string }>).some((row) => row.labelZh === label);
        if (!own) continue;
        expect(tpl.includes(label), `${surface} 模板里写死了「${label}」，应取文案键`).toBe(false);
      }
    }
  });

  it('同一件事的文案键必须同值（中英各查一遍）', () => {
    // 整页变灰：卡片 / 分组名与开关名、胶囊悬停名，中文必须同一个词
    expect(MESSAGES.zh.media.heading).toBe(MESSAGES.zh.media.mediaGray);
    expect(MESSAGES.zh.media.heading).toBe(MESSAGES.zh.media.mediaTitle);
    // 英文里卡片名用名词短语、开关用动作短语（对照表已登记角色区分），但开关与胶囊悬停名必须一致
    expect(MESSAGES.en.media.mediaGray).toBe(MESSAGES.en.media.mediaTitle);
    expect(MESSAGES.en.media.heading.length).toBeGreaterThan(0);
    expect(MESSAGES.en.media.mediaGray.length).toBeGreaterThan(0);

    // 标题和图标：弹窗入口、胶囊菜单项、向导标题同一叫法
    expect(MESSAGES.zh.popup.editTitle).toBe(MESSAGES.zh.toggle.menuTitle);
    expect(MESSAGES.en.popup.editTitle).toBe(MESSAGES.en.toggle.menuTitle);
    // 收起内容：弹窗按钮与胶囊菜单项同一叫法
    expect(MESSAGES.zh.popup.setupMore).toBe(MESSAGES.zh.toggle.menuContent);
    expect(MESSAGES.en.popup.setupMore).toBe(MESSAGES.en.toggle.menuContent);
    // 删除这个网站的设置：弹窗 / 菜单 / 设置页同一叫法
    expect(MESSAGES.zh.management.deleteSite.heading).toBe(MESSAGES.zh.toggle.menuDelete);
    expect(MESSAGES.en.management.deleteSite.heading).toBe(MESSAGES.en.toggle.menuDelete);
  });

  it('例外① 有结构保证：灰度在胶囊本体，菜单里没有这一项', () => {
    const body = surfaces.capsuleBody as Array<{ item: string }>;
    const menu = surfaces.capsuleMenu as Array<{ item: string }>;
    expect(body.some((row) => row.item === '整页变灰'), '胶囊本体应有整页变灰').toBe(true);
    expect(menu.some((row) => row.item === '整页变灰'), '胶囊菜单不应重复整页变灰（例外①）').toBe(false);
  });

  it('三条 E2E 从同一张表派生，不再各写一份整串中文顺序', () => {
    const e2e = ['check-toggle.mjs', 'check-pages.mjs', 'check-media.mjs'].map((name) => [
      name,
      read(`./e2e/${name}`),
    ] as const);
    for (const [name, src] of e2e) {
      expect(src, `${name} 应从 tests/e2e/lib/surfaces.mjs 取期望值`).toContain("from './lib/surfaces.mjs'");
    }
    const forbidden = [
      '标题和图标 / 收起内容 / 调整不透明度 / 删除这个网站的设置',
      '标题和图标 | 收起内容 | --- | 调整不透明度 | --- | 删除这个网站的设置',
      '标签页标题 / 标签页图标 /',
      '图片和视频',
    ];
    for (const [name, src] of e2e) {
      for (const literal of forbidden) {
        expect(src.includes(literal), `${name} 仍写死了「${literal}」，应改成从对照表派生`).toBe(false);
      }
    }
  });
});
