/**
 * 快捷键的展示格式（#101；0.9.2 起按 Apple HIG 排 Mac 修饰键顺序，ADR-0020）。
 *
 * `chrome.commands.getAll()` 返回的是 Chrome 自己的写法（`Ctrl+Shift+X` / `Command+Shift+X`），
 * 直接显示在界面上会有两个问题：Mac 上写 `Command+Shift+X` 又长又不直观；Windows 上也不该出现
 * `⌘` 这类符号。这里按当前平台转成用户键盘上真正看到的键帽。
 *
 * Mac 侧依据 [Apple HIG · Keyboards](https://developer.apple.com/design/human-interface-guidelines/keyboards)：
 * 「以正确顺序列出修饰键」——多个修饰键一律 Control → Option → Shift → Command，
 * 所以 Chrome 给的 `Command+Shift+G` 在键帽上是 `⇧⌘G`，不是照抄字符串顺序的 `⌘⇧G`；
 * 同页还规定 Command 作主修饰键、Shift 作次级，符号用键盘上印的那一个。
 * README / 商店材料里写「⌘+Shift+X」是「按哪几个键」的组合说明，与键帽的符号连写是两种语境，
 * Apple 自己也是这两种写法并用（正文 Shift-Command-Tab、菜单 ⇧⌘←），不是两套叫法。
 *
 * 只做展示——真正生效的按键始终是 Chrome 存的那一份，我们不改、也不缓存。
 */

/** 判断当前是不是 macOS（扩展页面里可用；不依赖 UA 解析库） */
export function isMacPlatform(): boolean {
  const platform = typeof navigator === 'undefined' ? '' : (navigator.platform ?? '');
  return /mac/i.test(platform);
}

/** Apple HIG 规定的修饰键顺序：Control → Option → Shift → Command（键帽符号） */
const MODIFIER_ORDER = ['⌃', '⌥', '⇧', '⌘'];

/**
 * 把 Chrome 的快捷键字符串转成界面上的写法。
 * Mac：`Command+Shift+G` → `⇧⌘G`（按 HIG 重排修饰键），`MacCtrl` / `Ctrl` → `⌃`；
 * 其它平台原样保留 `Ctrl+Shift+G`。
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
  const mapped = parts.map((p) => symbols[p] ?? p);
  // 修饰键按 HIG 顺序重排、主键留在最后；结果只取决于组合本身，不取决于 Chrome 给的字符串顺序
  const modifiers = mapped.filter((p) => MODIFIER_ORDER.includes(p));
  const keys = mapped.filter((p) => !MODIFIER_ORDER.includes(p));
  modifiers.sort((a, b) => MODIFIER_ORDER.indexOf(a) - MODIFIER_ORDER.indexOf(b));
  return [...modifiers, ...keys].join('');
}
