# Chrome Web Store 提交材料

本文件是提交 Chrome 应用商店的唯一依据：名称与简介、详细描述、权限理由、单一用途、审核员测试步骤、隐私表单填法、版本历史与素材清单。
提交时逐项复制粘贴；控制台里的选项与本文不一致时，以本文为准并回来更新这里。

> 最后更新：2026-11-09 · 对应构建 **0.8.14**（`.output/page-mask-0.8.14-chrome.zip`）

## 0. 提交前清单

- [x] `npm ci && npm run build && npm run zip && npm run check:package` 通过（`check-package` 校验产物 manifest 没有 `content_scripts` / `host_permissions`、图标齐全、多语言键一致）；产物：`.output/page-mask-0.8.19-chrome.zip`
- [x] 版本号已改（`package.json` → `0.8.19`），`CHANGELOG.md` 有对应版本的双语条目，tag `v0.8.19`
- [ ] 隐私政策 URL 可访问：<https://github.com/cherishfall/page-mask/blob/master/PRIVACY.md>（仓库公开后可访问，提交前再点一次）
- [x] 6 张截图与宣传图块已按 §8 重拍（0.8.10：胶囊 0.8.6–0.8.9 形态与状态、弹窗 0.8.10 卡片分组，`store-shots.mjs` 全量重生成）
- [ ] §6 的测试步骤在真实 Chrome 上重走一遍（弹窗四块卡与两颗编辑入口「标题和图标」「收起内容」、按设置 / 原样、全部网站设置、允许访问；胶囊「媒体」钮与「遮住」钮；变灰开关在弹窗、站点设置页两处互通）
- [ ] 隐私表单按 §5 填写（在控制台操作）
- [x] `npm run check:docs` 通过（用户可见文档无禁用词、内部链接有效）

## 1. 商店元数据

名称与简短说明**只能来自 `public/_locales/*/messages.json`**，控制台不能单独填写。

| 字段 | en（default_locale） | zh_CN |
|---|---|---|
| 名称（≤45） | `PageMask — Hide the Parts You Don't Want`（40） | `PageMask · 收起网页上不想看的部分`（22） |
| 简短说明（≤132） | `Hide the page elements you don't want, on sites you choose. Optional tab title and icon. Settings stay on this computer.`（120） | `点选网页上不想看的元素把它们收起来，也可以改标签页标题和图标。只对你添加的网站生效，设置只存在这台电脑上。`（55） |

- 类别：`Productivity › Tools`（备选 `Make Chrome Yours › Functionality & UI`，以控制台当次选项为准）
- 语言：简体中文（主）+ English
- Support URL：<https://github.com/cherishfall/page-mask/issues>
- Homepage URL：<https://github.com/cherishfall/page-mask>
- 隐私政策 URL：<https://github.com/cherishfall/page-mask/blob/master/PRIVACY.md>
- 联系方式邮箱：`cherishfall@hotmail.com`

## 2. 详细描述

### zh-CN

