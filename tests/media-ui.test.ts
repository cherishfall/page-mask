/**
 * 三处界面的媒体开关（0.8.0，#131）：同一份键、同一份文案、同一套写入口径。
 *
 * 项目没有组件测试框架，这里不逐字比对渲染结果，而是守住两类最容易漏的回归：
 * 1. 键清单只有一份（mediaGray），三处界面都从 `t.media` 取标签，不许有一处手抄；
 * 2. 中英两套文案必须给齐标签、说明、胶囊媒体钮的悬停名与失败提示（键集合另有
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
  ['悬浮按钮', read('../ui/FloatingToggle.vue')],
  ['站点设置页', read('../entrypoints/management/views/SiteSettingsView.vue')],
] as const;

const WRITERS = [
  ['弹窗入口', read('../entrypoints/popup/App.vue')],
  ['管理页 store', read('../entrypoints/management/store.ts')],
  ['页面运行时', read('../ui/content-runtime.ts')],
] as const;

describe('媒体开关的界面一致性（0.8.0，#131）', () => {
  it('键清单只有一份，就一个 mediaGray', () => {
    expect(MEDIA_FLAG_KEYS).toEqual(['mediaGray']);
    expect(Object.keys(MEDIA_HINT_KEYS)).toEqual([...MEDIA_FLAG_KEYS]);
  });

  it('三处界面都从文案表取标签，不手抄', () => {
    for (const [name, src] of SURFACES) {
      expect(src, `${name} 的标签应当从文案表取`).toMatch(/t\.media(\.mediaGray|\.mediaTitle|\[key\])/);
    }
  });

  it('弹窗与站点设置页是读屏认得的开关；悬浮按钮是带状态的媒体钮，不用孤立的 menuitemcheckbox', () => {
    for (const [name, src] of [
      ['弹窗', SURFACES[0][1]],
      ['站点设置页', SURFACES[2][1]],
    ] as const) {
      expect(src, `${name} 应当有 role="switch"`).toContain('role="switch"');
    }
    const toggle = SURFACES[1][1];
    expect(toggle, '媒体钮的按下状态要给读屏').toContain(':aria-pressed=');
    expect(toggle, '媒体钮要有实心 / 描边两态的可视图标').toContain('pm-tg-media-icon');
    expect(toggle).toContain("emit('mediaChange'");
    // 胶囊菜单刻意不是 role=menu（方向键导航契约没实现）：不许孤立使用 menuitemcheckbox
    expect(toggle, '不能出现没有父菜单的 menuitemcheckbox').not.toMatch(/role=["']menuitemcheckbox["']/);
  });

  it('弹窗与站点设置页的开关收成带名字的组；设置页组级注脚改成行内 ⓘ（#174）', () => {
    for (const [name, src] of [
      ['弹窗', SURFACES[0][1]],
      ['站点设置页', SURFACES[2][1]],
    ] as const) {
      expect(src, `${name} 应当有带名字的 role="group"`).toMatch(/role="group"\s+:aria-label="t\.media\.heading"/);
    }
    // 弹窗只有一行开关：说明直接跟着那一行，不再要组级分隔线（0.8.0，#132 新眼睛审查）
    expect(SURFACES[0][1], '弹窗的媒体说明不该再带组级分隔线').not.toMatch(/\.media-hint\s*\{[^}]*border-top/s);
    // 站点设置页：0.8.18 后卡里只有一个开关，「组级注脚」定位已失——两段常驻说明叠加违反
    // design-copy「先删零风险重复」（#174）。注脚退场，media.hint 改走行内 ⓘ（与弹窗同构）
    expect(SURFACES[2][1], '设置页的 media.hint 应当作为 ⓘ 的 text prop').toContain(':text="t.media.hint"');
    expect(SURFACES[2][1], '设置页不该再渲染 media-footnote 注脚').not.toContain('media-footnote');
  });

  it('中英两套文案都有标签、说明、媒体钮悬停名与失败提示', () => {
    for (const lang of ['zh', 'en'] as const) {
      const m = MESSAGES[lang].media;
      for (const key of MEDIA_FLAG_KEYS) {
        expect(m[key], `${lang}.media.${key}`).toBeTruthy();
        expect(m[MEDIA_HINT_KEYS[key]], `${lang}.media.${MEDIA_HINT_KEYS[key]}`).toBeTruthy();
      }
      for (const key of ['heading', 'hint', 'hintShort', 'mediaTitle', 'saveFailed'] as const) {
        expect(m[key], `${lang}.media.${key}`).toBeTruthy();
      }
    }
  });

  it('拨动只改一个字段：关掉时字段消失，不落 false', () => {
    expect(mediaFlagPatch('mediaGray', true)).toEqual({ mediaGray: true });
    expect(mediaFlagPatch('mediaGray', false)).toEqual({ mediaGray: undefined });
    expect(Object.keys(mediaFlagPatch('mediaGray', true))).toEqual(['mediaGray']);
  });

  it('三处写入都走同一个 patch，不各写一份字段口径', () => {
    for (const [name, src] of WRITERS) {
      expect(src, `${name} 应当用 mediaFlagPatch`).toContain('mediaFlagPatch');
    }
  });
});
