/**
 * 三处界面的三个开关（#116）：同一份键、同一份文案、同一套写入口径。
 *
 * 项目没有组件测试框架，这里不逐字比对渲染结果，而是守住两类最容易漏的回归：
 * 1. 加减 / 改名一个开关时，弹窗、站点设置页、悬浮按钮菜单必须一起跟上——三处都从
 *    `MEDIA_FLAG_KEYS` 遍历，标签与说明都从 `t.media` 取，不许有一处手抄；
 * 2. 中英两套文案必须给齐每个开关的标签、逐行说明、组名与失败提示（键集合另有
 *    `core/i18n.test.ts` 守门，这里进一步查值不为空）。
 *
 * 源码用 Node 直接读（与 tests/font-size.test.ts 同做法）：vitest 不解析 .vue。
 */
// @ts-ignore -- node:fs 无类型声明（项目未装 @types/node）
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MESSAGES } from '@/core/i18n';
import { MEDIA_FLAG_KEYS, MEDIA_HINT_KEYS, mediaFlagPatch } from '@/core/media';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

const SURFACES = [
  ['弹窗', read('../ui/popup/PopupBody.vue')],
  ['悬浮按钮 ⋯ 菜单', read('../ui/FloatingToggle.vue')],
  ['站点设置页', read('../entrypoints/management/views/SiteSettingsView.vue')],
] as const;

const WRITERS = [
  ['弹窗入口', read('../entrypoints/popup/App.vue')],
  ['管理页 store', read('../entrypoints/management/store.ts')],
  ['页面运行时', read('../ui/content-runtime.ts')],
] as const;

describe('三个媒体开关的界面一致性（#116）', () => {
  it('开关清单只有一份，顺序固定为图片 / 视频 / 声音', () => {
    expect(MEDIA_FLAG_KEYS).toEqual(['hideImages', 'hideVideos', 'mutePage']);
    expect(Object.keys(MEDIA_HINT_KEYS)).toEqual([...MEDIA_FLAG_KEYS]);
  });

  it('三处界面都遍历同一份清单，标签不手抄', () => {
    for (const [name, src] of SURFACES) {
      expect(src, `${name} 应当用 MEDIA_FLAG_KEYS 渲染`).toMatch(/v-for="key in MEDIA_FLAG_KEYS"/);
      expect(src, `${name} 的标签应当从文案表取`).toContain('t.media[key]');
      for (const literal of ['收起图片', '收起视频', '静音网页']) {
        expect(src, `${name} 不该把「${literal}」硬写进界面文件`).not.toContain(literal);
      }
    }
  });

  it('三处界面都用读屏认得的开关角色；菜单不用孤立的 menuitemcheckbox', () => {
    for (const [name, src] of SURFACES) {
      expect(src, `${name} 应当有 role="switch"`).toContain('role="switch"');
    }
    const menu = SURFACES[1][1];
    expect(menu).toContain(':aria-checked=');
    expect(menu).toContain('role="group"');
    expect(menu).toContain('t.media.menuGroup');
    // 注释里提到这个角色名是允许的（正好用来解释为什么不用），只禁止真的把它写进元素
    expect(menu, '菜单不是 role=menu，不能用没有父菜单的 menuitemcheckbox').not.toMatch(
      /role=["']menuitemcheckbox["']/,
    );
    expect(menu).toContain("emit('mediaChange'");
    // #127：未选中也要有可见状态，不能只剩一个空占位（和菜单里的普通动作项分不清）
    expect(menu).toContain('pm-tg-tick');
    expect(menu).toContain('pm-tg-box');
  });

  it('三处都收成一组；组级说明与逐行说明有视觉分隔（#127 / #128）', () => {
    // 只查 role="group" 字符串没有校验力：三处还要各自给出可读的分组名
    const labels: Record<string, RegExp> = {
      弹窗: /role="group"\s+:aria-label="t\.media\.heading"/,
      '悬浮按钮 ⋯ 菜单': /role="group"\s+:aria-label="t\.media\.menuGroup"/,
      站点设置页: /role="group"\s+:aria-label="t\.media\.heading"/,
    };
    for (const [name, src] of SURFACES) {
      expect(src, `${name} 应当有带名字的 role="group"`).toMatch(labels[name]!);
    }
    expect(SURFACES[0][1], '弹窗的组级说明要有细分隔').toMatch(/\.media-hint\s*\{[^}]*border-top/s);
    expect(SURFACES[2][1], '设置页的卡片脚注要有细分隔').toMatch(/\.media-footnote\s*\{[^}]*border-top/s);
  });

  it('中英两套文案都有每个开关的标签、说明、组名与失败提示', () => {
    for (const lang of ['zh', 'en'] as const) {
      const m = MESSAGES[lang].media;
      for (const key of MEDIA_FLAG_KEYS) {
        expect(m[key], `${lang}.media.${key}`).toBeTruthy();
        expect(m[MEDIA_HINT_KEYS[key]], `${lang}.media.${MEDIA_HINT_KEYS[key]}`).toBeTruthy();
      }
      for (const key of ['heading', 'hint', 'hintShort', 'menuGroup', 'saveFailed'] as const) {
        expect(m[key], `${lang}.media.${key}`).toBeTruthy();
      }
    }
  });

  it('拨动只改一个字段：关掉时字段消失，不落 false', () => {
    expect(mediaFlagPatch('hideImages', true)).toEqual({ hideImages: true });
    expect(mediaFlagPatch('mutePage', false)).toEqual({ mutePage: undefined });
    expect(Object.keys(mediaFlagPatch('hideVideos', true))).toEqual(['hideVideos']);
  });

  it('三处写入都走同一个 patch，不各写一份字段口径', () => {
    for (const [name, src] of WRITERS) {
      expect(src, `${name} 应当用 mediaFlagPatch`).toContain('mediaFlagPatch');
    }
  });
});