```
PageMask 让你自己选的网站更清爽：用鼠标点选页面上不想看的部分，把它们收起来。

【功能】
• 点选收起：鼠标悬停高亮、点击选中（可连选），用「选大一点 / 选小一点」调整范围，不需要懂任何代码
• 收起内容分两步：先在页面上点选要收起的内容（已经收起的项也在清单里，点它就去掉），再「看效果」确认——选中的内容列成清单、可逐项去掉，在哪些页面收起也在这里定，保存即完成
• 标题和图标单独一个小表单：填完点「保存」，只想改标题的网站不必收起任何内容
• 三种收起方式：消失（整块不见，下面的内容往上顶）、留空（看不见了，但位置还占着）、盖住（原位盖一块和背景同色的方块，不改网站自身样式）
• 在哪些页面收起：整个网站，或只在这类页面 / 除了这类页面
• 标签页标题与图标：可为该网站设置标签页标题；图标三选一——网站原来的、不显示、或换成内置的 10 个图标之一
• 整页变灰：按网站的一个开关（悬浮按钮上的「媒体」钮、弹窗、站点设置页三处都能改）。整个页面变成黑白——文字、图片、视频、按钮、背景图全都一样，位置大小不变、链接还能点、文字照样读。会自动播放的视频会被暂停，点一下视频就能看。声音完全不参与——音量归播放器自己的按钮和 Chrome 右键「静音网站」。独立开关，不受「按你的设置显示」影响——切「原样」是把收起的内容和标签页标题图标还给你，灰度按自己的开关走
• 幕布：弹窗上的「遮住这一页 / 恢复这一页」把整页连同标签页标题一起遮住（比如有人走近时），并把这个标签页的声音一起静音；遮住后页面上是一颗可拖动的睁眼小按钮，点一下就恢复。没添加过的网站也能用
• 幕布快捷键：按一下遮住、再按一下恢复（默认 Ctrl+Shift+X，Mac 是 ⌘+Shift+X）；胶囊、弹窗、快捷键三个入口互相通用，任何一处遮住，另两处都能恢复
• 胶囊可调可藏：10%–100% 的不透明度滑杆（调它闲着的时候有多淡，鼠标移上去立刻清楚）；嫌占地方也可以在弹窗里按网站把它关掉
• 每个网站一个开关：点页面上的悬浮按钮，就在「按你的设置显示」和「原样」之间切换，同一网站的所有标签页一起变
• 页面内编辑：悬浮按钮的「⋯」菜单可以就地改标签页标题和图标；「收起内容」进设置面板的选内容一步，已收起的项直接进选择集，再「看效果」逐行换收起方式、换在哪些页面收起、重新选这一项，删掉的行随保存移除
• 设置分成两个页面：「全部网站设置」是网站列表，点进去是一个网站的设置页；「插件设置」放默认标题、导出 / 导入、界面语言，也是 Chrome 的「扩展程序选项」
• 删除入口齐全：弹窗最底部和「全部网站设置」每行的「⋯」菜单里都有「删除这个网站的设置」，不必先点进详情页
• 失效提醒：网站改版导致某一项找不到目标时，会提醒你重新选一次
• 中英双语：弹窗、管理页、设置与页面内的按钮都有中文和英文，可在插件设置里选界面语言
• 导出 / 导入：全部网站的设置和插件设置导出成一个文件（文件名带版本号与导出时间），换电脑后导入

【怎么用】
1. 打开要设置的网站，点工具栏的 PageMask 图标
2. 第一次用：在 Chrome 的提示里点「允许」——点「收起内容」或「标题和图标」时都会问这一次
3. 「收起内容」分两步：在页面上点选要收起的内容 → 「看效果」确认，保存即完成；「标题和图标」填完点「保存」
4. 想看网站原样，点悬浮按钮；想改收起的内容或标题图标，点弹窗里的「收起内容」「标题和图标」，或悬浮按钮旁边的「⋯」菜单；想让整个页面变黑白，点胶囊上的「媒体」钮，或在弹窗、站点设置页的「整页变灰」里拨开关，三处是同一组设置

【隐私与权限】
• 只对你添加的网站生效；没添加的网站，PageMask 不会运行任何内容
• 访问某个网站的权限只在你点「收起内容」或「标题和图标」时申请，而且只申请这一个网站
• 所有设置只保存在你的浏览器里；PageMask 自身不发起任何网络请求，没有统计，没有第三方代码
• 隐私政策：https://github.com/cherishfall/page-mask/blob/master/PRIVACY.md

【说明】
• 界面语言默认跟随浏览器，可在插件设置里切换简体中文 / English
• 「整页变灰」只是去掉颜色：页面内容照常加载，既不省流量，也不代替广告过滤工具。一条 CSS 规则像素级覆盖整页——背景图、canvas、iframe 内容、SVG、视频全部包含（0.8.18 起）；本扩展自己的悬浮按钮等界面也会跟着变黑白（功能不受影响）；`<audio>` 与一切声音不参与。视频的「点击放行」按最近一次点击位置判断，个别播放器结构特殊的站点可能需要直接点视频本体
• 幕布静音随幕布生灭：遮住即静音当前标签页，恢复（或刷新、离开页面）即还原；你自己用 Chrome 右键或播放器静音的不受影响
• 不支持浏览器内部页面、本地文件和 Chrome 应用商店页面；iframe 和 shadow DOM 里的元素暂时无法选择
• 反馈与支持：https://github.com/cherishfall/page-mask/issues
```

### en-US

```
PageMask declutters the sites you choose: point at the parts of a page you don't want, click, and they're gone.

FEATURES
• Point-and-click hiding: hover to highlight, click to select (multi-select), use "bigger / smaller" to adjust the selection. No code needed
• Hiding takes two steps: pick what to hide on the page (what you hid before is already in the list — click it to take it out), then "Check the result" — everything picked is listed and can be removed one by one, the pages it applies to are decided here, and saving finishes it
• Title & icon is a separate one-step form: fill it in and click "Save" — a title-only site doesn't need anything hidden
• Three hide methods: disappear (gone, and the content below moves up), keep space (invisible, but the space stays), cover (a block in the page colour sits on top, leaving the site's own styles untouched)
• Where it applies: the whole site, only these pages, or except these pages
• Tab title & icon: set the tab title and icon per site; sites without their own icon use the default icon
• Whole-page gray: one per-site switch (the floating button's "Media" button, the popup and the site's settings page). The entire page turns black & white — text, pictures, videos, buttons, background images alike; same place, same size, links still work, text stays readable. Videos that autoplay are held down; click a video to watch that one. Sound is not touched at all — volume belongs to the player's own button and Chrome's "Mute site". An independent switch: it does not follow "Your settings" — "As is" gives the hidden parts and the tab title/icon back, while the gray follows its own switch. Works on sites the user hasn't set up either: flipping it in the popup asks for that site's access (first-time-style) and then does exactly one thing — the gray
• Curtain: the "Cover this page / Restore this page" switch covers the whole page and the tab title (say, when someone walks over) and holds that tab's sound; a small draggable open-eye button stays on the page — one click restores it. Works on sites you have not added either
• Curtain shortcut: press to cover, press again to restore (Ctrl+Shift+X by default, ⌘+Shift+X on Mac); the capsule, the popup and the shortcut all work on the same state — any of them can undo any other
• A capsule you can tune or hide: a 10%–100% opacity slider (how faint it sits when idle is your call; it turns clear the moment you touch it), and the popup can hide it per site
• One switch per site: the small button at the bottom-right flips between "Your settings" and "As is"; all tabs of that site switch together
• On-page editing: the small button's "⋯" menu edits the tab title and icon in place, or edits what's hidden (change the hide method or where it applies, pick an element again, delete with 5-second undo)
• Settings split into two pages: "All site settings" lists the sites you added — click one for its settings page; "Settings" holds the default title, default icon, export / import and interface language, and is registered as Chrome's "Options" page
• Delete is always reachable: the very bottom of the popup and every row's "⋯" menu in "All site settings" both carry "Delete this site's settings" — no need to open the details page first
• Broken-item notices: if a site redesign means an item can no longer be found, you're asked to pick it again
• Bilingual: the popup, management pages, settings and on-page controls all have Chinese and English; pick the interface language in Settings
• Export / import: move all site settings plus the plugin settings to another computer as one file (the file name carries the version and the export time)

HOW TO USE
1. Open the site you want to tidy up and click the PageMask toolbar icon
2. First time: choose Allow in Chrome's prompt — you'll be asked once, whichever button you click
3. "Hide items" takes two steps: pick what to hide on the page → "Check the result" and save; "Title & icon" is saved with "Save"
4. To see the site as it is, click the small button at the bottom-right; to change what's hidden or the title and icon, use the popup's two buttons or the "⋯" menu next to the small button. To quiet the pictures and videos, click the floating button's 「媒体」 (Media) button, or flip the switch in the popup or in "Pictures & videos" on the site's settings page — all three are the same setting

PRIVACY & PERMISSIONS
• Runs only on sites you add. On every other site, PageMask runs nothing
• Access to a site is requested only when you enable it, and only for that one site
• Settings are stored only in your browser. PageMask itself makes no network requests, has no analytics and no third-party code
• Privacy policy: https://github.com/cherishfall/page-mask/blob/master/PRIVACY.md

NOTES
• The interface language follows the browser by default; switch to Simplified Chinese or English in Settings
• "Turn the whole page gray" only removes the color: the page still loads as usual, so this is neither a data saver nor an ad blocker. One CSS rule covers the entire page pixel by pixel — background images, canvas, iframe content, inline SVG and videos included (since 0.8.18); PageMask's own interface turns black & white with the page and keeps working; `<audio>` and sound in general are not touched. The click-to-allow rule for videos looks at where you last clicked
• The curtain's mute lives exactly as long as the cover: uncovering, reloading or leaving the page removes it; a mute you set yourself is not touched
• Doesn't run on browser pages, local files or the Chrome Web Store; elements inside iframes/shadow DOM can't be picked yet
• Support: https://github.com/cherishfall/page-mask/issues
```

