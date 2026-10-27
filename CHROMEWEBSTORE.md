# Chrome Web Store 提交材料

本文件是提交 Chrome 应用商店的唯一依据：名称与简介、详细描述、权限理由、单一用途、审核员测试步骤、隐私表单填法、版本历史与素材清单。
提交时逐项复制粘贴；控制台里的选项与本文不一致时，以本文为准并回来更新这里。

## 0. 提交前清单

- [x] `npm run build && npm run zip && npm run check:package` 通过（`check-package` 校验产物 manifest 没有 `content_scripts` / `host_permissions`、图标齐全、多语言键一致）
- [x] 版本号已改（`package.json` → `0.2.0`，产物 `page-mask-0.2.0-chrome.zip`，22 个文件），`CHANGELOG.md` 有对应版本的双语条目
- [ ] 隐私政策 URL 可访问：<https://github.com/cherishfall/page-mask/blob/master/PRIVACY.md>（仓库公开后可访问，提交前再点一次）
- [x] 5 张截图与宣传图块已按 §8 重拍（`docs/store-assets/`，全部 1280×800 / 440×280）
- [x] §6 的测试步骤已在真实 Chrome + Wikipedia 首页走通（结果见 §6 末）
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
• 三种收起方式：彻底移除（下方内容上移）、原地留白（保留位置）、遮罩覆盖（盖一块与背景同色的贴片，不改网站自身样式）
• 保存前预览：每个元素都能单独换收起方式，满意再保存
• 生效范围：整站，或只在 / 排除某一类页面
• 标签页标题与图标：可为该网站自定义标签页标题和图标
• 每个网站一个开关：页面角落的小胶囊一点即可切回原样，同一网站的所有标签页一起切换
• 失效提醒：网站改版导致某条规则找不到目标时，会提醒你重新选择
• 导出 / 导入：全部配置导出为一个文件，换电脑后导入

【怎么用】
1. 打开想变清爽的网站，点工具栏的 PageMask 图标
2. 点「为当前网站开启清爽模式」，在 Chrome 的授权提示里点「允许」
3. 点选要收起的元素 →「预览」→「保存」
4. 想看原样，点页面右下角的小胶囊；想改规则，点它的「⋯」→「编辑规则」，或从图标菜单点「编辑当前网站」

【隐私与权限】
• 只对你添加的网站生效；没添加的网站，PageMask 不会运行任何内容
• 访问某个网站的权限只在你点「为当前网站开启清爽模式」时申请，而且只申请这一个网站
• 所有配置只保存在你的浏览器里；PageMask 自身不发起任何网络请求，没有统计，没有第三方代码
• 隐私政策：https://github.com/cherishfall/page-mask/blob/master/PRIVACY.md

【说明】
• 界面目前为简体中文
• 不支持浏览器内部页面、本地文件和 Chrome 应用商店页面；iframe 和 shadow DOM 里的元素暂时无法选择
• 反馈与支持：https://github.com/cherishfall/page-mask/issues
```

### en-US

```
PageMask declutters the sites you choose: point at the distracting parts of a page, click, and they're gone.

