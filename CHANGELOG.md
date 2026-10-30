# 更新日志 / Changelog

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 结构与 [语义化版本](https://semver.org/lang/zh-CN/)。
每个版本下「中文」与「English」两节逐条对应。
This file follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).
Under each version, the Chinese and English sections correspond item by item.

## [0.4.0] - 2026-10-30

一次「把界面捋顺」的批次：面板更简单、设置分成两个页面、向导变成三步、整套界面有中英文。/ A batch that straightens out the interface: a simpler popup, settings split into two pages, a three-step wizard, and a bilingual UI.

### 中文

#### 新增

- **面板只留三件事**：主操作、编辑当前网站、还有一个能来回点的「遮住本页 / 恢复本页」；底部并排两个入口——「管理全部网站」与「插件设置」。原来的「设置标题和图标」从面板移除，改到页面右下角小胶囊的菜单里
- **设置分成两个独立页面**：「你添加的网站」是网站列表，点进去是一个网站的设置页；「插件设置」单独一页，放默认标题、默认图标、导出 / 导入、界面语言与版本信息，也注册成了扩展的「扩展程序选项」
- **默认标签页图标**：插件有一张自己的默认图标，生效顺序是网站自己设的 > 插件默认 > 透明（不显示）。改了默认图标，没单独设过图标的网站会一起变
- **设置向导变成三步**：标签页标题和图标 → 点选要收起的内容 → 看效果。选中的内容列成清单、可逐项删掉；生效范围也在「看效果」这一步定；点保存即完成
- **页面右下角小胶囊的菜单变成四项**：标签页标题和图标 / 编辑收起的内容 / 按钮放回右下角 / 删除这个网站的设置
- **「一键清空」改叫「删除这个网站的设置」**：确认框里写清删的是什么、影响哪些东西；网站的设置页和页面菜单里是同一个名字
- **遮住整页后是一颗睁眼的小按钮**：和平时那根小胶囊同一套长相，可以拖动、记住位置；鼠标移上去（或键盘聚焦）才显出「恢复」两个字
- **导出文件更完整**：除了全部网站的设置，还带上插件设置（默认标题、默认图标）与导出时的版本号；文件名形如 `pagemask-0.4.0-20261030120000.json`
- **全界面中英双语**：面板、管理页、向导、页面内的按钮与提示都有中文和英文两套文案；「插件设置」里可以选界面语言（跟随浏览器 / 简体中文 / English），切换立即生效

#### 修复

- **标签页标题不再和网站"对抢"**：个别网站反复改写标签页标题时，插件补写频率受控；实在抢不过（网站用定时器死守）就彻底放手，浏览器保持流畅，不再卡顿

### English

#### Added

- **The popup keeps three things**: the main action, "Edit this site", and a two-way "Cover this page / Restore this page" switch; two side-by-side entries at the bottom — "Manage all sites" and "Settings". The old "Set tab title & icon" is gone from the popup; it moved into the menu of the small capsule at the bottom-right of the page
- **Settings split into two pages**: "Your sites" lists the sites you added; clicking one opens that site's settings page. "Settings" is its own page with the default title, default icon, export / import, interface language and version info, and it is registered as the extension's "Options" page
- **Default tab icon**: PageMask now has its own default icon; the order is the site's own icon > the default icon > transparent (nothing shown). Change the default and every site without its own icon follows
- **The setup wizard is now three steps**: tab title and icon → pick what to hide → check the result. Everything picked is listed and can be removed item by item; the scope is decided on the "check the result" step too; saving finishes it in one click
- **The capsule's ⋯ menu now has four items**: tab title and icon / edit what's hidden / put the button back at the bottom-right / delete this site's settings
- **"Reset" is now "Delete this site's settings"**: the confirmation spells out what is deleted and what it affects; the site's settings page and the on-page menu share the same name
- **After covering the page there is a small open-eye button**: same look as the capsule, draggable, remembers its position; hover (or keyboard focus) reveals the word "Restore"
- **Export files are more complete**: besides every site's settings they now include the plugin settings (default title, default icon) and the version at export time; the file name looks like `pagemask-0.4.0-20261030120000.json`
- **The whole interface is bilingual**: the popup, management pages, wizard and on-page controls all have Chinese and English; pick the interface language ("follow the browser" / 简体中文 / English) in Settings and it takes effect immediately

#### Fixed

