# Chrome Web Store 提交材料

本文件是提交 Chrome 应用商店的唯一依据：名称与简介、详细描述、权限理由、单一用途、审核员测试步骤、隐私表单填法、版本历史与素材清单。
提交时逐项复制粘贴；控制台里的选项与本文不一致时，以本文为准并回来更新这里。

> 最后更新：2026-10-30 · 对应构建 **0.4.0**（`.output/page-mask-0.4.0-chrome.zip`）

## 0. 提交前清单

- [x] `npm ci && npm run build && npm run zip && npm run check:package` 通过（`check-package` 校验产物 manifest 没有 `content_scripts` / `host_permissions`、图标齐全、多语言键一致）；产物：`.output/page-mask-0.4.0-chrome.zip`（27 个文件 / 192 KB）
- [x] 版本号已改（`package.json` → `0.4.0`），`CHANGELOG.md` 有对应版本的双语条目，tag `v0.4.0` 待提交后推送
- [ ] 隐私政策 URL 可访问：<https://github.com/cherishfall/page-mask/blob/master/PRIVACY.md>（仓库公开后可访问，提交前再点一次）
- [x] 6 张截图与宣传图块已按 §8 重拍（`docs/store-assets/`，全部 1280×800 / 440×280）
- [ ] §6 的测试步骤在真实 Chrome 上重走一遍（0.4.0 界面：三步向导、两个独立管理页、⋯ 菜单四项、幕布恢复按钮）
- [ ] 隐私表单按 §5 填写（在控制台操作）
- [x] `npm run check:docs` 通过（用户可见文档无禁用词、内部链接有效）

## 1. 商店元数据

名称与简短说明**只能来自 `public/_locales/*/messages.json`**，控制台不能单独填写。

| 字段 | en（default_locale） | zh_CN |
|---|---|---|
| 名称（≤45） | `PageMask — Clean & Focused Pages`（32） | `PageMask · 页面清爽模式`（17） |
| 简短说明（≤132） | `Hide distracting page elements you pick, on sites you choose. Optional custom tab title and icon. Data stays in your browser.`（125） | `点选网页上让你分心的元素，一键收起；可为该网站自定义标签页标题和图标。只对你添加的网站生效，配置只存在本机。`（54） |

- 类别：`Productivity › Tools`（备选 `Make Chrome Yours › Functionality & UI`，以控制台当次选项为准）
- 语言：简体中文（主）+ English
- Support URL：<https://github.com/cherishfall/page-mask/issues>
- Homepage URL：<https://github.com/cherishfall/page-mask>
- 隐私政策 URL：<https://github.com/cherishfall/page-mask/blob/master/PRIVACY.md>
- 联系方式邮箱：`cherishfall@hotmail.com`

## 2. 详细描述

### zh-CN

```
PageMask 让你自己选的网站更清爽：用鼠标点选页面上让你分心的部分，一键收起。

【功能】
• 点选收起：鼠标悬停高亮、点击选中（可连选），用「选大一点 / 选小一点」调整范围，不需要懂任何代码
• 三步设置向导：先填标签页标题和图标（只改标题也可以），再点选要收起的内容，最后「看效果」确认——选中的内容列成清单、可逐项删掉，生效范围在这里定，保存即完成
• 三种收起方式：消失（下方内容上移）、留空（保留位置）、盖住（盖一块与背景同色的贴片，不改网站自身样式）
• 生效范围：整站，或只在 / 排除某一类页面
• 标签页标题与图标：可为该网站自定义标签页标题和图标；没单独设置的网站用插件默认图标
• 幕布：面板上的「遮住本页 / 恢复本页」一键把整页连同标签页标题一起遮住（例如有人走近时）；遮住后页面上是一颗可拖动的睁眼小按钮，点一下就恢复。没添加过的网站也能用
• 每个网站一个开关：页面右下角的小胶囊显示当前是「清爽」还是「原样」，点一下即可切换，同一网站的所有标签页一起切换
• 页面内编辑：小胶囊「⋯」菜单就地改标签页标题和图标、编辑收起的内容（改收起方式、改生效范围、重选元素、删除 5 秒内可撤销）
• 设置分成两个页面：「你添加的网站」是网站列表，点进去是一个网站的设置页；「插件设置」放默认标题、默认图标、导出 / 导入、界面语言，也是 Chrome 的「扩展程序选项」
• 失效提醒：网站改版导致某条规则找不到目标时，会提醒你重新选择
• 中英双语：面板、管理页、向导与页面内的按钮都有中文和英文，可在插件设置里选界面语言
• 导出 / 导入：全部网站设置和插件设置导出为一个文件（文件名带版本号与导出时间），换电脑后导入

【怎么用】
1. 打开想变清爽的网站，点工具栏的 PageMask 图标
2. 点「为当前网站开启清爽模式」，在 Chrome 的授权提示里点「允许」
3. 三步向导：填标签页标题和图标（可跳过）→ 点选要收起的内容 → 「看效果」确认，保存即完成
4. 想看原样，点页面右下角小胶囊上的「清爽 / 原样」；想改收起的内容，点胶囊上的「⋯」→「编辑收起的内容」，或从工具栏图标里点「编辑当前网站」

【隐私与权限】
• 只对你添加的网站生效；没添加的网站，PageMask 不会运行任何内容
• 访问某个网站的权限只在你点「为当前网站开启清爽模式」时申请，而且只申请这一个网站
• 所有设置只保存在你的浏览器里；PageMask 自身不发起任何网络请求，没有统计，没有第三方代码
• 隐私政策：https://github.com/cherishfall/page-mask/blob/master/PRIVACY.md

【说明】
• 界面语言默认跟随浏览器，可在插件设置里切换简体中文 / English
• 不支持浏览器内部页面、本地文件和 Chrome 应用商店页面；iframe 和 shadow DOM 里的元素暂时无法选择
• 反馈与支持：https://github.com/cherishfall/page-mask/issues
```

