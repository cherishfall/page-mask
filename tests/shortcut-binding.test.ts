/**
 * 快捷键绑定守门（0.9.3）。
 *
 * 0.9.2 装机反馈的根因是默认键撞 Chrome 保留表 → 命令静默没绑上 → 界面没有键帽；
 * 用户接着问「换了键，显示的键会变吗」。这类回归跨三个入口、两个时机，只靠目检容易漏一处：
 *
 * 1. manifest 的建议键不许回到被保留的 G（幕布的 X 不动）；
 * 2. 弹窗 / 插件设置 / 欢迎页都从 commands.getAll() 读两条命令，且统一走 formatShortcut；
 * 3. 长驻页面（设置页 / 欢迎页）在标签页重新可见时重读，并在卸载时移除监听；
 *    弹窗每次打开都是新文档，不该挂长驻监听；
 * 4. 改键入口在两行之后、整张卡共用；没绑上时不伪造键帽，未绑定提示说清可能被系统占用。
 *
 * 源码用 Node 直接读（与 tests/onboarding-sync.test.ts 同做法）：vitest 不解析 .vue。
 */
// @ts-ignore -- node:fs 无类型声明（项目未装 @types/node）
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MESSAGES } from '@/core/i18n';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8') as string;

const config = read('../wxt.config.ts');
const popup = read('../entrypoints/popup/App.vue');
const settings = read('../entrypoints/settings/App.vue');
const onboarding = read('../entrypoints/onboarding/App.vue');
const popupBody = read('../ui/popup/PopupBody.vue');

const SURFACES = [
  ['弹窗', popup],
  ['插件设置', settings],
  ['欢迎页', onboarding],
] as const;

describe('快捷键绑定：默认键、真实绑定与改键后的重读（0.9.3）', () => {
  it('建议键避开 Chrome 保留的 G，幕布仍是 X', () => {
    // 注释里会提到被换掉的 G 作为理由，只盯 suggested_key 的实际取值
    const keys = [...config.matchAll(/suggested_key:\s*\{[^}]*\}/g)].map((m) => m[0]);
    expect(keys, '两条命令都要有建议键').toHaveLength(2);
    expect(keys.join('\n'), '变灰的默认键不许回到被 Chrome 保留的 G').not.toContain('Shift+G');
    expect(config).toMatch(/'toggle-media-gray':[\s\S]{0,220}suggested_key:\s*\{\s*default:\s*'Ctrl\+Shift\+Y',\s*mac:\s*'Command\+Shift\+Y'\s*\}/);
    expect(config).toMatch(/'toggle-curtain':[\s\S]{0,220}suggested_key:\s*\{\s*default:\s*'Ctrl\+Shift\+X',\s*mac:\s*'Command\+Shift\+X'\s*\}/);
  });

  it('三处界面都读当前实际绑定的两条命令，且只经 formatShortcut 一个出口', () => {
    for (const [name, src] of SURFACES) {
      expect(src, `${name} 没有读 commands.getAll()`).toContain('browser.commands.getAll()');
      expect(src, `${name} 没有读幕布命令`).toContain("'toggle-curtain'");
      expect(src, `${name} 没有读变灰命令`).toContain("'toggle-media-gray'");
      expect(src, `${name} 没有走 formatShortcut 统一出口`).toContain('formatShortcut(');
      expect(src, `${name} 没有按平台区分键帽`).toContain('isMacPlatform()');
    }
  });

  it('设置页与欢迎页在标签页重新可见时重读，卸载时移除监听', () => {
    for (const [name, src] of [
      ['插件设置', settings],
      ['欢迎页', onboarding],
    ] as const) {
      expect(src, `${name} 少了 visibilitychange 重读`).toContain(
        "document.addEventListener('visibilitychange', onShortcutSurfaceVisible)",
      );
      expect(src, `${name} 卸载时没移除 visibilitychange 监听`).toContain(
        "document.removeEventListener('visibilitychange', onShortcutSurfaceVisible)",
      );
      expect(src, `${name} 重读没判断可见状态`).toContain("document.visibilityState === 'visible'");
    }
    // 切到别的窗口再回来这条路径仍由 focus 覆盖，两个时机都要留着
    expect(settings).toContain("window.addEventListener('focus', refreshShortcut)");
    expect(settings).toContain("window.removeEventListener('focus', refreshShortcut)");
  });

  it('弹窗每次打开都是新文档，不挂长驻监听', () => {
    expect(popup, '弹窗打开时读一次就够，不该留 visibilitychange 监听').not.toContain('visibilitychange');
  });

  it('改键入口在两条命令行之后、整张卡共用', () => {
    const grayRow = settings.indexOf('pm-settings-shortcut-gray-value');
    const change = settings.indexOf('pm-settings-shortcut-change');
    expect(grayRow, '设置页没有变灰命令那一行').toBeGreaterThanOrEqual(0);
    expect(change, '设置页没有改键按钮').toBeGreaterThanOrEqual(0);
    expect(change, '改键按钮又挂在第一行了：任一行没绑上时都该看得见下一步').toBeGreaterThan(grayRow);
  });

  it('没绑上时不显示假键，提示说清可能被系统占用', () => {
    expect(popupBody, '弹窗变灰键帽应只在真的绑上时出现').toContain('v-if="grayShortcut"');
    expect(popupBody, '弹窗遮住键帽应只在真的绑上时出现').toContain('v-if="coverShortcut"');
    expect(settings, '设置页变灰键帽应只在真的绑上时出现').toContain('v-if="grayShortcut"');
    expect(settings, '设置页没绑上时要给警告').toContain('pm-settings-shortcut-gray-unbound');
    expect(MESSAGES.zh.settings.shortcutUnbound, '中文没绑上提示没提系统').toContain('系统');
    expect(MESSAGES.en.settings.shortcutUnbound, '英文没绑上提示没提 system').toContain('system');
  });
});
