// @vitest-environment node
/**
 * #180 内容基准线：内缩量只有一处 token 来源（轻量 CSS 源码断言）。
 *
 * 「内容相对边界内缩多少」= --pm-space-3 + 1px border，唯一定义在 styles/tokens.css 的
 * --pm-card-inset；界面样式里不许再出现第二份 13px 字面值、自己算一遍 calc(... + 1px)、
 * 或重新定义这个 token。与 tests/font-size.test.ts 同一做法：vitest 不解析 CSS，
 * 用 Node 直接读源码、先去掉 CSS 块注释，免得注释里的「13px」「跨整卡宽」被当成违规。
 */
// @ts-ignore -- node:fs 无类型声明（项目未装 @types/node）
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8') as string;
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');

const tokensCode = code(read('../styles/tokens.css'));
const popupRaw = read('../ui/popup/PopupBody.vue');
const popupStyle = code(popupRaw.split('<style>')[1] ?? '');

describe('内容基准线：内缩量只有一个 token 来源（#180）', () => {
  it('tokens.css 里 --pm-card-inset 只定义一次，且 = --pm-space-3 + 1px', () => {
    const defs = tokensCode.match(/--pm-card-inset:\s*calc\(var\(--pm-space-3\)\s*\+\s*1px\)\s*;/g) ?? [];
    expect(defs).toHaveLength(1);
  });

  it('裸行都用 var(--pm-card-inset) 内缩，界面里没有第二份表达内缩量的字面值', () => {
    expect(popupStyle).toContain('margin-inline: var(--pm-card-inset)');
    // 不许写裸 13px 属性值、不许自己再算一遍、不许重新定义 token
    expect(popupStyle).not.toMatch(/:\s*13px\b/);
    expect(popupStyle).not.toMatch(/calc\([^)]*1px\s*\)/);
    expect(popupStyle).not.toContain('--pm-card-inset:');
  });

  it('三个裸行统一内缩，分组线 .divider 是整卡宽的例外、不内缩', () => {
    const rule = /\.popup > \.aux-row[\s\S]*?\{[^}]*\}/.exec(popupStyle)?.[0] ?? '';
    expect(rule).toContain('.popup > .links');
    expect(rule).toContain('.popup > .text-danger');
    expect(rule).not.toContain('.divider');
    expect(rule).toContain('margin-inline: var(--pm-card-inset)');
    expect(/\.divider\s*\{[^}]*\}/.exec(popupStyle)?.[0] ?? '').not.toContain('margin-inline');
  });

  it('例外理由在 CSS 注释里写明（有理由，不是遗漏）', () => {
    expect(popupRaw).toContain('跨整卡宽');
    expect(popupRaw).toContain('容器级元素');
  });
});
