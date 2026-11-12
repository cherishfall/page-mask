/**
 * 就地写入的失败回滚与向导挂载守卫（#186）。
 *
 * ui/content-runtime.ts 与 WizardApp.vue 都引 .vue 组件，vitest 不解析（tests/media-ui.test.ts
 * 同款约束），这两条失败路径按源码结构守门：
 * 1. 胶囊三个「先就地改 profile 再写库」的入口（主开关 / 拖动落点 / 放回右下角）必须带
 *    try/catch：写失败回滚本地字段、重刷按钮状态、页内提示一句——与 handleMediaChange 同一口径；
 * 2. 向导的 MutationObserver 挂观察前先判 body 存在，body 还没解析出来等 DOMContentLoaded，
 *    卸载时把这条监听一并摘掉。
 */
// @ts-ignore -- node:fs 无类型声明（项目未装 @types/node）
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MESSAGES } from '@/core/i18n';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

const runtime = read('../ui/content-runtime.ts');

/** 从 start 标记切到 end 标记之间的源码（几个相邻函数体） */
const sectionOf = (start: string, end: string): string => {
  const a = runtime.indexOf(start);
  expect(a, `${start} 应该在 ui/content-runtime.ts 里`).toBeGreaterThanOrEqual(0);
  const b = runtime.indexOf(end, a + start.length);
  expect(b, `${end} 应该出现在 ${start} 之后`).toBeGreaterThan(a);
  return runtime.slice(a, b);
};

/** catch 块内容（以四个空格缩进的闭括号为界；块内的 if 块是六格缩进） */
const catchOf = (body: string): string => /catch \{([\s\S]*?)\n    \}/.exec(body)?.[1] ?? '';

describe('胶囊三处就地写入的失败回滚（#186）', () => {
  const HANDLERS = [
    {
      name: '主开关',
      body: sectionOf('async function handleToggle()', 'async function handleMoved'),
      before: 'const before = profile.switchState;',
      write: 'profile.switchState = target;',
      rollback: 'profile.switchState = before;',
    },
    {
      name: '拖动落点',
      body: sectionOf('async function handleMoved', 'async function handleResetPos'),
      before: 'const before = profile.floatingBtnPos;',
      write: 'profile.floatingBtnPos = pos;',
      rollback: 'profile.floatingBtnPos = before;',
    },
    {
      name: '放回右下角',
      body: sectionOf('async function handleResetPos', '胶囊媒体钮 / 各处开关拨动'),
      before: 'const before = profile.floatingBtnPos;',
      write: 'profile.floatingBtnPos = null;',
      rollback: 'profile.floatingBtnPos = before;',
    },
  ] as const;

  it('每个入口都先记下旧值再就地改（回滚才有依据）', () => {
    for (const { name, body, before, write } of HANDLERS) {
      const beforeAt = body.indexOf(before);
      expect(beforeAt, `${name} 应该记下旧值`).toBeGreaterThanOrEqual(0);
      expect(body.indexOf(write), `${name} 的就地修改应该跟在记旧值之后`).toBeGreaterThan(beforeAt);
    }
  });

  it('写入都包在 try/catch 里：失败回滚本地字段、重刷按钮状态', () => {
    for (const { name, body, rollback } of HANDLERS) {
      expect(body, `${name} 应该有 try`).toContain('try {');
      const caught = catchOf(body);
      expect(caught, `${name} 失败时应该回滚本地字段`).toContain(rollback);
      expect(caught, `${name} 失败时应该重刷按钮状态`).toContain('syncToggleState()');
    }
  });

  it('失败提示三处同一句（common.saveFailed）；与 media.saveFailed 同值（#172 收成一份 const）', () => {
    for (const { name, body } of HANDLERS) {
      expect(catchOf(body), `${name} 失败时应该给页内提示`).toContain('showPageNotice(ctx, t().common.saveFailed)');
    }
    expect(MESSAGES.zh.common.saveFailed).toBe(MESSAGES.zh.media.saveFailed);
    expect(MESSAGES.en.common.saveFailed).toBe(MESSAGES.en.media.saveFailed);
  });

  it('与 handleMediaChange 同一口径：就地改在前、await 写入在后、回滚在 catch', () => {
    for (const { name, body } of HANDLERS) {
      const writeAt = body.indexOf('await storage.updateProfile');
      expect(writeAt, `${name} 应该 await 写库`).toBeGreaterThan(body.indexOf('try {'));
      expect(body.indexOf('catch {'), `${name} 的 catch 应该跟在写入之后`).toBeGreaterThan(writeAt);
    }
  });
});

describe('向导挂载的 body 守卫（#186）', () => {
  const wizard = read('../ui/wizard/WizardApp.vue');
  const mounted = wizard.slice(wizard.indexOf('onMounted(() => {'), wizard.indexOf('onBeforeUnmount(() => {'));
  const unmounted = wizard.slice(wizard.indexOf('onBeforeUnmount(() => {'), wizard.indexOf('function showWarn'));

  it('observe(document.body) 前先判 body 存在；body 还没解析出来等 DOMContentLoaded 再挂', () => {
    expect(mounted).toContain('if (document.body)');
    expect(mounted).toContain("document.addEventListener('DOMContentLoaded'");
    expect(mounted).toContain('draftObserver.observe(document.body');
  });

  it('卸载时把 DOMContentLoaded 的监听一并摘掉（收尾之后不许再 observe）', () => {
    expect(unmounted).toContain("document.removeEventListener('DOMContentLoaded'");
  });
});