## 3. 权限逐项理由（控制台「权限理由」逐字段粘贴）

- **storage**: Saves the user's settings for each site they add (which page elements to hide, how, on which pages, the tab title/icon they chose, the on/off state, and the per-site "Turn pictures & videos gray" switch) in `chrome.storage.local` on the device. Nothing is synced or sent anywhere.
- **scripting**: For sites the user has explicitly enabled only: (1) registers PageMask's bundled content script for that site's pages, (2) runs it once in the already-open tab right after the user enables the site, and (3) inserts/removes the user's hiding stylesheet (`insertCSS`/`removeCSS`) when the user switches the site between clean and original. While the gray switch is on, the same stylesheet turns images and videos black & white, and the bundled content script holds videos that autoplay — all still local, with no remote code.
- **activeTab**: When the user opens the popup, it reads the active tab's URL to show which site it is, whether it's supported (browser pages, local files and the Web Store are not), and whether it is already configured. No other tab is accessed.
- **Host permissions (optional, declared as `*://*/*`)**: Declared broadly only because the user may enable any site they choose; **nothing is granted at install**. When the user clicks 「收起内容」 ("Hide items") or 「标题和图标」 ("Title & icon"), PageMask calls `chrome.permissions.request` for that single origin (e.g. `https://example.com/*`). The grant is used only to run the content script and apply the user's hiding styles and tab title/icon on that origin. Deleting that site's settings (from the site's settings page, or the small button's ⋯ menu on the page) removes the origin's permission.

**0.8.0 adds no permission.** Covering a page holds that tab's sound via `chrome.tabs.update(tabId, { muted })`, which changes Chrome's own tab-mute state and does not need the `tabs` permission (that permission is for reading `url` / `title` / `favIconUrl`). The gray switch needs no host access beyond the origin the user already granted, and makes no network requests — the black & white look is a stylesheet, so the image/video requests still happen.

## 4. 单一用途（Single purpose）

```
Declutters websites the user chooses: it hides page elements the user picks and, per site, can turn pictures/videos gray (with an optional custom tab title and icon). Covering a page holds its sound. It does nothing on sites the user has not added.
```

## 5. 隐私表单填法

控制台分两组，别混：

1. **数据类型**（你处理哪些用户数据）：勾选 **Website content** 与 **Web history**。
   - Website content：为了让你点选元素、以及核对规则是否仍然命中，扩展会读取你已添加网站的页面结构；短标签（最多 8 字符）会存在本机。
   - Web history：站点配置里保存了网站地址与生效页面的路径前缀。
   - 勾选后需要在「隐私政策」中说明用途；`PRIVACY.md` 已写明「只存本机、不上传」。
   - 0.8.0 的「整页变灰」（当时叫「图片和视频变灰」）只是同一份站点配置里的一个布尔值；幕布静音是浏览器记在标签页上的状态，不是扩展采集的数据，**不新增数据类型勾选**。
2. **三条证明**（与是否收集无关，**全部勾选**）：
   - 不出售或转让给第三方（批准的用途除外）
   - 不用于与单一用途无关的目的
   - 不用于判断信用或放贷
   - 并勾选「遵守 Chrome 应用商店用户数据政策（含 Limited Use 要求）」——`PRIVACY.md` 的 "What we don't do" 一节已有对应声明。

## 6. 审核员备注（Notes / Test instructions）

