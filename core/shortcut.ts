/**
 * 快捷键的展示格式（#101）。
 *
 * `chrome.commands.getAll()` 返回的是 Chrome 自己的写法（`Ctrl+Shift+X` / `Command+Shift+X`），
 * 直接显示在界面上会有两个问题：Mac 上写 `Command+Shift+X` 又长又不直观；Windows 上也不该出现
 * `⌘` 这类符号。这里按当前平台转成用户键盘上真正看到的键帽。
 *
 * 只做展示——真正生效的按键始终是 Chrome 存的那一份，我们不改、也不缓存。
 */

/** 判断当前是不是 macOS（扩展页面里可用；不依赖 UA 解析库） */
export function isMacPlatform(): boolean {
  const platform = typeof navigator === 'undefined' ? '' : (navigator.platform ?? '');
  return /mac/i.test(platform);
}

/**
 * 把 Chrome 的快捷键字符串转成界面上的写法。
 * Mac：`Command+Shift+X` → `⌘⇧X`，`MacCtrl` / `Ctrl` → `⌃`；其它平台原样保留 `Ctrl+Shift+X`。
 * 空字符串（未绑定）原样返回 ''，由调用方决定显示「没有绑定」还是隐藏这一行。
 */
export function formatShortcut(raw: string | null | undefined, mac: boolean): string {
  const value = (raw ?? '').trim();
  if (!value) return '';
  const parts = value
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean);
  if (!mac) return parts.join('+');
  const symbols: Record<string, string> = {
    Command: '⌘',
    Cmd: '⌘',
    MacCtrl: '⌃',
    Ctrl: '⌃',
    Control: '⌃',
    Shift: '⇧',
    Alt: '⌥',
    Option: '⌥',
  };
  return parts.map((p) => symbols[p] ?? p).join('');
}