### en-US

```
PageMask declutters the sites you choose: point at the distracting parts of a page, click, and they're gone.

FEATURES
• Point-and-click hiding: hover to highlight, click to select (multi-select), use "bigger / smaller" to adjust the selection. No code needed
• Three-step setup wizard: first the tab title and icon (title only is fine), then pick what to hide, then "Check the result" — everything picked is listed and can be removed one by one, the scope is decided here, and saving finishes it
• Three hide methods: disappear (content below moves up), keep space (position preserved), cover (a patch the colour of the background over the element, leaving the site's own styles untouched)
• Scope: the whole site, only a type of page, or everything except a type of page
• Tab title & icon: custom tab title and icon per site; sites without their own icon use the default icon
• Curtain: the "Cover this page / Restore this page" switch covers the whole page and the tab title in one click (say, when someone walks over); a small draggable open-eye button stays on the page — one click restores it. Works on sites you have not added either
• One switch per site: the small capsule at the bottom-right shows 「清爽」 (Clean) or 「原样」 (Original); one click flips it, and all tabs of that site switch together
• On-page editing: the capsule's "⋯" menu edits the tab title and icon in place, or edits what's hidden (change the hide method or scope, re-pick an element, delete with 5-second undo)
• Settings split into two pages: "Your sites" lists the sites you added — click one for its settings page; "Settings" holds the default title, default icon, export / import and interface language, and is registered as Chrome's "Options" page
• Broken-rule notices: if a site redesign means a rule no longer finds its target, you're asked to re-pick it
• Bilingual: the popup, management pages, wizard and on-page controls all have Chinese and English; pick the interface language in Settings
• Export / import: move all site settings plus the plugin settings to another computer as one file (the file name carries the version and the export time)

HOW TO USE
1. Open the site and click the PageMask toolbar icon
2. Click 「为当前网站开启清爽模式」 (Turn on clean mode for this site) and choose Allow in Chrome's prompt
3. Three-step wizard: fill in the tab title and icon (skippable) → pick what to hide → "Check the result" and save
4. To see the original page, click 「清爽 / 原样」 on the small capsule at the bottom-right; to edit what's hidden, click 「⋯」→「编辑收起的内容」 (Edit hidden items) on the capsule, or 「编辑当前网站」 (Edit this site) from the toolbar icon

PRIVACY & PERMISSIONS
• Runs only on sites you add. On every other site, PageMask runs nothing
• Access to a site is requested only when you enable it, and only for that one site
• Settings are stored only in your browser. PageMask itself makes no network requests, has no analytics and no third-party code
• Privacy policy: https://github.com/cherishfall/page-mask/blob/master/PRIVACY.md

NOTES
• The interface language follows the browser by default; switch to Simplified Chinese or English in Settings
• Doesn't run on browser pages, local files or the Chrome Web Store; elements inside iframes/shadow DOM can't be picked yet
• Support: https://github.com/cherishfall/page-mask/issues
```

