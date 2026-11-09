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
import { describe, expect, it } from 'vitest';
import { MESSAGES } from '@/core/i18n';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

const app = read('../entrypoints/onboarding/App.vue');
const popupBody = read('../ui/popup/PopupBody.vue');

describe('欢迎页与当前功能集同步（#139）', () => {
  it('示意图是真实组件，不退回手绘', () => {
    expect(app, '弹窗示意图应当渲染真实 PopupBody（#103）').toContain('<PopupBody');
    expect(app, '胶囊示意图应当渲染真实 FloatingToggle（#103）').toContain('<FloatingToggle');
    expect(app, '不许再出现已退场的 mini prop').not.toContain(':mini');
  });

  it('弹窗里有「查看使用说明」入口，指向 onboarding 页', () => {
    expect(popupBody).toContain('pm-popup-replay-intro');
    expect(popupBody).toContain('href="/onboarding.html"');
  });

  for (const lang of ['zh', 'en'] as const) {
    it(`${lang}: 欢迎页文案覆盖当前功能集的界面名`, () => {
      const m = MESSAGES[lang];
      // 欢迎页分步文案拼成一段，逐个核对功能名（这些值来自各自的权威键，别手抄字面量）
      const onboardingText = JSON.stringify(m.onboarding.steps);
      // —— 当前功能集清单；加新功能时在这里加一行 ——
      const required: Array<[string, string]> = [
        ['收起内容', m.popup.setupMore],
        ['标题和图标', m.popup.editTitle],
        ['图片和视频变灰', m.media.mediaGray],
        ['遮住这一页', m.popup.coverPage],
      ];
      for (const [what, label] of required) {
        expect(onboardingText, `${lang} 欢迎页没有介绍「${what}」（${label}）——加新功能时欢迎页文案要跟上`).toContain(label);
      }
    });
  }
});