```
What it does: lets the user hide page elements they pick on sites they explicitly add, turn pictures/videos gray per site, and set an optional custom tab title/icon for those sites. Covering a page ("Cover this page") also holds that tab's sound. UI is bilingual (Chinese and English; the interface language follows the browser and can be switched in Settings).

Permissions model: no host access and no content script are registered at install. The built manifest contains no content_scripts and no host_permissions. The popup buttons 「收起内容」 ("Hide items") and 「标题和图标」 ("Title & icon") call permissions.request for that single origin; only after the user allows it does PageMask register the bundled content script (scripting.registerContentScripts, scoped to that origin) and inject the hiding styles there.

Hiding is done with scripting.insertCSS (user origin) using the selectors the user picked; the "cover" method adds a solid overlay element inside a shadow root. While the gray switch is on, the same stylesheet turns img/video elements black & white (keeping layout, size and links, leaving small icons alone) and the bundled content script holds videos that the site autoplays — a video the user clicks is allowed to play. Covering a page calls chrome.tabs.update({ muted }) — Chrome's own tab mute, no tabs permission — and the extension only unmutes a tab it muted itself (mutedInfo.reason === 'extension' and our extensionId); the mute lives exactly as long as the cover. The tab title/icon are changed only on enabled sites while that site's switch is on, and restored when switched off; switching to "As is" restores the colors as well.

No network requests, no analytics, no remote code, no bundled site rules. Image/video requests are NOT blocked — the gray look is purely visual. All data stays in chrome.storage.local.

Test steps (no login needed):
1. Open https://en.wikipedia.org/wiki/Main_Page, click the PageMask icon, click the blue button 「收起内容」 ("Hide items"), choose Allow.
2. The page enters pick mode: click on the "From today's featured article" box (or any element you'd like to hide) — it is highlighted and listed in the toolbar's picked list. Click 「下一步：看效果」 (Next: check the result).
3. The picked element is hidden with ghost markers; the list on the right lets you change the hide method or remove an item, and the "where it applies" options are in each row's 「调整」 (Adjust). Click 保存 (Save). The element is hidden.
4. Click the PageMask icon again and click 「标题和图标」 ("Title & icon"): a one-step form opens. Type a title and click 保存 (Save) — the tab title changes to it ("Reading" / «阅读» when left empty and Chrome's UI language is Chinese).
5. Click the small button at the bottom-right to switch the site back to "As is": the element reappears and the title reverts.
6. Click 「⋯」 on the small button. By default the menu has four items in three groups: 「收起内容」 (Hide items — opens pick mode again) / 「标题和图标」 (Title & icon — opens the one-step form) | 「调整不透明度」 (opens the opacity setting) | 「删除这个网站的设置」 (Delete this site's settings, in red — always last; removes the site's settings and its permission). Once the button has been dragged, a fifth item 「按钮放回右下角」 (put the button back at the bottom-right) joins that second group. The button itself carries a 「媒体」 (Media) button that turns the site's pictures & videos black & white in one click.
7. Toolbar icon → the popup shows the 「按你的设置显示」 switch, the two buttons 「收起内容」 / 「标题和图标」, the 「整页变灰」 ("Turn the whole page gray") switch with the same Media icon as the floating button, the 「悬浮按钮」 (floating button) switch, then 「遮住这一页」 (Cover this page — the whole page is covered, the tab's sound is held, and only a small open-eye button remains; click it to restore), and two entries: 「全部网站设置」 (All site settings — the site list; a site's settings page has a "Grayscale whole page" card and 「删除这个网站的设置」 in the footer) and 「插件设置」 (Settings — default title, export / import, interface language).
8. Whole-page grayscale (no new permission): turn it on with the floating button's 「媒体」 (Media) button, in the popup, or in the 「整页变灰」 card on the site's settings page — the places stay in sync. The whole page turns black & white (text, pictures, videos, backgrounds, canvas, iframe content), stays in place and keeps its links; videos that the site autoplays are held, and clicking one lets that one play (still black & white). The gray switch is independent of the 「按你的设置显示」 / 「原样」 switch: flipping that switch restores the hidden parts and the tab title/icon while the gray stays as set. Covering the page (step 7) mutes the tab (Chrome shows a muted speaker icon); restoring brings the sound back.
```

**已实走（2026-10-27，0.2.0 构建）**：在匿名可访问的 Wikipedia 首页按当时 5 步完整跑通（点选 → 预览 → 保存 → 切换原样 → 编辑规则 → 一键清空），每一步的页面效果、标题变化、配置落库与清空后的还原都核对过。第 1 步的「点图标 + 授权弹窗」在自动化里用等价的 `enableSite` 消息代替，弹窗本身仍需人工点一次确认。
**0.8.0 待重走**：上面 8 步在提交前按当前界面在真实 Chrome 上跑一次并回填结果，重点核对胶囊「媒体」钮与「遮住」钮、弹窗新排版（媒体开关一行 + 带图标的「遮住这一页」）、站点设置页「整页变灰」卡、第 8 步的自动播放压制 / 点击放行，以及幕布静音（遮住即哑、恢复有声、标签页斜线小喇叭）。自动化已按新语义全量跑过（0.8.0，#131/#132）：单测 692 项；E2E 九个脚本合计 842 项断言，其中 `tests/e2e/check-media.mjs` 25 项专测变灰开关与幕布静音（含小图标豁免、播放压制与点击放行、静音归属、原样态还原、切回重新生效）；浅深色由 `check-language` 覆盖。品牌版 Chrome 的「允许」授权弹窗、隐私表单与隐私政策 URL 仍需人工。

## 7. 版本历史