## 3. 权限逐项理由（控制台「权限理由」逐字段粘贴）

- **storage**: Saves the user's settings for each site they add (which page elements to hide, how, on which pages, the tab title/icon they chose, the on/off state) in `chrome.storage.local` on the device. Nothing is synced or sent anywhere.
- **scripting**: For sites the user has explicitly enabled only: (1) registers PageMask's bundled content script for that site's pages, (2) runs it once in the already-open tab right after the user enables the site, and (3) inserts/removes the user's hiding stylesheet (`insertCSS`/`removeCSS`) when the user switches the site between clean and original. No remote code is ever executed.
- **activeTab**: When the user opens the popup, it reads the active tab's URL to show which site it is, whether it's supported (browser pages, local files and the Web Store are not), and whether it is already configured. No other tab is accessed.
- **Host permissions (optional, declared as `*://*/*`)**: Declared broadly only because the user may enable any site they choose; **nothing is granted at install**. When the user clicks 「为当前网站开启清爽模式」, PageMask calls `chrome.permissions.request` for that single origin (e.g. `https://example.com/*`). The grant is used only to run the content script and apply the user's hiding styles and tab title/icon on that origin. Deleting that site's settings (from the site's settings page, or the capsule's ⋯ menu on the page) removes the origin's permission.

## 4. 单一用途（Single purpose）

```
Declutters websites the user chooses: it hides page elements the user picks (with optional custom tab title and icon for that site), and does nothing on sites the user has not added.
```

## 5. 隐私表单填法

控制台分两组，别混：

1. **数据类型**（你处理哪些用户数据）：勾选 **Website content** 与 **Web history**。
   - Website content：为了让你点选元素、以及核对规则是否仍然命中，扩展会读取你已添加网站的页面结构；短标签（最多 8 字符）会存在本机。
   - Web history：站点配置里保存了网站地址与生效页面的路径前缀。
   - 勾选后需要在「隐私政策」中说明用途；`PRIVACY.md` 已写明「只存本机、不上传」。
2. **三条证明**（与是否收集无关，**全部勾选**）：
   - 不出售或转让给第三方（批准的用途除外）
   - 不用于与单一用途无关的目的
   - 不用于判断信用或放贷
   - 并勾选「遵守 Chrome 应用商店用户数据政策（含 Limited Use 要求）」——`PRIVACY.md` 的 "What we don't do" 一节已有对应声明。

## 6. 审核员备注（Notes / Test instructions）

```
What it does: lets the user hide page elements they pick on sites they explicitly add, with an optional custom tab title/icon for those sites. UI is bilingual (Chinese and English; the interface language follows the browser and can be switched in Settings).

Permissions model: no host access and no content script are registered at install. The built manifest contains no content_scripts and no host_permissions. The popup button 「为当前网站开启清爽模式」 ("Turn on clean mode for this site") calls permissions.request for that single origin; only after the user allows it does PageMask register the bundled content script (scripting.registerContentScripts, scoped to that origin) and inject the hiding styles there.

Hiding is done with scripting.insertCSS (user origin) using the selectors the user picked; the "cover" method adds a solid overlay element inside a shadow root. The tab title/icon are changed only on enabled sites while that site's switch is on, and restored when switched off.

No network requests, no analytics, no remote code, no bundled site rules. All data stays in chrome.storage.local.

Test steps (no login needed):
1. Open https://en.wikipedia.org/wiki/Main_Page, click the PageMask icon, click the blue button, choose Allow.
2. The setup wizard opens at step 1 of 3 (tab title and icon). Click 下一步 (Next) to skip it.
3. Step 2: click on the "From today's featured article" box (or any element you'd like to hide) — it is highlighted and listed in the toolbar's picked list. Click 「下一步：看效果」 (Next: check the result).
4. Step 3: the picked element is hidden with ghost markers; the list on the right lets you change the hide method or delete an item, and the scope radio buttons are on this step too. Click 保存 (Save). The element is hidden and the tab title changes to "Reading" («阅读» when Chrome's UI language is Chinese).
5. Click 「清爽 / 原样」 (Clean / Original, the left part of the small capsule at the bottom-right) to switch back: the element reappears and the title reverts.
6. Click 「⋯」 on the capsule. The menu has four items: 「标签页标题和图标」 (Tab title and icon — opens an in-place editor), 「编辑收起的内容」 (Edit hidden items — opens the on-page editor; press Esc to close it), 「按钮放回右下角」 (put the button back at the bottom-right) and 「删除这个网站的设置」 (Delete this site's settings, in red — removes the site's settings and its permission).
7. Toolbar icon → the popup shows the clean-mode switch, 「遮住本页」 (Cover this page — the whole page is covered and only a small open-eye button remains; click it to restore) and two entries at the bottom: 「管理全部网站」 (Manage all sites — the site list; a site's settings page has 「删除这个网站的设置」 in the footer) and 「插件设置」 (Settings — default title/icon, export / import, interface language).
```

