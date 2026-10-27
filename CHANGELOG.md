# 更新日志 / Changelog

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 结构与 [语义化版本](https://semver.org/lang/zh-CN/)。
每个版本下「中文」与「English」两节逐条对应。
This file follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).
Under each version, the Chinese and English sections correspond item by item.

## [0.2.0] - 2026-10-27

上架前的质量加固：可用性缺陷、无障碍、文档一致性。/ Pre-release quality pass: usability defects, accessibility, documentation consistency.

### 中文

#### 修复

- **遮罩覆盖**：页面后加载的元素会被自动补上遮罩；遮罩颜色取自元素背后的真实底色（深色页面不再刺眼）；页面静止时不再逐帧运行；遮罩下的链接点不到
- **设置向导**：取消某个选择后序号重新编号；改一个元素的方案不会让其它预览标记坍缩；预览标记不再盖住重排上来的内容、也不拦截点击；Esc 分层处理（有浮层只关浮层、退出确认框上 Esc 等于继续编辑）；「继续选择」保留已改的方案；滚动后点击选中的是指针下的元素；工具条默认在底部、可拖动也可用方向键移动
- **编辑规则**：popup 增加「编辑当前网站」入口；「重选元素」取消后旧规则原样保留，保存时在同一次写入里替换；面板跟随存储变化，SPA 换页后规则列表随之更新；高级选择器逐行校验并指出第几行；删除后 5 秒内可撤销；失效规则给出可读说明与「去处理」按钮
- **悬浮按钮**：点菜单项不再误切开关；菜单自动避开视口边缘；按钮可用键盘操作（Tab 聚焦、回车切换）；拖动改用专用把手，触屏不再残留监听；位置贴边保存，窗口变化后仍够得着
- **扩展页面**：开关改为原生 switch 语义；弹窗、管理页、引导页的对比度与深色模式达标；确认框改为原生对话框，焦点进入框内
- **存储**：所有站点配置经统一校验 + 原子更新写入，避免并发覆盖；导入先校验后写入

#### 新增

- 新图标（16 / 32 / 48 / 128），悬浮按钮使用配套单色图标
- 默认标签页标题「阅读」/ "Reading"、默认透明图标；管理页提供常用标签页标题快捷选择
- manifest 多语言（英文默认 + 简体中文），最低支持 Chrome 116
- 设计 tokens 与自动对比度测试；界面统一使用 tokens
- 内容脚本宿主隔离：页面样式（含 `!important`）压不到插件界面；扩展更新后新实例接管旧页面
- 站点生命周期对账：撤销授权后显示「待授权」并可重新授权；一键清空时已打开页面立即还原
- 首次安装的四步引导页

#### 工程

- CI、打包门禁（`npm run check:package`）、第三方组件声明、SECURITY.md
- 依赖锁定精确版本；可移植 E2E（Chrome for Testing），覆盖主流程与各界面专项

### English

#### Fixed

- **Cover**: elements inserted after page load get covered automatically; the cover color is taken from the real background behind the element (no more glare on dark pages); nothing runs per frame while the page is still; links under a cover are not clickable
- **Setup wizard**: badge numbers renumber after unselecting; changing one element's method no longer collapses other preview markers; markers no longer cover reflowed content or block clicks; Esc is handled by layer (only the open overlay closes; Esc on the exit dialog means keep editing); "continue selecting" keeps your adjustments; after scrolling, a click selects the element under the pointer; the toolbar sits at the bottom by default, can be dragged or moved with arrow keys
- **Edit rules**: the popup gains an "Edit this site" entry; "re-pick element" keeps the old rule if you cancel, and replaces it in the same write when you save; the panel follows storage changes and updates its rule list after SPA navigation; the advanced selector backdoor validates line by line and names the failing line; deletions can be undone for 5 seconds; broken rules show a readable explanation with a "fix it" button
- **Floating button**: clicking a menu item no longer flips the switch; the menu stays inside the viewport; the button is keyboard operable (Tab to focus, Enter to toggle); dragging uses a dedicated handle and leaves no listeners behind on touch; the position is saved against the nearest edge and stays reachable after resizing
- **Extension pages**: the switch uses native switch semantics; contrast and dark mode meet the thresholds on the popup, management and onboarding pages; confirmations are native dialogs with focus moved inside
- **Storage**: every site profile is written through a single validator and atomic updates, avoiding lost updates; imports are validated before writing

#### Added

- New icons (16 / 32 / 48 / 128), with a matching monochrome icon for the floating button
- Default tab title "Reading" (「阅读」) and a transparent default icon; quick title presets in the management page
- Localized manifest (English default + Simplified Chinese), minimum Chrome 116
- Design tokens with automated contrast tests; the UI uses tokens throughout
- Host isolation: page styles (including `!important`) cannot reach PageMask UI; after an extension update a new instance takes over open pages
- Site lifecycle reconciliation: a revoked site shows "pending" and can be re-authorized; resetting a site reverts open pages immediately
- Four-step first-run onboarding

#### Engineering

- CI, a packaging gate (`npm run check:package`), third-party notices, SECURITY.md
- Dependencies pinned to exact versions; portable E2E (Chrome for Testing) covering the main flow and each UI area

## [0.1.0] - 2026-10-26

首个功能完整版本。/ First functional release.

### 中文

- 按网站生效：仅用户主动添加的网站生效，未配置网站零注入、零影响
- 点选向导：悬停高亮、连续多选、选大/选小调整层级、整页防呆提示、Esc 二次确认
- 三种收起方式：彻底移除 / 原地留白 / 遮罩覆盖，预览期可随时切换
- 收起规则：多候选选择器（语义属性优先，过滤构建工具生成的类名），生效范围零输入（整站 / 仅这类 / 排除这类）
- 标签页标题与图标：可设置自定义标题与图标，网站动态改写标题时自动改回
- 每网站开关：页面内悬浮按钮（可拖动、记住位置），同站多标签页联动，状态按网站记忆
- 页面内编辑面板：当前页面规则列表、换方案/改范围即时生效、删除、重选、高级选择器后门（保存前必须现场命中）
- 管理页：全站总览、标签页标题/图标设置、失效状态、一键清空（二次确认）、导出/导入（合并或整体替换）
- 失效体检：仅在清爽态采集，用人话提醒
- 首次安装引导
- 隐私：配置只存在本机，PageMask 自身不发起网络请求，权限最小化（按网站的可选主机权限）

### English

- Works per site: only user-added sites are affected; zero injection elsewhere
- Pick wizard: hover highlight, multi-select, bigger/smaller level adjustment, whole-page guard, Esc double-confirm
- Three hiding methods: remove / blank-in-place / cover, switchable during preview
- Hide rules: multi-candidate selectors (semantic attributes first, build-tool generated class names filtered), zero-typing scope (whole site / only these pages / except these pages)
- Tab title & icon: custom title and icon per site; titles rewritten by the site are changed back automatically
- Per-site switch: an on-page floating button (draggable, remembers its position); all tabs of a site switch together; state remembered per site
- On-page editor panel: rule list for the current page, live method/scope changes, delete, re-pick, advanced raw-selector backdoor (must match live before saving)
- Management page: all-sites overview, tab title/icon settings, health state, one-click reset with confirmation, export/import (merge or replace)
- Rule health check: collected in clean mode only, plain-language notices
- First-run onboarding
- Privacy: settings stay on your device, PageMask itself makes no network requests, minimal permissions (per-site optional host permissions)

[0.2.0]: https://github.com/cherishfall/page-mask/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/cherishfall/page-mask/releases/tag/v0.1.0