| 版本 | 日期 | 要点 |
|---|---|---|
| 0.8.19 | 2026-11-11 | 「整页变灰」的图标换成对比度符（半填充圆）——功能升级为整页后，原「山 + 太阳」图片符号与语义脱节；灰度 / 对比度的通行符号（M3 contrast、macOS / GNOME 对比度设置同款），关态描边（圆 + 中线）、开态右半填实。功能与权限不变。详见 `CHANGELOG.md` |
| 0.8.18 | 2026-11-11 | 整页变灰（#156，用户提案采纳，ADR-0018）：「图片和视频变灰」升级为「整页变灰」，一条 html{filter} 规则像素级覆盖整页（背景图 / canvas / iframe 内容 / SVG / 视频全部），过去三轮返工的覆盖边界一次清零；媒体控制器缩成视频自动播放压制；自家浮层随页面变黑（登记取舍）。功能与权限不变。详见 `CHANGELOG.md` |
| 0.8.17 | 2026-11-10 | 发版后深审查收尾（Web Interface Guidelines + 第二轮全量截图目检）：弹窗 ⓘ 信息标补 aria-describedby（读屏可达）、异步说明补 role=status、触屏点击灰闪关掉、删除确认框滚动隔离；两处措辞统一（点击放行视频、不透明度方向感）。功能与权限不变。详见 `CHANGELOG.md` |
| 0.8.16 | 2026-11-10 | 观感批次（#152–#155）：悬浮按钮开启态改「墨色填实图标 + 淡灰选中底」（指示条退场）；弹窗松间距（8/12px）、说明砍短 + ⓘ 信息标、辅助行分割线退场、底部入口改文字链接、「收起内容」退居次按钮；灰度覆盖 CSS 背景图内容（书封类站点实测生效）+ 未加载好的页面上开灰度照常建档；全量截图审查修掉一批文案与可点性问题。功能与权限不变。详见 `CHANGELOG.md` |
| 0.8.15 | 2026-11-10 | 界面批次按真机反馈收口（#148 / #149 / #150）：弹窗重建为四块卡（与悬浮按钮四段一一对应，两颗编辑入口并排且不再置灰，「遮住这一页」成卡并说明临时性，帮助入口挪到标题右侧）；悬浮按钮开启态去掉整颗墨底反白，改中性底 + 强调色图标 + 底部 2px 指示条，补 150ms 颜色过渡；设置面板 720→480px 并新增「收起 / 展开」，收起后页面可直接点选。同批文案专项（#151）：叫法统一、中英对齐、内部名词退场。功能与权限不变。详见 `CHANGELOG.md` |
| 0.8.14 | 2026-11-09 | 会话保留边界收口（#144）：删除设置后清掉会话标记（空配置回来不再莫名冒出悬浮按钮）；弹窗里把「悬浮按钮」由关拨到开即视为明确要求，页面挂出按钮。两处偶发变红的测试断言修正。功能与权限不变。详见 `CHANGELOG.md` |
| 0.8.13 | 2026-11-09 | 修复（#143）：只开灰度的网站上，关掉灰度后遮住整页再恢复，悬浮按钮会消失——会话保留判据改为「本页挂出过」而非「此刻在场」（遮住与向导会临时收起按钮，返回时挂回）。功能与权限不变。详见 `CHANGELOG.md` |
| 0.8.12 | 2026-11-09 | 夜间质量循环第二轮（独立代码审查 + 全界面视觉巡检 + 界面准则审查）收口：向导同类导航的取消勾选竞态、遮罩预览「所见即所得」（底色按实际背景计算）、悬浮按钮图标钮补读屏名称、填实态补悬停/按下反馈、文案统一（会暂停 / 取消选中 / 重新选一次）。功能与权限不变。详见 `CHANGELOG.md` |
| 0.8.11 | 2026-11-09 | 欢迎页重排（#139）：分步单屏、内容列放宽到 720px、补「图片和视频变灰」介绍；弹窗底部新增「重看插件介绍」入口；向导同类勾选后可逐个查看（#140：第 i / N 个 + 上一个/下一个 + 当前成员实线强调框）；向导面板定宽。新增欢迎页同步守门测试。功能与权限不变。详见 `CHANGELOG.md` |
| 0.8.10 | 2026-11-09 | 弹窗分组重排（#138）：面具开关与它管的两项（收起内容 / 标题和图标）框进同一张卡（卡头带与胶囊主钮同态的面具图标），弹窗自解释悬浮按钮；开关关着时卡内两钮置灰 + 一行说明；灰度、悬浮按钮同为卡片容器。纯重排，行为不变，权限不变。详见 `CHANGELOG.md` |
| 0.8.9 | 2026-11-09 | 悬浮按钮图标与状态重做（#137）：主按钮换威尼斯面具图标（旧实心蛋形 13px 下像骷髅剪影，用户反馈吓人）；开关状态改「整钮填实」——开着 = 墨底反白（iOS 控制中心同类），关着 = 透明底描边，一眼可辨且方向正确；对比发生在胶囊自己的底色上，任意网页底色下达标。功能与权限不变。详见 `CHANGELOG.md` |
| 0.8.8 | 2026-11-09 | 悬浮按钮去把手（ADR-0016）：按住任何位置拖动即可移动，移动超过 8px 才算拖动、不足算点击（按钮不误触）；静止宽度 126→约 101px，高度 26px（无障碍下限）不变；键盘方向键移动保留（Tab 聚焦本体）；触屏主按钮补齐 40×40 档。功能与权限不变。详见 `CHANGELOG.md` |
| 0.8.7 | 2026-11-09 | 修复：只开了灰度的网站上，在悬浮按钮上关掉灰度会把整根按钮拆掉——挂载判据改为只在页面加载时评估，会话内配置变空不再拆已挂着的按钮（页面上始终有入口拨回来），刷新后按判据隐藏。功能与权限不变。详见 `CHANGELOG.md` |
| 0.8.5 | 2026-11-08 | 没配置过的网站在弹窗里直接开灰度（#134）：打开时像第一次设置一样申请权限，后台补一份只带灰度的配置，内容脚本休眠唤醒生效——「只想把信息流变灰」不再需要先走向导。功能与权限模型不变（仍是按站点可选主机权限）。详见 `CHANGELOG.md` |
| 0.8.6 | 2026-11-08 | 胶囊单一形态（#135，ADR-0015）：主按钮改面具图标（填实=按你的设置显示、描边=原样），mini/折叠/文字标签退场，⋯ 菜单常驻；胶囊位置自由定位（不再限制在浏览器两侧）；拖动把手悬停才出现（触屏常显）。功能与权限不变。详见 `CHANGELOG.md` |
| 0.8.4 | 2026-11-08 | 0.8.3 独立代码审查的收口（一条轻微项）：原样态+灰度的首帧遮挡在正式样式落地后显式撤掉（此前靠 1.5s 兜底超时，极端情况下刷新后立刻进向导会先灰后彩）。功能与权限不变。详见 `CHANGELOG.md` |
| 0.8.3 | 2026-11-08 | 产品结构修正（ADR-0014）：灰度完全独立于主开关——「按你的设置显示 / 原样」只管收起的内容与标签页标题图标，灰度按自己的开关在两种状态下都生效（原样态下媒体钮不再是无反应的死按钮）；胶囊媒体钮挪到遮住前（高频在前、应急最远，全功能与 mini 相同）；媒体钮开启态图标改「内容填实、外框描边」并同步弹窗；点插件自己界面的点击不再被当成观看意图。功能与权限不变。详见 `CHANGELOG.md` |
| 0.8.2 | 2026-11-07 | 0.8.1 修复复查的收尾（无必修项）：更新 / 重载时的静音清扫覆盖未配置站点的一次性幕布页；放行记录随容器子树移出也清掉；导航兜底与遮 / 撤消息共队列的回归测试。功能与权限不变。详见 `CHANGELOG.md` |
| 0.8.1 | 2026-11-07 | 0.8.0 独立代码审查的收口：放行过的视频随元素移出文档清记录（不钉住已移除元素、再插回按新一轮压制）；同一标签页的幕布静音按消息顺序串行（快速连按遮 / 撤不留哑标签页）；扩展更新 / 重载瞬间新实例补解除残留静音。功能与权限不变。详见 `CHANGELOG.md` |
| 0.8.0 | 2026-11-07 | 媒体三开关重做（#131/#132）：「图片和视频变灰」一个开关取代「收起图片 / 收起视频 / 静音网页」——图片与视频变黑白但可读可点、零交互，站点自动播放的视频被按住、点击视频放行该视频，声音完全不参与；「静音网页」退场，遮住整页时连标签页声音一起按住、恢复即还原；胶囊（全功能与 mini）加「媒体」钮、弹窗改排版并给遮住 / 媒体配同源图标。旧设置自动迁移，不新增权限、不拦网络请求。详见 `CHANGELOG.md` |
| 0.7.1 | 2026-11-06 | 0.7.0 发版后复查的收口（#125–#130）：删除站点只单向解除本扩展的静音、收回权限与整体导入替换也不留哑标签页（权限本身也是「该不该静音」的前提）；小图标一律按渲染尺寸判定、加载完立即重判；视频被替换、开关反复拨动、播放器挪位置都能正确还原；界面说明分组、菜单未选中态、读屏分组与商店材料口径。功能与权限不变，详见 `CHANGELOG.md` |
| 0.7.0 | 2026-11-06 | 按站点的「收起图片 / 收起视频 / 静音网页」三个开关，站点设置页、弹窗、悬浮按钮「⋯」菜单三处同一组设置；图片 / 视频变灰块保布局、小图标留原样，视频还会暂停静音，静音走 Chrome 标签页静音（不需要 `tabs` 权限、只解除本扩展设的那份）；只在「按你的设置显示」时起作用，切原样连声音一起还原。不新增权限、不拦网络请求。详见 `CHANGELOG.md` |
| 0.6.1 | 2026-11-06 | 第二轮装机反馈：幕布三处入口（胶囊 / 弹窗 / 快捷键）互通且未添加网站可反复遮撤、欢迎页矮窗口改为内容区滚动 + 底栏固定、胶囊收到 WCAG 最小尺寸（高 26）、不透明度改 10%–100% 滑杆（旧三档自动迁移）、胶囊可按网站隐藏（弹窗开关，显示时回右下角 + 全功能）、弹窗补「删除这个网站的设置」、「全部网站设置」列表逐行删除（⋯ 菜单）。详见 `CHANGELOG.md` |
| 0.6.0 | 2026-11-05 | 第一轮装机复核（装机版，未作为商店版本发布）：幕布快捷键（Ctrl+Shift+X / ⌘+Shift+X）、胶囊不透明度三档（0.6.1 起为滑杆）、只改保存过标题和图标的网站、可恢复网站原标题与图标、向导同类组统一描边、欢迎页改用真实组件、新插件图标。详见 `CHANGELOG.md` |
| 0.4.1 | 2026-11-02 | 只说人话的批次：全界面文案重写一遍——菜单与按钮改成具体动作（「设置这个网站」「编辑收起的内容」「网站设置」），两态改叫「按你的设置显示 / 网站原样」，技术词「授权 / 生效 / 规则」全部换成「允许访问 / 起作用 / 收起设置」，同一概念在四个界面只留一种叫法；扩展简介去掉「一键」，工具栏提示改成具体动作。详见 `CHANGELOG.md` |
| 0.4.0 | 2026-10-30 | 界面捋顺批次：面板只留三件事并新增「遮住本页 / 恢复本页」开关、设置拆成「网站设置」与「插件设置」两个独立页面（插件设置注册为扩展选项）、默认标签页图标三层生效、向导改三步（标题和图标 → 点选内容 → 看效果）、⋯ 菜单四项、「一键清空」改名「删除这个网站的设置」、幕布恢复按钮改为可拖动的睁眼图标、导出文件带插件设置与版本号、全界面中英双语与界面语言设置。详见 `CHANGELOG.md` |
| 0.3.0 | 2026-10-28 | 真实使用反馈批次：新站点授权后直接进入向导、只想改标题也能配置、站点设置页、向导清空与取消、预览清单行内编辑、幕布（含未添加网站）。详见 `CHANGELOG.md` |
| 0.2.0 | 2026-10-27 | 上架前质量加固：遮罩覆盖、设置向导、编辑规则、悬浮按钮的可用性修复，无障碍与对比度，文档一致性。构建产物 `.output/page-mask-0.2.0-chrome.zip`（22 个文件 / 115 KB），tag `v0.2.0`。详见 `CHANGELOG.md` |
| 0.1.0 | 2026-10-26 | 首个功能完整版本（未提交商店） |