**已实走（2026-10-27，0.2.0 构建）**：在匿名可访问的 Wikipedia 首页按当时 5 步完整跑通（点选 → 预览 → 保存 → 切换原样 → 编辑规则 → 一键清空），每一步的页面效果、标题变化、配置落库与清空后的还原都核对过。第 1 步的「点图标 + 授权弹窗」在自动化里用等价的 `enableSite` 消息代替，弹窗本身仍需人工点一次确认。
**0.4.0 待重走**：上面 7 步按 0.4.0 界面改写（三步向导、⋯ 菜单四项、幕布恢复按钮、两个独立管理页），提交前在真实 Chrome 上重走一遍并回填结果。

## 7. 版本历史

| 版本 | 日期 | 要点 |
|---|---|---|
| 0.4.0 | 2026-10-30 | 界面捋顺批次：面板只留三件事并新增「遮住本页 / 恢复本页」开关、设置拆成「你添加的网站」与「插件设置」两个独立页面（插件设置注册为扩展选项）、默认标签页图标三层生效、向导改三步（标题和图标 → 点选内容 → 看效果）、⋯ 菜单四项、「一键清空」改名「删除这个网站的设置」、幕布恢复按钮改为可拖动的睁眼图标、导出文件带插件设置与版本号、全界面中英双语与界面语言设置。详见 `CHANGELOG.md` |
| 0.3.0 | 2026-10-28 | 真实使用反馈批次：新站点授权后直接进入向导、只想改标题也能配置、站点设置页、向导清空与取消、预览清单行内编辑、幕布（含未添加网站）。详见 `CHANGELOG.md` |
| 0.2.0 | 2026-10-27 | 上架前质量加固：遮罩覆盖、设置向导、编辑规则、悬浮按钮的可用性修复，无障碍与对比度，文档一致性。构建产物 `.output/page-mask-0.2.0-chrome.zip`（22 个文件 / 115 KB），tag `v0.2.0`。详见 `CHANGELOG.md` |
| 0.1.0 | 2026-10-26 | 首个功能完整版本（未提交商店） |

## 8. 截图与素材清单

商店要求：截图 1280×800（或 640×400），3–5 张；小型宣传图块 440×280 可选但建议。

| 素材 | 文件 | 说明 |
|---|---|---|
| 商店图标 128×128 | `public/icon/128.png`（同步 `docs/store-assets/icon-128.png`） | ✅ 已在 manifest 里（`npm run icons` 从 `assets/icon/*.svg` 生成） |
| 截图 1（首图） | `docs/store-assets/screenshot-1-before-after.png` | ✅ 1280×800：「之前 / 之后」并排，32px 大字标题 |
| 截图 2 | `docs/store-assets/screenshot-2-wizard.png` | ✅ 1280×800：三步向导第 2 步（点选，选中项列成清单）与第 3 步（看效果，逐项编辑 + 生效范围）并排 |
| 截图 3 | `docs/store-assets/screenshot-3-tabbar.png` | ✅ 1280×800：标签栏里两个标签页（原样 / 清爽），展示标题与图标 |
| 截图 4 | `docs/store-assets/screenshot-4-popup.png` | ✅ 1280×800：面板正常状态（清爽开关、＋ 收起更多内容、编辑当前网站、遮住本页、底部两个入口） |
| 截图 5 | `docs/store-assets/screenshot-5-management.png` | ✅ 1280×800：「你添加的网站」（网站列表）与「插件设置」两个独立页面并排 |
| 截图 6 | `docs/store-assets/screenshot-6-curtain.png` | ✅ 1280×800：小胶囊「⋯」菜单四项 + 遮住整页后的睁眼恢复按钮（悬停显出「恢复」） |
| 宣传图块 440×280 | `docs/store-assets/promo-tile-440x280.png` | ✅ 新图标 + 一句话定位，无 emoji |

