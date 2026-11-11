// @vitest-environment jsdom
/**
 * 嵌套区域检测（#167）：点中 open shadow root 里的元素、或 iframe 元素本身时，
 * 点选层给一句提示并拒绝选中——这类选择生成的选择器走文档级 insertCSS 永远
 * 命中不了，还可能误伤外层同名元素（design.md「已知边界」承诺的提示）。
 *
 * jsdom 没有 elementsFromPoint（命中栈不可造），所以只测判定函数本身；
 * 拒绝选中与提示条的联动由类型系统保证（onPointerDown 里 kind 非空即 return），
 * 真机路径由浏览器验证（#167 票内留痕）。
 */
import { describe, expect, it } from 'vitest';
// @ts-ignore -- 项目未装 @types/node 之外不影响；vue-tsc 不检查测试里的相对导入
import { nestedKindOf } from '../ui/wizard/pick-controller';

describe('嵌套区域判定 nestedKindOf（#167）', () => {
  it('open shadow root 里的元素判为 shadow', () => {
    const host = document.createElement('div');
    const root = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('button');
    root.appendChild(inner);
    document.body.appendChild(host);
    expect(nestedKindOf(inner)).toBe('shadow');
    expect(nestedKindOf(host)).toBeNull();
  });

  it('iframe 元素本身判为 iframe（点 iframe 内部命中的就是它）', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    expect(nestedKindOf(frame)).toBe('iframe');
  });

  it('普通文档元素为 null', () => {
    const el = document.createElement('p');
    document.body.appendChild(el);
    expect(nestedKindOf(el)).toBeNull();
  });
});