## 8. 截图与素材清单

商店要求：截图 1280×800（或 640×400），3–5 张；小型宣传图块 440×280 可选但建议。

| 素材 | 文件 | 说明 |
|---|---|---|
| 商店图标 128×128 | `public/icon/128.png`（同步 `docs/store-assets/icon-128.png`） | ✅ 已在 manifest 里（`npm run icons` 从 `assets/icon/*.svg` 生成） |
| 截图 1（首图） | `docs/store-assets/screenshot-1-before-after.png` | ✅ 1280×800：「之前 / 之后」并排，32px 大字标题 |
| 截图 2 | `docs/store-assets/screenshot-2-wizard.png` | ✅ 1280×800：三步设置第 2 步（点选，选中项列成清单）与第 3 步（看效果，逐项编辑 + 在哪些页面收起）并排 |
| 截图 3 | `docs/store-assets/screenshot-3-tabbar.png` | ✅ 1280×800：标签栏里两个标签页（原样 / 清爽），展示标题与图标 |
| 截图 4 | `docs/store-assets/screenshot-4-popup.png` | ⚠️ 已按 0.8.10 重拍 1280×800，但截图里灰度卡仍是旧名「图片和视频变灰」（0.8.19 文案已统一为「整页变灰」，**商店提交前需重拍**）：弹窗（面具卡：面具图标 + 按你的设置显示开关 + 收起内容 / 标题和图标；灰度卡；悬浮按钮卡；带闭眼图标的遮住这一页；底部两个入口） |
| 截图 5 | `docs/store-assets/screenshot-5-management.png` | ✅ 1280×800：「全部网站设置」（网站列表）与「插件设置」两个独立页面并排 |
| 截图 6 | `docs/store-assets/screenshot-6-curtain.png` | ✅ 已按 0.8.10 重拍 1280×800：胶囊（面具主钮 / 媒体钮 / 遮住钮 / ⋯，无把手、选中态整钮填实）与「⋯」菜单 + 遮住整页后的睁眼恢复按钮（悬停显出「恢复」） |
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
- 「整页变灰」只去掉颜色：页面内容照常加载，既不省流量，也不代替广告过滤工具；一条 CSS 规则覆盖整个页面（背景图、`<canvas>`、iframe 内容、内联 SVG、视频都在内），本扩展自己的浮层也会跟着变黑；`<audio>` 与一切声音不参与。
- 幕布静音随幕布生灭：遮住即静音当前标签页，恢复（或刷新、离开页面）即还原；你自己用 Chrome 右键或播放器静音的不受影响。
- 不支持 `chrome://` 内部页面、`file://` 本地文件、Chrome 应用商店页面。
- iframe 与 shadow DOM 内部的元素暂时无法点选。
- 标签页悬停缩略图、浏览器历史记录里的标题是浏览器自身行为，扩展改不到。
- 幕布只挡视线不挡输入：视频全屏、页面内对话框会盖住幕布；键盘焦点仍在页面中，继续打字仍会改动页面内容；刷新或离开页面后幕布消失。