- **The tab title is no longer fought over**: on sites that rewrite their title in a loop, PageMask now writes back at a controlled rate; if the site simply won't yield (a timer keeps resetting it), PageMask lets go entirely — the browser stays smooth, no more freezing

## [0.3.0] - 2026-10-28

真实使用一周后的反馈批次：加不进去的网站、只想改标题的网站、向导不好用的地方，以及一个应急能力。/ A batch of fixes and features from a week of real use: sites that could not be added, sites that only needed a new tab title, wizard friction, and one emergency capability.

### 中文

#### 修复

- **新站点授权后直接进入设置向导**：原来点「允许」之后什么都不发生，得再点一次扩展图标（权限确认框会关闭扩展弹窗，后面的步骤没能继续）。现在弹窗只发一条消息，由后台在用户手势里请求权限并接着完成注入与开向导，一次点击即可
- **「已收起 0 项」这类写法**：只想改标题的网站没有任何收起项，现在显示「没有收起任何内容」

#### 新增

- **只想改标签页标题也可以**：popup 新增「设置标题和图标」，直接进管理页把标题、图标填好保存，一个元素都不用收起
- **管理页拆成「网站」与「设置」两个 tab**：网站是已添加网站的列表，点进去是这个网站的设置页（开关、标签页标题、图标、已收起的项、一键清空）；设置里放全局默认标题与导出 / 导入
- **站点设置页**：已收起的项可以删除（5 秒内可撤销），换收起方式与重选元素仍然在页面上做（那里才有上下文）
- **设置向导更顺手**：点选阶段新增「清空」，一步清掉已选；「退出」改叫「取消」，确认框里危险按钮改成红色实底，安全按钮默认聚焦
- **预览清单行内编辑**：每一行直接换收起方式、改名、删除；范围标签显示「同类 3 处」这样的命中数，点一下只收起这一处
- **三种收起方式的界面叫法改为「消失 / 留空 / 盖住」**：消失 = 下面的内容往上补；留空 = 位置留着不动；盖住 = 盖一块和背景同色的板
- **幕布**：一键把整页连同标签页标题一起遮住，再一键回到点击前的样子（原来是什么状态就回什么状态）。没添加过的网站也能用：popup 点「遮住本页」，当场遮住，不留任何配置

#### 工程

- 元素命名改进：文字都在子元素里的容器不再叫「div 元素」
- E2E 覆盖管理页三视图、预览清单、幕布（含未添加站点的一次性脚本）；测试收尾失败不再影响用例结论

### English

#### Fixed

- **Adding a new site now opens the setup wizard right away**: after clicking "Allow" nothing used to happen and you had to click the extension icon again (the permission prompt closes the popup, so the following steps never ran). The popup now only sends a message; the background asks for permission inside the user gesture and then injects and opens the wizard in one go
- **Wording like "0 items hidden"**: a site that only changes its tab title has nothing hidden — it now says "nothing hidden"

#### Added

- **Tab title only is fine**: the popup gains "Set tab title & icon" — open the management page, fill in the title and icon, save, and not a single element is hidden
- **The management page splits into "Sites" and "Settings" tabs**: Sites lists the sites you added; clicking one opens its settings page (switch, tab title, icon, hidden items, reset). Settings holds the default title and export / import
- **Site settings page**: hidden items can be deleted (undo for 5 seconds); changing the hide method and re-picking an element still happen on the page itself, where the context is
- **A smoother wizard**: "Clear" empties your selection in one click; "Exit" is now "Cancel"; the destructive button in the confirmation is solid red and the safe button has focus
- **Inline editing in the preview list**: change the hide method, rename and delete right on each row; the scope label shows how many match ("3 alike"), and one click hides just this one
- **Hide methods are now "Disappear / Keep space / Cover"**: disappear pulls the following content up; keep space leaves the gap; cover puts a sticker the colour of the background over it
- **Curtain**: cover the whole page and the tab title in one click, and go back exactly to what it was before. It works on sites you have not added too — "Cover this page" in the popup covers it on the spot and leaves no configuration behind

#### Engineering

- Better element names: containers whose text lives in child elements no longer become "div element"
- E2E now covers the three management views, the preview list, and the curtain (including the one-shot script for un-added sites); cleanup failures no longer affect the verdict

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

[0.4.0]: https://github.com/cherishfall/page-mask/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/cherishfall/page-mask/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/cherishfall/page-mask/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/cherishfall/page-mask/releases/tag/v0.1.0
