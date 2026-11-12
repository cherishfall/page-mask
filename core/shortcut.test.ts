import { describe, expect, it } from 'vitest';
import { formatShortcut } from './shortcut';

describe('formatShortcut：Chrome 的快捷键写法 → 界面上的键帽（#101）', () => {
  it('Windows / Linux：原样保留组合，只去掉多余空格', () => {
    expect(formatShortcut('Ctrl+Shift+X', false)).toBe('Ctrl+Shift+X');
    expect(formatShortcut(' Ctrl + Shift + X ', false)).toBe('Ctrl+Shift+X');
  });

  it('Mac：Command / Control / Shift / Option 换成键盘上的符号', () => {
    expect(formatShortcut('Command+Shift+X', true)).toBe('⇧⌘X');
    expect(formatShortcut('MacCtrl+Shift+X', true)).toBe('⌃⇧X');
    expect(formatShortcut('Ctrl+Shift+X', true)).toBe('⌃⇧X');
    expect(formatShortcut('Alt+Shift+X', true)).toBe('⌥⇧X');
  });

  it('Mac：多修饰键按 Apple HIG 的 Control → Option → Shift → Command 排（ADR-0020）', () => {
    // 与 Chrome 返回的字符串顺序无关：同一组合怎么写都得到同一串键帽
    expect(formatShortcut('Command+Shift+G', true)).toBe('⇧⌘G');
    expect(formatShortcut('Shift+Command+G', true)).toBe('⇧⌘G');
    expect(formatShortcut('Command+Alt+Shift+Ctrl+X', true)).toBe('⌃⌥⇧⌘X');
    expect(formatShortcut('Ctrl+Shift+Alt+Command+X', true)).toBe('⌃⌥⇧⌘X');
  });

  it('未绑定（空串）原样返回空串，由界面决定怎么表达', () => {
    expect(formatShortcut('', true)).toBe('');
    expect(formatShortcut(null, false)).toBe('');
    expect(formatShortcut(undefined, true)).toBe('');
  });

  it('不认识的键名原样带出，不做猜测性替换', () => {
    expect(formatShortcut('Command+Period', true)).toBe('⌘Period');
  });
});