## 10. 审核员可能问的问题（提交前先想好答案）

| 问题 | 回答 |
|---|---|
| 为什么要声明 `*://*/*`？范围太大了 | 用户可能想对任意一个网站生效，声明时只能先报一个足够宽的范围；**安装时一个站点都不授予**，只有用户点「收起内容」或「标题和图标」并选「允许」后，才按单个 origin 请求，代码里没有任何地方用 `permissions.request` 申请多个站点（管理页的「全部允许访问」也只是一个用户手势内的多 origin 请求，且只包含用户自己导入/已配置的站点）。 |
| 为什么安装后看不到内容脚本？ | 内容脚本不写死在 manifest 里，而是用户授权后用 `scripting.registerContentScripts` 按 source 动态注册。这样未添加的网站上扩展完全不运行，安装时也只有一个「读取和更改您在 xxx 上的数据」之外的零警告（实测 `getPermissionWarningsByManifest` 返回空数组）。 |
| 扩展会改网页内容吗？ | 只是「做减法」：用 `scripting.insertCSS` 注入用户自己点选出来的选择器（`display:none` / 透明占位 / 盖一块与背景同色的遮罩），以及可选地替换标签页标题与图标。变灰开关同样是一份用户样式表（grayscale 滤镜）；内容脚本只在变灰开关打开期间按住站点自动播放的视频（用户点过的放行）。不改网页原有 DOM、不发请求、不注入远程代码。 |
| 变灰开关会拦网络请求吗？ | 不会。黑白观感是 `scripting.insertCSS` 的用户样式表（`grayscale(1)` 滤镜），图片 / 视频请求照发，因此也不省流量、不挡广告；扩展没有 `declarativeNetRequest` 权限，也没有拦截任何请求的代码。 |
| 为什么能静音标签页却没申请 `tabs` 权限？ | 遮住整页时用 `chrome.tabs.update(tabId, { muted })` 按住该标签页的声音，改的是 Chrome 自己的标签页静音状态，按官方文档不需要 `tabs` 权限（`tabs` 权限主要用于 `tabs.query` 读 `url` / `title` / `favIconUrl` 等敏感字段）。消息用 `sender.tab.id` 定位当前标签页。静音与幕布同生共灭，不写进扩展存储；解除前核对 `mutedInfo.reason === 'extension' && extensionId === 本扩展`，不动用户手动静音、Chrome 自带「静音网站」或其他扩展设置的静音。 |
| 会不会收集浏览记录？ | 不收集。网站地址存在本机 `chrome.storage.local`（用户配置的一部分），不上传、不同步（没用 `storage.sync`）。 |
| 为什么能改标签页标题/图标？ | 这是产品功能之一（`document.title` + `link[rel=icon]`），只对用户已添加、且该网站开关打开（「按你的设置显示」）的网站生效；切回「原样」或卸载后立刻还原。 |
| 关闭扩展后页面会残留样式吗？ | 不会：切回原样、「删除这个网站的设置」、卸载都会撤掉注入的样式；E2E 覆盖了「删除设置后已打开页面立即恢复原样」。 |

