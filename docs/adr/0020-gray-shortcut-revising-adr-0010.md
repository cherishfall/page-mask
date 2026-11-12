# 整页变灰快捷键：修订 ADR-0010 的「全产品只有一条」

日期：2026-11-12 · 状态：已采纳 · **修订：[ADR-0010](./0010-curtain-keyboard-shortcut.md) 的决定、Considered Options 末条与 Consequences 第一条** · 相关：[ADR-0007](./0007-curtain-ephemeral-full-page-cover.md)（幕布是临时的）、[ADR-0014](./0014-media-gray-independent-of-master-switch.md)（灰度独立于主开关）、[ADR-0018](./0018-whole-page-grayscale.md)（整页变灰本身）

## 背景

[ADR-0010](./0010-curtain-keyboard-shortcut.md) 在 0.6.0 为幕布开了唯一的键盘口子，同时明确否决「给其他动作也配快捷键」，理由是怕快捷键污染、怕「只有幕布是应急动作」这个边界失守；`docs/design.md` 的「永不做」清单随之写成「除幕布快捷键以外的任何快捷键」。

0.9.2 产品所有者提案：整页变灰也要一条默认快捷键、弹窗上显示键位提示并区分 Mac / PC、第一次使用时自动调起授权。

这条提案与 ADR-0010 的否决理由并不真正冲突：当初担心的是「每个动作都配一个键」，而变灰是**按网站记住状态的设置**，不是应急动作；两条命令恰好把「临时」与「记住」两种性质分开，边界反而更清楚。[Apple HIG · Keyboards](https://developer.apple.com/design/human-interface-guidelines/keyboards) 也只要求「只为最常用的应用内命令定义自定义快捷键」，并不要求最多一条。本产品只再加这一条，仍远低于 Chrome 允许的 4 个 `suggested_key` 上限。

需要写 ADR 正式修订，因为「全产品只有一条命令」是成文决定、被代码注释与两份文档反复引用，直接改代码会让未来读者不知道哪一句才算数。

## 决定

1. 新增命令 `toggle-media-gray`：按一次打开整页变灰，再按一次恢复彩色。**状态按网站记忆**，写的是弹窗 / 胶囊 / 站点设置页共用的同一个 `mediaGray` 字段、同一条 `updateProfile` 通道。
2. 默认键 `Ctrl+Shift+G`（Windows / Linux）、`Command+Shift+G`（macOS）。G 取 Gray，与幕布的 X（遮住）同族好记；两者叠 Shift，不占用单修饰键组合。改键仍只去 `chrome://extensions/shortcuts`——扩展没有自己设键的 API（ADR-0010 已记）。
3. **权限在第一次按键时自动申请**：`chrome.commands.onCommand` 的按键本身就是用户手势，`permissions.request` 必须在**同一同步回合**发起。监听器把事件的 `tab` 参数直接传给处理函数，前面不许插 `await browser.tabs.query`（一 await 手势就没了）。已授权站点 `request` 直接返回 `true`、不弹窗；没授权过的正好弹出 Chrome 的「允许」提示，一次按键完成授权与变灰。
4. 站点**已有配置** → 就地翻转 `mediaGray`；**没配置过**且授权成功 → 走 `enableSite({ initialMedia: true })`，与弹窗首次开灰度同一条路（授权并注入后补一份只带灰度的配置；页面还在错误页时配置照常建档，#154 语义）。关闭写 `undefined`（字段从存储里消失），与 `core/media.ts` 的 `mediaFlagPatch`、`sanitizeProfile`「显式 true 才落字段」同口径。
5. 用户拒绝授权：没配置过就什么都不做；**已有配置仍允许就地切换**（旧精确授权用户不该被逼着先扩权）。页面不支持（`chrome://` / 商店 / PDF / `file://`）、或连网址都读不到：图标角标 `!` + 悬停说明，安静返回，不申请权限。
6. 键帽只显示 `chrome.commands.getAll()` 的**当前实际绑定**，没绑定就不显示（弹窗 / 欢迎页）、设置页给「没有绑定快捷键」警告。Mac / PC 的字形差异只在 `core/shortcut.ts` 的 `formatShortcut` 一个出口处理，组件里不另写平台判断。
7. **快捷键到此为止**：除幕布与整页变灰两条外不加快捷键；全局总开关、内置站点预置规则、远程配置订阅、右键菜单入口、uBlock 式免保存临时隐藏仍不做。

## 界面与文案依据

`AGENTS.md` 要求界面决策先查三个以上成熟设计系统、写明参考了谁的哪条规则。本轮不新增整套视觉方案（键帽外观复用 #171 已定的 `.pm-kbd`），但以下六处判断都有出处：

| 决策点 | 参考了谁、哪条规则 | 为什么这样取舍 |
|---|---|---|
| Mac 键帽的修饰键顺序 | [Apple HIG · Keyboards](https://developer.apple.com/design/human-interface-guidelines/keyboards)：「List modifier keys in the correct order … Control, Option, Shift, Command」；同页规定 Command 作主修饰键、Shift 作次级 | Chrome 返回 `Command+Shift+G`，键帽应显示 `⇧⌘G`，不是照抄字符串顺序的 `⌘⇧G`。改唯一出口 `formatShortcut`，幕布与变灰两条、弹窗 / 设置页 / 欢迎页三处一起生效（「修一类，不是修一个」） |
| 只再加这一条命令 | 同上：「Define custom keyboard shortcuts for only the most frequently used app-specific commands」；[Chrome · chrome.commands](https://developer.chrome.com/docs/extensions/reference/api/commands)：最多 4 个 `suggested_key`、组合必须含 Ctrl 或 Alt、系统 / 浏览器快捷键始终优先 | 两条都在阈值内，但不再开第三个口子；ADR-0010 的「污染」担忧仍由「两条为止」这条硬边界守着 |
| 键帽外观 | `docs/design-ui.md` §四「键帽只有一份样式（#171）」；该节的 GOV.UK Button / Carbon Button & Type sets / Ant Design Button 三套按钮档位结论 | 复用 `styles/controls.css` 的 `.pm-kbd`，不另写一份；设置页新增的一行也用同一个类 |
| 两条命令不混淆 | `docs/design-ui.md` §七：Nielsen 4（一致）、格式塔邻近 / 共同区域、WCAG 1.4.1（信息不只靠视觉）；`docs/design-copy.md` 二、a（状态与边界坑常驻） | 每个键帽贴着它解释的那一行（弹窗遮住卡 / 灰度卡各自带），不集中堆一排；设置页 `shortcutIntro` 常驻一句写清「遮住临时、变灰记住」 |
| 键帽要不要被读屏念出来 | WCAG 2.2 [4.1.2 名称角色值](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html) 与 [1.4.1 颜色与图形不是唯一信息载体](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)；项目 #171 遮住键帽的既有口径 | 弹窗里开关本身有文字标签，键帽是纯视觉附属、念出来是重复播报 → `aria-hidden="true"`；设置页那一行的**值**就是键帽，是唯一信息 → 不加 `aria-hidden`，文字色由 `tests/tokens-contrast.test.ts` 守 4.5:1 |
| 说明的长度与标点 | `docs/design-copy.md` 二、d：GOV.UK Text input「without any full stops」、Carbon Form 的 helper text 口径 | `shortcutIntro` 用分号连成一句、句尾不带句号；中英按同一个意思重写，不逐字硬译 |

**查不到 / 没有统一成文规定的部分，如实登记**：

- Chrome 官方文档只说「某些操作系统与 Chrome 快捷键（如窗口管理）始终优先于扩展命令、不可覆盖」，**没有给出完整的保留组合清单**。`Ctrl+Shift+G` / `⇧⌘G` 在 Chrome 查找栏是「查找上一个」、在 macOS Finder 是「前往文件夹」——这类上下文相关的组合会不会导致建议键被静默不绑定，没有查到官方结论。不擅自判为安全：设置页已显示实际绑定并对未绑定给警告（ADR-0010 的既有机制），真机验收必须按一次确认。
- 键帽上 `aria-hidden` 的适用边界，各设计系统之间没有一句统一规定（有的保留 `<kbd>` 原生语义并接进 accessible description，有的隐藏装饰副本）。本项目按「同一信息别处已有文字版就隐藏副本、承载唯一信息就必须可达」自行定夺，记在此处，不冒充引用。

## Considered Options

- **`global: true`**：否决。ChromeOS 不支持全局命令，global 预设只允许 `Ctrl+Shift+0~9`；页面看不见时按了没意义（ADR-0010 已否决，沿用）。
- **单键 / 不带修饰键**：做不到。Chrome 要求扩展命令必须包含 Ctrl 或 Alt，这是平台限制。
- **页面内 `keydown` 监听**：否决。会和网站自己的快捷键打架，没添加过的网站没有内容脚本，也拿不到浏览器级组合（沿用 ADR-0010）。
- **给灰度开「临时变灰」而不记忆**：否决。与「按网站记」的既有语义冲突，还会让同一个开关出现两种时效，弹窗 / 设置页 / 快捷键三处状态不再互通。
- **要求用户先去弹窗开一次灰度，之后才谈快捷键**：否决。那就不是「第一次就能用」；而 `permissions.request` 的用户手势条件在命令回调里本来就能满足，多一步没有必要。
- **两条命令合并成一条、按次数在「遮住 / 变灰」之间循环**：否决。临时动作与记住状态的设置混在一条键上，用户无法预期下一次按会发生什么，也无法只改其中一件的状态。
- **默认键定成与幕布同一个键、用连按区分**：否决。同样破坏幂等性，且会与 ADR-0011 的「单一控制器」语义打架。

## Consequences

- **正式修订 [ADR-0010](./0010-curtain-keyboard-shortcut.md)**：其「决定」第 2 段「全产品只有幕布一条快捷键，其他任何功能一律不加」、Considered Options 末条「给其他动作也配快捷键：明确否决」、Consequences 第一条「『永不做』第一条改写为『除幕布外不加快捷键』」**作废**，以本 ADR 为准。ADR-0010 其余决定（键位选择、改键入口、不新增权限、失败不能静默）继续有效。`docs/design.md`「永不做」改为「除幕布与整页变灰两条快捷键以外的任何快捷键」。
- **不新增权限声明**：`commands` 本身不需要权限，`permissions.request` 复用既有的 `optional_host_permissions: ['*://*/*']`。
- **写入形状与弹窗一致**：关闭态写 `undefined` 而不是 `false`，落库后字段消失；`sanitizeProfile` 本来也只认显式 `true`，功能等价但不再留一个要额外解释的值。
- **界面与文档**：弹窗灰度卡、插件设置页快捷键卡、欢迎页示意图三处键帽；`GLOSSARY.md`「整页变灰」「幕布」「插件设置」三个词条补快捷键入口；README 与 CHROMEWEBSTORE 的中英功能描述、审核员备注补这条命令；`public/_locales/{en,zh_CN}/messages.json` 增加 Chrome 快捷键页显示的说明。
- **测试**：`core/background-engine.test.ts` 新增 7 个用例（翻转、关态写 undefined、gray-only 建站、拒绝授权、手势丢失、不支持页面、无网址），既有 6 个幕布用例保持绿；`core/shortcut.test.ts` 补 HIG 修饰键顺序用例。
- **浏览器级快捷键自动化触发不了**（CDP 只能发页面级按键，ADR-0010 已记录）：命令分支靠 fake browser 单测覆盖，真机路径必须手测，交付时如实说明，不谎报。
- **真机验收清单**：① 未授权站点按快捷键 → 授权框弹出 → 允许 → 页面变灰；② 已授权站点按 → 直接变灰、不弹框；③ 再按一次恢复彩色，刷新后状态仍保持；④ 在 `chrome://extensions/shortcuts` 确认两条命令都绑定成功，尤其 Mac 的 `⇧⌘G` 有没有被系统 / 查找占用抢走；⑤ 在 `chrome://` 页面按 → 图标角标 `!`、不弹权限框。