FEATURES
• Point-and-click hiding: hover to highlight, click to select (multi-select), use "bigger / smaller" to adjust the selection. No code needed
• Three ways to hide: Remove (content below moves up), Blank (keeps the space), Cover (a solid patch matching the background; the site's own styles are left untouched)
• Preview before saving: change the hiding method per element, then save
• Scope: the whole site, only a type of page, or everything except a type of page
• Tab title & icon: set a custom tab title and icon for the site
• One switch per site: a small on-page capsule flips back to the original page; all tabs of that site switch together
• Broken-rule notices: if a site redesign means a rule no longer finds its target, you're asked to re-pick it
• Export / import: move all your settings to another computer as one file

HOW TO USE
1. Open the site and click the PageMask toolbar icon
2. Click 「为当前网站开启清爽模式」 (Enable clean mode for this site) and choose Allow in Chrome's prompt
3. Click the elements to hide → 预览 (Preview) → 保存 (Save)
4. To see the original page, click the small capsule at the bottom-right; to edit rules, click 「⋯」→「编辑规则」 (Edit rules) on it, or 「编辑当前网站」 (Edit this site) from the toolbar icon menu

PRIVACY & PERMISSIONS
• Runs only on sites you add. On every other site, PageMask runs nothing
• Access to a site is requested only when you enable it, and only for that one site
• Settings are stored only in your browser. PageMask itself makes no network requests, has no analytics and no third-party code
• Privacy policy: https://github.com/cherishfall/page-mask/blob/master/PRIVACY.md

NOTES
• The interface is currently in Simplified Chinese
• Doesn't run on browser pages, local files or the Chrome Web Store; elements inside iframes/shadow DOM can't be picked yet
• Support: https://github.com/cherishfall/page-mask/issues
```

## 3. 权限逐项理由（控制台「权限理由」逐字段粘贴）

- **storage**: Saves the user's settings for each site they add (which page elements to hide, how, on which pages, the tab title/icon they chose, the on/off state) in `chrome.storage.local` on the device. Nothing is synced or sent anywhere.
- **scripting**: For sites the user has explicitly enabled only: (1) registers PageMask's bundled content script for that site's pages, (2) runs it once in the already-open tab right after the user enables the site, and (3) inserts/removes the user's hiding stylesheet (`insertCSS`/`removeCSS`) when the user switches the site between clean and original. No remote code is ever executed.
- **activeTab**: When the user opens the popup, it reads the active tab's URL to show which site it is, whether it's supported (browser pages, local files and the Web Store are not), and whether it is already configured. No other tab is accessed.
- **Host permissions (optional, declared as `*://*/*`)**: Declared broadly only because the user may enable any site they choose; **nothing is granted at install**. When the user clicks 「为当前网站开启清爽模式」, PageMask calls `chrome.permissions.request` for that single origin (e.g. `https://example.com/*`). The grant is used only to run the content script and apply the user's hiding styles and tab title/icon on that origin. Resetting a site in the management page removes that origin's permission.

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
What it does: lets the user hide page elements they pick on sites they explicitly add, with an optional custom tab title/icon for those sites. UI is in Simplified Chinese.

Permissions model: no host access and no content script are registered at install. The built manifest contains no content_scripts and no host_permissions. The popup button 「为当前网站开启清爽模式」 ("Enable clean mode for this site") calls permissions.request for that single origin; only after the user allows it does PageMask register the bundled content script (scripting.registerContentScripts, scoped to that origin) and inject the hiding styles there.

Hiding is done with scripting.insertCSS (user origin) using the selectors the user picked; the "cover" method adds a solid overlay element inside a shadow root. The tab title/icon are changed only on enabled sites while that site's switch is on, and restored when switched off.

No network requests, no analytics, no remote code, no bundled site rules. All data stays in chrome.storage.local.

Test steps (no login needed):
1. Open https://en.wikipedia.org/wiki/Main_Page, click the PageMask icon, click the blue button, choose Allow.
2. The setup wizard appears. Click on the "From today's featured article" box (or the picture inside it — whichever you prefer to hide) → 「预览」 (Preview) → 「保存」 (Save) → 「保存」 (Save).
3. The picked element is hidden and the tab title changes to "Reading" («阅读» when Chrome's UI language is Chinese). Click the left part of the small capsule at the bottom-right to switch back to the original page: the element reappears and the title reverts.
4. Click 「⋯」 on the capsule → 「编辑规则」 (Edit rules) opens the on-page rule editor; press Esc to close it.
5. Toolbar icon → 「管理全部网站」 (Manage all sites) → 「一键清空」 (Reset) removes that site's settings and its permission.
```

**已实走（2026-10-27）**：用 Chrome for Testing 157 + 本仓库 0.2.0 构建，在匿名可访问的 Wikipedia 首页按上面 5 步完整跑通（点选 → 预览 → 保存 → 切换原样 → 编辑规则 → 一键清空），每一步的页面效果、标题变化、配置落库与清空后的还原都核对过。第 1 步的「点图标 + 授权弹窗」在自动化里用等价的 `enableSite` 消息代替，弹窗本身仍需人工点一次确认。

## 7. 版本历史

| 版本 | 日期 | 要点 |
|---|---|---|
| 0.2.0 | 2026-10-27 | 上架前质量加固：遮罩覆盖、设置向导、编辑规则、悬浮按钮的可用性修复，无障碍与对比度，文档一致性。详见 `CHANGELOG.md` |
| 0.1.0 | 2026-10-26 | 首个功能完整版本（未提交商店） |

## 8. 截图与素材清单

商店要求：截图 1280×800（或 640×400），3–5 张；小型宣传图块 440×280 可选但建议。

| 素材 | 文件 | 说明 |
|---|---|---|
| 商店图标 128×128 | `public/icon/128.png`（同步 `docs/store-assets/icon-128.png`） | ✅ 已在 manifest 里（`npm run icons` 从 `assets/icon/*.svg` 生成） |
| 截图 1（首图） | `docs/store-assets/screenshot-1-before-after.png` | ✅ 1280×800：「之前 / 之后」并排，32px 大字标题 |
| 截图 2 | `docs/store-assets/screenshot-2-wizard.png` | ✅ 1280×800：设置向导预览（号码牌 + 草稿清单 + 底部工具条） |
| 截图 3 | `docs/store-assets/screenshot-3-tabbar.png` | ✅ 1280×800：标签栏里两个标签页（原样 / 清爽），展示标题与图标 |
| 截图 4 | `docs/store-assets/screenshot-4-popup.png` | ✅ 1280×800：popup 正常状态（有规则、清爽模式开、有编辑入口） |
| 截图 5 | `docs/store-assets/screenshot-5-management.png` | ✅ 1280×800：管理页，虚构域名与数字 |
| 宣传图块 440×280 | `docs/store-assets/promo-tile-440x280.png` | ✅ 新图标 + 一句话定位，无 emoji |

重新生成：`npm run build && node tests/e2e/store-shots.mjs`（输出直接覆盖 `docs/store-assets/`）。

素材口径（避免误导）：

- 页面截图是扩展在**虚构站点**「Acme 书房」上真实生效后的画面，站点名、书名、评分为占位内容，不含任何第三方商标、真人照片或用户内容。
- 「之前 / 之后」与 popup 两张是拼版：每一块都来自上面的真实截图或扩展自己的图标资源，没有画假界面。
- 标签栏那张的浏览器边框是拼版出来的示意（headless 截不到真实标签栏），但标题文字与图标就是扩展在该页面上实际设置的值（标题「阅读」、透明图标）。
- 尺寸全部 1280×800（PNG）；宣传图块 440×280。

## 9. 已知限制（写给审核员，也写给用户）

- 界面目前为简体中文；英文文案已全部就位（`public/_locales/en`），但页面内控件仍是中文。
- 不支持 `chrome://` 内部页面、`file://` 本地文件、Chrome 应用商店页面。
- iframe 与 shadow DOM 内部的元素暂时无法点选。
- 标签页悬停缩略图、浏览器历史记录里的标题是浏览器自身行为，扩展改不到。

## 10. review-checklist 自查结论

按 `chrome-extensions` skill 的 pre-publish checklist 逐项过了一遍（0.2.0，2026-10-27）：

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