重新生成：`npm run build && CHROME_ARGS="--no-sandbox --disable-gpu" node tests/e2e/store-shots.mjs`（输出直接覆盖 `docs/store-assets/`）。
商店控制台最多传 5 张截图时，优先传 1 / 2 / 4 / 5 / 6（首图、向导、面板、两个管理页、菜单与幕布）。

素材口径（避免误导）：

- 页面截图是扩展在**虚构站点**「Acme 书房」上真实生效后的画面，站点名、书名、评分为占位内容，不含任何第三方商标、真人照片或用户内容。
- 「之前 / 之后」、popup、两个管理页与「菜单 + 幕布」都是拼版：每一块都来自上面的真实截图或扩展自己的图标资源，没有画假界面。
- 标签栏那张的浏览器边框是拼版出来的示意（headless 截不到真实标签栏），但标题文字与图标就是扩展在该页面上实际设置的值（标题「阅读」、透明图标）。
- 尺寸全部 1280×800（PNG）；宣传图块 440×280。

## 9. 已知限制（写给审核员，也写给用户）

- 界面语言默认跟随浏览器（简体中文 / English 两套文案），可在插件设置里切换。
- 不支持 `chrome://` 内部页面、`file://` 本地文件、Chrome 应用商店页面。
- iframe 与 shadow DOM 内部的元素暂时无法点选。
- 标签页悬停缩略图、浏览器历史记录里的标题是浏览器自身行为，扩展改不到。
- 幕布只挡视线不挡输入：视频全屏、页面内对话框会盖住幕布；键盘焦点仍在页面中，继续打字仍会改动页面内容；刷新或离开页面后幕布消失。

## 10. 审核员可能问的问题（提交前先想好答案）

| 问题 | 回答 |
|---|---|
| 为什么要声明 `*://*/*`？范围太大了 | 用户可能想对任意一个网站生效，声明时只能先报一个足够宽的范围；**安装时一个站点都不授予**，只有用户点「为当前网站开启清爽模式」并选「允许」后，才按单个 origin 请求，代码里没有任何地方用 `permissions.request` 申请多个站点（管理页的「一次授权全部」也只是一个用户手势内的多 origin 请求，且只包含用户自己导入/已配置的站点）。 |
| 为什么安装后看不到内容脚本？ | 内容脚本不写死在 manifest 里，而是用户授权后用 `scripting.registerContentScripts` 按 source 动态注册。这样未添加的网站上扩展完全不运行，安装时也只有一个「读取和更改您在 xxx 上的数据」之外的零警告（实测 `getPermissionWarningsByManifest` 返回空数组）。 |
| 扩展会改网页内容吗？ | 只是「做减法」：用 `scripting.insertCSS` 注入用户自己点选出来的选择器（`display:none` / 透明占位 / 盖一块与背景同色的遮罩），以及可选地替换标签页标题与图标。不改网页原有 DOM、不发请求、不注入远程代码。 |
| 会不会收集浏览记录？ | 不收集。网站地址存在本机 `chrome.storage.local`（用户配置的一部分），不上传、不同步（没用 `storage.sync`）。 |
| 为什么能改标签页标题/图标？ | 这是产品功能之一（`document.title` + `link[rel=icon]`），只对用户已开启且开关为「清爽」的网站生效；切回原样或卸载后立刻还原。 |
| 关闭扩展后页面会残留样式吗？ | 不会：切回原样、「删除这个网站的设置」、卸载都会撤掉注入的样式；E2E 覆盖了「删除设置后已打开页面立即恢复原样」。 |

## 11. review-checklist 自查结论

按 `chrome-extensions` skill 的 pre-publish checklist 逐项过了一遍（0.2.0，2026-10-27）。0.4.0 的权限集与打包方式没有变化，结论仍然适用；提交前按 §0 清单对版本号、截图与测试步骤复核一遍即可：

### Manifest 与打包

