// @vitest-environment node
/**
 * #195 删除确认框「同一个东西全项目只有一个样子」：三处外壳的盒模型与
 * padding / border-color / radius 由同一份 tokens 派生（静态源码守门，挡回归）。
 *
 * 三处删除确认框（文案同一份 core/site-delete.ts）：
 *   - 弹窗 dialog.popup-delete-dialog：继承 styles/base.css 全局 dialog，只覆盖 inline-size
 *   - 管理页 DeleteSiteDialog.vue / settings 的裸 dialog：直接吃全局 dialog，无本地覆盖
 *   - 页内 .pm-tg-dialog（shadow root）：拿不到扩展页的全局 dialog 规则，必须自己再声明一份
 * 前两处与第三处因 shadow 边界分成两条规则，但 padding / border-color / radius / box-sizing
 * 都取同一份 --pm-* token；本文件守着这两条规则不分叉，并钉住弹窗覆盖只改宽度。
 *
 * 与 tests/popup-baseline.test.ts 同一做法：vitest 不解析 CSS，Node 直接读源码、先去块注释，
 * 免得注释里的旧值（20px / --pm-border）被当成违规。
 */
// @ts-ignore -- node:fs 无类型声明（项目未装 @types/node）
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8') as string;
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');

const baseCss = code(read('../styles/base.css'));
const tokensCss = code(read('../styles/tokens.css'));
const popupStyle = code(read('../entrypoints/popup/App.vue').split('<style>')[1] ?? '');
const toggleCss = code(read('../ui/toggle/toggle.css'));

/** 取某个选择器规则块的大括号内容（按行首锚定，避免 dialog::backdrop / dialog h2 等命中） */
function ruleBody(css: string, selectorPattern: string): string | null {
  const re = new RegExp(`^[ \\t]*${selectorPattern}[ \\t]*\\{([^}]*)\\}`, 'm');
  return re.exec(css)?.[1] ?? null;
}

/** 取规则块内某个属性的值（归一化空白），取不到返回 null */
function prop(body: string | null, name: string): string | null {
  if (body == null) return null;
  const re = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`, 'm');
  const value = re.exec(body)?.[1];
  return value ? value.replace(/\s+/g, ' ').trim() : null;
}

const baseDialog = ruleBody(baseCss, 'dialog');
const toggleDialog = ruleBody(toggleCss, '\\.pm-tg-dialog');
const popupDialog = ruleBody(popupStyle, 'dialog\\.popup-delete-dialog');

describe('#195 全局 dialog：border-box + 控件色边框 + 卡片内边距', () => {
  it('全局 dialog 补了 box-sizing，padding/border/radius 取与页内一致的 token', () => {
    expect(baseDialog, 'styles/base.css 里应有裸 dialog 规则').not.toBeNull();
    expect(prop(baseDialog, 'box-sizing')).toBe('border-box');
    expect(prop(baseDialog, 'padding')).toBe('var(--pm-space-4)');
    expect(prop(baseDialog, 'border')).toBe('1px solid var(--pm-border-control)');
    expect(prop(baseDialog, 'border-radius')).toBe('var(--pm-radius-card)');
    expect(prop(baseDialog, 'width')).toBe('min(420px, calc(100vw - 32px))');
  });

  it('dialog 规则不再用旧的 content-box 口径：无 20px padding、无装饰线 --pm-border', () => {
    expect(baseDialog).not.toMatch(/padding:\s*20px/);
    // 精确匹配旧 token（右括号紧跟），不误伤 --pm-border-control；只查 dialog 规则，
    // 因为 base.css 其它规则里的装饰性分隔线仍合法使用 --pm-border
    expect(baseDialog).not.toMatch(/var\(--pm-border\)/);
    // 三个 token 都只在 styles/tokens.css 定义一次（外壳值由这一份来源派生）
    expect(tokensCss).toContain('--pm-space-4:');
    expect(tokensCss).toContain('--pm-border-control:');
    expect(tokensCss).toContain('--pm-radius-card:');
  });
});

describe('#195 三处外壳同源：padding / border-color / radius / 盒模型不分叉', () => {
  it('页内 .pm-tg-dialog 与全局 dialog 取同一组 token 值', () => {
    expect(toggleDialog, 'toggle.css 里应有 .pm-tg-dialog 规则').not.toBeNull();
    for (const name of ['box-sizing', 'padding', 'border', 'border-radius']) {
      expect(prop(toggleDialog, name), `${name} 两处应同源`).toBe(prop(baseDialog, name));
    }
  });

  it('弹窗覆盖只改 inline-size（逻辑属性），padding/border/radius 全部继承全局 dialog', () => {
    expect(popupDialog, 'App.vue 里应有 dialog.popup-delete-dialog 规则').not.toBeNull();
    expect(prop(popupDialog, 'inline-size')).toBe('min(288px, calc(100vw - 24px))');
    expect(prop(popupDialog, 'width'), '不再用物理 width（旧 content-box 口径）').toBeNull();
    // 不重定义这三样，三处外壳才真正由同一份全局来源派生
    expect(prop(popupDialog, 'padding')).toBeNull();
    expect(prop(popupDialog, 'border')).toBeNull();
    expect(prop(popupDialog, 'border-radius')).toBeNull();
    expect(prop(popupDialog, 'overscroll-behavior')).toBe('contain');
  });
});