## 11. review-checklist 自查结论

按 `chrome-extensions` skill 的 pre-publish checklist 逐项过了一遍（0.2.0，2026-10-27）。0.4.0、0.7.0 与 0.7.1 的权限集、打包方式都没有变化，结论仍然适用；提交前按 §0 清单对版本号、截图与测试步骤复核一遍即可：

### Manifest 与打包

| 项 | 结论 |
|---|---|
| manifest_version 3 | ✅ 产物 manifest `"manifest_version": 3` |
| 版本号已递增 | ✅ `0.8.0`（0.1.0 从未提交商店；逐版递增记录见 `CHANGELOG.md`） |
| manifest 名称与本文一致 | ✅ 名称/简介来自 `_locales`，与 §1 表格一致（控制台不可单独填写） |
| 简介 ≤132 字符 | ✅ en 125 / zh_CN 54 |
| ZIP 无多余文件 | ✅ 32 个文件，只含运行文件：`manifest.json`、`background.js`、`content-scripts/content.js`、`chunks/*`、`assets/*.css`、`*.html`、`icon/*`、`_locales/*`、`THIRD_PARTY_NOTICES.txt`；无 `.map`、无 `README`/`CHANGELOG`/`CHROMEWEBSTORE.md`、无测试与配置（见 `check:package` 输出） |
| ZIP < 2GB | ✅ 远小于 2GB（KB 级） |
| 无绝对路径 | ✅ manifest 内路径全部相对 |
| 无 eval / 远程代码 | ✅ 全部 JS 打包在包内，无 `eval`/`new Function`，无远程脚本 |

### 权限

| 项 | 结论 |
|---|---|
| 最小权限 | ✅ 只有 `storage` / `scripting` / `activeTab`；`optional_host_permissions` 声明 `*://*/*` 但安装时不授予任何站点 |
| 每个权限有具体理由 | ✅ §3 逐项 |
| activeTab 用法正确 | ✅ 只用于 popup 读当前标签页网址；注入靠按站点授予的主机权限 |
| 无多余权限 | ✅ 没有 `tabs`、`management`、`downloads` 等；幕布静音用 `tabs.update({muted})`，按官方文档不需要 `tabs` 权限，权限集未变 |
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
| 截图与当前界面一致 | ⚠️ 1 / 2 / 3 / 5 与当前界面一致；4 / 6 需按 0.8.0 界面重拍后才提交 |
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
| 功能可用 | ✅ `npm run compile` 通过；单测 692 项；`npm run test:e2e` 九个脚本合计 842 项断言全绿（含 `check-media.mjs` 25 项，按 0.8.0 语义重写）；`npm run check:docs` / `check:package` 通过 |
| 无崩溃/空白页 | ✅ popup、管理页、引导页、内容脚本都有 E2E |
| 目标站点可用 | ✅ Wikipedia 首页实走（§6） |
| 边界情况 | ✅ 内部页/本地文件/商店页有明确提示；无配置时零注入 |
| 卸载干净 | ✅ 卸载删除 storage.local 与动态注册；页面无残留（删除设置这条路径有 E2E） |
| 资源占用 | ✅ 静止页面内容脚本 2 秒内 0 次 rAF；无 setInterval（单测守门） |

**仍需人工完成**：真实授权弹窗点「允许」的完整路径（品牌版 Chrome）、隐私表单在控制台勾选、提交前的隐私政策 URL 点验、§6 八步真机重走，以及真实网站（微博 / X）明暗底色下的黑白观感、自动播放压制与点击放行、中英文界面字长。