| 项 | 结论 |
|---|---|
| manifest_version 3 | ✅ 产物 manifest `"manifest_version": 3` |
| 版本号已递增 | ✅ `0.2.0`（0.1.0 从未提交商店，这是首次提交的版本） |
| manifest 名称与本文一致 | ✅ 名称/简介来自 `_locales`，与 §1 表格一致（控制台不可单独填写） |
| 简介 ≤132 字符 | ✅ en 125 / zh_CN 54 |
| ZIP 无多余文件 | ✅ 22 个文件，只含运行文件：`manifest.json`、`background.js`、`content-scripts/content.js`、`chunks/*`、`assets/*.css`、`*.html`、`icon/*`、`_locales/*`、`THIRD_PARTY_NOTICES.txt`；无 `.map`、无 `README`/`CHANGELOG`/`CHROMEWEBSTORE.md`、无测试与配置 |
| ZIP < 2GB | ✅ 115 KB |
| 无绝对路径 | ✅ manifest 内路径全部相对 |
| 无 eval / 远程代码 | ✅ 全部 JS 打包在包内，无 `eval`/`new Function`，无远程脚本 |

### 权限

| 项 | 结论 |
|---|---|
| 最小权限 | ✅ 只有 `storage` / `scripting` / `activeTab`；`optional_host_permissions` 声明 `*://*/*` 但安装时不授予任何站点 |
| 每个权限有具体理由 | ✅ §3 逐项 |
| activeTab 用法正确 | ✅ 只用于 popup 读当前标签页网址；注入靠按站点授予的主机权限 |
| 无多余权限 | ✅ 没有 `tabs`、`management`、`downloads` 等 |
| 安装时无权限警告 | ✅ E2E 里 `getPermissionWarningsByManifest` 返回 `[]` |
| 主机权限逐项说明 | ✅ §3 第 4 条解释了为什么声明 `*://*/*`、实际只申请单个 origin |

### 商店文案

| 项 | 结论 |
|---|---|
| 详细描述具体 | ✅ 逐条功能 + 怎么用 + 隐私，无空话 |
| 单一用途窄 | ✅ §4 一句话 |
| 无夸大/不实 | ✅ 已删掉「任何网站都可用」「无任何网络请求」等不实说法；改为「PageMask 自身不发起任何网络请求」 |
| 无关键词堆砌 | ✅ 品牌词只出现在需要的地方 |
| 无商标问题 | ✅ 截图与文案里没有第三方品牌、真人照片、用户内容 |
| 联系邮箱有效 | ⚠️ `cherishfall@hotmail.com` 需用户确认能收到 CWS 通知 |

### 图形素材

| 项 | 结论 |
|---|---|
| 商店图标 128×128 | ✅ `public/icon/128.png`，四尺寸齐全（16/32/48/128） |
| 至少 1 张 1280×800 | ✅ 5 张 |
| 截图与当前界面一致 | ✅ 全部由 0.2.0 构建实拍/拼版 |
| 不误导 | ✅ 虚构站点；标签栏为示意拼版（见 §8 口径说明） |
| 无手机/平板样张 | ✅ 没有 |
| 宣传图块 440×280 | ✅ |

### 隐私与合规

| 项 | 结论 |
|---|---|
| 数据披露与代码一致 | ✅ 只写 `chrome.storage.local`；不使用 `storage.sync`；无网络请求 |
| 隐私政策 URL 可用 | ⚠️ 仓库公开后可用，提交前再点一次 |
| 政策与表单一致 | ✅ 表单勾 Website content + Web history，政策里逐项写了对应数据 |
| 不使用远程代码 | ✅ |
| 代码未混淆 | ✅ 仅压缩（WXT 默认） |

### 功能

| 项 | 结论 |
|---|---|
| 功能可用 | ✅ `npm test` 427 项、`npm run test:e2e`（主流程 98 项 + 各界面专项 79/16/31/19/28）全绿 |
| 无崩溃/空白页 | ✅ popup、管理页、引导页、内容脚本都有 E2E |
| 目标站点可用 | ✅ Wikipedia 首页实走（§6） |
| 边界情况 | ✅ 内部页/本地文件/商店页有明确提示；无配置时零注入 |
| 卸载干净 | ✅ 卸载删除 storage.local 与动态注册；页面无残留（一键清空路径有 E2E） |
| 资源占用 | ✅ 静止页面内容脚本 2 秒内 0 次 rAF；无 setInterval（单测守门） |

**仍需人工完成**：真实授权弹窗点「允许」的完整路径（品牌版 Chrome）、隐私表单在控制台勾选、提交前的隐私政策 URL 点验。
