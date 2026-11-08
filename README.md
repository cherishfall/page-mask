# PageMask · 收起网页上不想看的部分

> 点选网页上不想看的元素把它们收起来；标签页标题和图标也能一起变低调。
> Hide the parts of a page you don't want — and keep the tab low-key.

[中文](#中文) · [English](#english)

---

## 中文

**PageMask** 是一个 Chrome 扩展：在你主动添加的网站上，点选页面上不想看的部分（推广位、推荐流、侧栏、页脚……）把它们收起来；标签页的标题和图标也可以换成低调的样子。适合想安静看内容、又不想学规则写法的场景。

**核心原则：你不主动设置，PageMask 对任何网站都没有影响。** 不添加任何网站，PageMask 不会向任何页面注入脚本、样式或界面。

### 功能

- **按网站生效**：只有你主动添加的网站才会被处理，其它网站完全不受影响
- **零专业知识点选**：悬停高亮、点击选中（可连选），用「选大一点 / 选小一点」调整范围，不需要懂 CSS
- **三种收起方式**：消失（整块不见，下面的内容往上顶）/ 留空（看不见了，但位置还占着）/ 盖住（不改网站自身样式，任何网站都可用）
- **保存前预览**：每个元素都能单独换收起方式，满意再保存
- **在哪些页面收起**：整个网站，或「只在这类页面 / 除了这类页面」（不用输入，从当前网址自动推导）
- **只想改标题也可以**：不收起任何元素，只为某个网站换个标签页标题 / 图标，一样是一份正经设置
- **标签页标题与图标**：可为该网站设置标签页标题（默认「阅读」）和图标；图标三选一——网站原来的、不显示、或换成内置的 10 个图标之一。网站自己改标题时会被自动改回
- **图片和视频变灰**：按网站的一个开关（胶囊上的「媒体」钮、弹窗、站点设置页三处都能改）。图片和视频变成黑白的，位置不变、大小不变、链接还能点、截图里的字还能看清，整个页面像一篇图文资料；≤32px 的小图标与表情保持原样。会自动播放的视频被按住，点一下视频就能看（画面保持黑白）。声音完全不参与——音量归播放器自己的按钮和 Chrome 右键「静音网站」。**独立开关**：不受「按你的设置显示」影响——切「原样」是把收起的内容和标签页标题图标还给你，灰度按自己的开关走。**没配置过的网站也能直接用**：在弹窗里打开它，会像第一次设置一样申请这个网站的权限，然后只做灰度这一件事
- **设置分成两个页面**：「全部网站设置」是网站列表，点进去是一个网站的设置页；「插件设置」放默认标题、导出 / 导入、界面语言与版本信息，也是 Chrome 的「扩展程序选项」
- **每个网站一个开关**：点页面上的悬浮按钮，就在「按你的设置显示」和「原样」之间切换，同一网站的所有标签页一起变
- **失效提醒**：网站改版导致某一项找不到目标时，会用人话提醒你重新选一次
- **幕布**：弹窗上的「遮住这一页 / 恢复这一页」把整页连同标签页标题一起遮住（0.8.0 起连这个标签页的声音一起按住），再点一下回到刚才的样子；遮住后页面上是一颗睁眼的小按钮，可以拖动，鼠标移上去显出「恢复」。没添加过的网站也能用；也可以按快捷键（默认 Ctrl+Shift+X，Mac 是 ⌘+Shift+X）——胶囊、弹窗、快捷键三个入口互相通用，任何一处遮住，另两处都能恢复
- **胶囊可调可藏**：不透明度滑杆（10%–100%，调它闲着的时候有多淡，鼠标移上去立刻清楚）；嫌占地方可以在弹窗里按网站把它关掉，再打开时回到右下角、完整形态
- **胶囊放到哪都行**：按住它拖到页面任何位置——0.8.6 起不再限制在浏览器两侧，0.8.8 起没有拖动把手、整根按钮都能拖（按下移动超过 8 像素才算拖动，不会误触上面的按钮），窗口变了会自动夹回视口内
- **单一胶囊形态**（0.8.6）：主按钮是面具图标（戴面具=按你的设置显示、摘面具=原样），原先的精简双形态退场——全功能能力（拖动、菜单）现在人人都有
- **界面语言**：全界面中英双语，插件设置里可选（跟随浏览器 / 简体中文 / English），切换马上生效
- **导出 / 导入**：全部网站的设置和插件设置导出成一个文件（文件名带版本号与导出时间），换电脑后导入
- **设置只存在本机**：没有账号、没有同步、PageMask 自身不发起任何网络请求

### 与同类工具：各自适合什么

不同工具解决不同问题，选适合你的：

| 工具类型 | 代表 | 最适合 | 不太适合 |
|---|---|---|---|
| 广告拦截器 | uBlock Origin | 系统性屏蔽广告与追踪、全局生效；愿意了解一点规则概念 | 只想收起某几个特定元素、完全不想碰规则 |
| 阅读模式 | 简悦 SimpRead、Just Read | 长文沉浸阅读、杂志式排版、标注与同步等阅读增强 | 想保留原页面布局只做减法；首页、社区等非文章页 |
| 信息流屏蔽 | News Feed Eradicator | 戒掉预置社交网站的信息流刷屏 | 其他网站、自选任意元素 |
| **PageMask** | — | 零专业知识、鼠标点选任意元素即时预览；按网站独立开关、随时还原；标签页标题图标一起变低调；设置完全本地 | 拦截广告与追踪（请用广告拦截器）；重排版式的沉浸长文（请用阅读模式）；多设备自动同步（PageMask 提供导出/导入） |

一句话：**页面要清爽，但不想学规则、不想换版式、还想让标签页一起变低调——这就是 PageMask。**

### 安装（开发者模式自用）

需要 **Chrome 116 或更高版本**。

1. 下载或克隆本仓库
2. `npm ci && npm run build`（有 `package-lock.json`，用 `npm ci` 装出来的依赖与发布版一致）
3. 打开 Chrome → 地址栏输入 `chrome://extensions` → 打开右上角「开发者模式」
4. 点「加载已解压的扩展程序」→ 选择项目的 `.output/chrome-mv3` 目录

以后换版本**不要换目录、不要点移除**——照下一节做，已有的网站设置、网站授权、按钮位置都会保留。

### 升级：换版本不丢设置

换新版本时照这三步做，否则原有设置会全部丢失：

1. **覆盖到同一个目录**，不要解压到新文件夹。最省事的是直接用仓库里的 `.output/chrome-mv3`：`npm run build` 会自动更新它。
2. 回到 `chrome://extensions`，点这张卡片上的**刷新**按钮。
3. **已经打开的页面再刷新一次**——内容脚本只在页面加载时注入。

原因很简单：设置是按「这个扩展」存的，而开发者模式加载的扩展靠**文件夹位置**认身份。换一个文件夹，浏览器就当成了另一个扩展，设置自然是空的。点「移除」也一样，一定会清空（所有扩展都这样，不是本扩展的毛病）。

**怎么确认身份没变**：`chrome://extensions` → 这张卡片的「详情」→ 看「ID」那串字符，升级前后应当一模一样。

发布到 Chrome 应用商店之后就不用管这些了：商店的自动更新是在原来那个扩展上升级，设置不会丢。

### 本地自测

1. 按上面的步骤加载后，打开任意一个你想收拾的网站，点工具栏的 PageMask 图标（建议先把它固定到工具栏：拼图图标 → 图钉）
2. 改完代码重新 `npm run build` 后，回到 `chrome://extensions` 点这个扩展卡片上的**刷新**按钮；**已经打开的页面要再刷新一次**——内容脚本只在页面加载时注入
3. 想从头再来：「全部网站设置」列表里点该行「⋯」菜单里的「删除这个网站的设置」，或打开该网站的设置页点同名项，或用弹窗最底部的同名入口（都会同时收回访问权限），或直接在 `chrome://extensions` 移除扩展
4. 出问题时先看两处日志：页面的 DevTools Console（内容脚本的报错会打在这里）、`chrome://extensions` 里本扩展的「服务工作进程」→「检查」

### 使用方法

1. 打开想收拾的网站，点工具栏的 PageMask 图标，点「收起内容」或「标题和图标」，在 Chrome 的提示里选「允许」（第一次会问这一次）
2. 「收起内容」分两步：在页面上点选要收起的内容（已经收起的项也在清单里，点它就去掉），再「看效果」确认——保存就完成了；「标题和图标」填完点「保存」
3. 想临时看网站原样，点悬浮按钮；想改收起的内容或标题图标，用弹窗上的两颗按钮，或悬浮按钮旁边的「⋯」菜单；想让图片视频变低调，点胶囊上的「媒体」钮，或在弹窗、站点设置页的「图片和视频」里拨开关，三处是同一组设置
4. 弹窗底部两个入口：「全部网站设置」（网站列表与每个网站的设置页）、「插件设置」（默认标题、导出 / 导入、界面语言、不透明度）
5. 想临时挡住整页，用弹窗或小按钮上的「遮住」；恢复时点页面上的睁眼小按钮

### 已知限制

- 不支持 `chrome://` 内部页面、`file://` 本地文件、Chrome 应用商店页面
- 「图片和视频变灰」只是**去掉颜色**：图片 / 视频请求照发，既不省流量，也不代替广告过滤工具。CSS 背景图、iframe 内嵌播放器、`<canvas>`、内联 SVG 不变灰；`<audio>` 与一切声音不参与。「点击视频放行」按最近一次点击位置判断，在个别播放器结构特殊的站点可能需要直接点视频本体
- 幕布遮住时会把当前标签页连声音一起按住，恢复（或刷新、离开页面）时声音跟着回来；你自己用 Chrome 右键或播放器静音的不受影响
- iframe 与 shadow DOM **内部**的元素暂时点不到（外层容器可以）
- 标签页悬停缩略图、浏览器历史记录里的标题由浏览器自己绘制，扩展改不到
- 幕布只挡眼睛不挡输入：视频全屏、页面里的对话框会盖住幕布；键盘焦点仍在页面里，继续打字仍会改内容；刷新或离开页面后幕布消失
- 界面语言默认跟随浏览器，可在插件设置里改成简体中文或 English

### 隐私与权限说明（Chrome 应用商店审核适用）

- **不收集、不上传任何数据**。PageMask 自身不发起任何网络请求，没有统计，没有第三方代码。设置仅存在 `chrome.storage.local`
- 权限逐项说明：
  - `storage`：在本机保存你的网站设置（收起的内容、标签页标题与图标、开关状态，以及图片 / 视频 / 声音三个开关）
  - `scripting`：只对你已添加的网站——注册内置内容脚本、在已打开的标签页里运行一次、按需增删你设置的收起样式
  - `activeTab`：打开弹窗时读取当前标签页的网址，用来判断是哪个网站、是否支持
  - 可选主机权限：只在你点「收起内容」或「标题和图标」时按单个网站申请，用于在该网站上运行内容脚本、应用你设置的收起样式与标题图标
- 收回访问权限：「全部网站设置」列表该行的「⋯」菜单点「删除这个网站的设置」，或在该网站的设置页点同名项，或用弹窗最底部的同名入口（会同时删掉该网站的设置），或在 Chrome 扩展详情页的「网站访问权限」里移除
- 本仓库不作为任何配置分发通道，不提供预置规则

### 开发

```bash
npm ci             # 按 lockfile 精确安装
npm run dev        # 开发模式
npm run build      # 构建到 .output/chrome-mv3
npm run zip        # 打包商店上传 zip
npm test           # 单元测试（vitest）
npm run test:e2e   # 真实 Chrome 全量 E2E（需 Chrome for Testing，见 tests/e2e）
```

设计文档见 [docs/design.md](docs/design.md)（最终设计共识）、[GLOSSARY.md](GLOSSARY.md)（术语表）、[docs/adr/](docs/adr/)（架构决策记录）；商店提交材料见 [CHROMEWEBSTORE.md](CHROMEWEBSTORE.md)。

## English

**PageMask** is a Chrome extension: on sites you add yourself, click the parts of a page you don't want (promos, feeds, sidebars, footers…) and they're gone. The tab title and icon can go low-key too. Built for quiet reading without learning rule syntax.

**Core principle: zero impact until you opt in.** Until you explicitly add a site, PageMask injects no script, no style, and no UI into any page.

### Features

- **Works per site**: only sites you add are touched; everything else is completely unaffected
- **Point-and-click, no expertise**: hover to highlight, click to select (multi-select supported), use "bigger / smaller" to adjust the range — no CSS knowledge needed
- **Three ways to hide**: disappear (gone, and the content below moves up) / keep space (invisible, but the space stays) / cover (a block in the page colour sits on top; the site's own styles are left untouched)
- **Preview before saving**: change the hiding method per element, then save
- **Where it applies**: the whole site, or "only these pages / except these pages" (no typing — worked out from the current address)
- **Title only is fine**: change just the tab title or icon of a site without hiding anything — that is a real, first-class setup too
- **Tab title & icon**: set a tab title (default "Reading") and icon per site; the icon is one of three — the site's own icon, no icon, or one of 10 built-in icons. If the site rewrites its title, it is changed back automatically
- **Turn pictures & videos gray**: one per-site switch, available in three places (the floating button's "Media" button, the popup and the site's settings page). Pictures and videos turn black & white — same place, same size, links still work, text in screenshots stays readable — and the whole page reads like a quiet article; icons and emoji up to 32px stay as they are. Videos that autoplay are held down; click a video to watch that one (it stays black & white). Sound is not touched at all — volume belongs to the player's own button and Chrome's "Mute site". **An independent switch**: it does not follow "Your settings" — switching to "As is" gives the hidden parts and the tab title/icon back, while the gray follows its own switch. **Works on sites you haven't set up either**: flip it in the popup and PageMask asks for that site's access, first-time-style, then does exactly one thing — the gray
- **Settings split into two pages**: "All site settings" lists the sites you have added; click one to open that site's settings page. "Settings" is its own page with the default title, export / import, interface language and version info, and is registered as Chrome's "Options" page
- **One switch per site**: a small button at the bottom-right flips between "Your settings" and "As is"; all tabs of that site switch together
- **Broken-item notices**: when a site redesign means an item can no longer be found, you get a plain-language heads-up to pick it again
- **Curtain**: the "Cover this page / Restore this page" switch in the popup covers the whole page and the tab title — and holds the tab's sound too (0.8.0). After covering, a small open-eye button remains — draggable, and hovering it reveals the word "Restore". It works on sites you have not added too. There is also a shortcut (Ctrl+Shift+X by default, ⌘+Shift+X on Mac) — the capsule, the popup and the shortcut share one state, so any of them can undo any other
- **A capsule you can tune or hide**: an opacity slider (10%–100% — how faint it sits when idle is your call; it turns clear the moment you touch it). If it feels intrusive, hide it per site from the popup; showing it again puts it back at the bottom-right in full form
- **Put it anywhere**: press and drag it anywhere on the page — since 0.8.6 it is no longer confined to the browser's sides, and since 0.8.8 there is no drag handle: the whole button is draggable (moving more than 8px after pressing counts as a drag, so the buttons never misfire); window changes snap it back into the viewport
- **One single capsule form** (0.8.6): the main button is a mask icon (mask on = "Your settings", mask off = "As is"); the former compact second form is gone — dragging and the menu are now everyone's
- **Interface language**: the whole interface is bilingual (Chinese and English); pick it in Settings ("follow the browser" / 简体中文 / English) and it takes effect immediately
- **Export / import**: all site settings plus the plugin settings export as one file (the file name carries the version and the export time); import it on another computer
- **Settings stay on your device**: no account, no sync, and PageMask itself makes no network requests

### Compared to similar tools: which fits you

Different tools solve different problems — pick what suits yours:

| Tool type | Example | Best for | Not so good for |
|---|---|---|---|
| Ad blockers | uBlock Origin | Systematically blocking ads & trackers, globally; okay with rule concepts | Hiding just a few specific elements with zero learning curve |
| Reader modes | Just Read, SimpRead | Immersive long-form reading, magazine layout, highlights & sync | Keeping the original layout and only subtracting; non-article pages like homepages or forums |
| Feed blockers | News Feed Eradicator | Breaking doom-scrolling on a preset list of social sites | Other sites; picking arbitrary elements yourself |
| **PageMask** | — | Zero expertise — click any element with live preview; per-site switch, revert anytime; tab title & icon go low-key too; settings fully local | Blocking ads & trackers (use an ad blocker); re-laid-out immersive reading (use a reader mode); automatic multi-device sync (PageMask offers export/import) |

In one line: **a clean page without learning rules or switching layouts — and your tab goes low-key too.**

### Install (developer mode)

Requires **Chrome 116 or later**.

1. Clone this repo
2. `npm ci && npm run build` (there is a `package-lock.json`; `npm ci` installs exactly what the release used)
3. Open `chrome://extensions`, enable **Developer mode**
4. **Load unpacked** → select the project's `.output/chrome-mv3` directory

When a new version comes out, **don't switch folders and don't click Remove** — follow the next section; your site settings, site access and button position all stay.

### Upgrading without losing your settings

Three steps. Skip them and your settings are gone:

1. **Overwrite the same folder** — don't unzip each release into a new one. Easiest: keep loading the repo's `.output/chrome-mv3`, which `npm run build` refreshes in place.
2. Back in `chrome://extensions`, click the **reload** button on the extension card.
3. **Reload any open pages** — the content script is only injected when a page loads.

Why: settings belong to "this extension", and an unpacked extension is identified by the folder it was loaded from. A different folder is a different extension, so it starts empty. Clicking **Remove** wipes everything too — that's how Chrome treats every extension, not something specific to PageMask.

**To confirm the identity didn't change**: `chrome://extensions` → **Details** on the card → compare the **ID** string. It should be identical before and after the upgrade.

Once published on the Chrome Web Store this stops mattering: store updates upgrade the same extension in place and keep your settings.

### Local testing

1. After loading, open any site you want to tidy up and click the PageMask toolbar icon (pin it first if you like: puzzle icon → pin)
2. After changing code and running `npm run build` again, click the **reload** button on the extension card in `chrome://extensions`; **reload open pages too** — the content script is only injected when a page loads
3. To start over: click 「删除这个网站的设置」 (Delete this site's settings) in the ⋯ menu of that row in 「全部网站设置」 (All site settings), or on the site's settings page, or at the very bottom of the popup (each also withdraws access), or remove the extension from `chrome://extensions`
4. When something looks wrong, check two places: the page's DevTools Console (content-script errors land there) and 「服务工作进程」 → 「检查」 (service worker → Inspect) on the extension card

### How to use

1. Open the site you want to tidy up, click the PageMask toolbar icon, click 「收起内容」 (Hide items) or 「标题和图标」 (Title & icon), and choose Allow in Chrome's prompt (asked once, the first time)
2. "Hide items" takes two steps: pick what to hide on the page (what you hid before is already in the list — click it to take it out), then check the result — saving completes it; "Title & icon" is saved with 「保存」 (Save)
3. To see the site as it is, click the small button at the bottom-right; to change what's hidden or the title and icon, use the popup's two buttons or the 「⋯」 menu next to the small button. To quiet the pictures and videos, click the floating button's 「媒体」 (Media) button, or flip the switch in the popup or in "Pictures & videos" on the site's settings page — all three are the same setting
4. Two entries at the bottom of the popup: 「全部网站设置」 (All site settings — the site list and each site's settings page) and 「插件设置」 (Settings — default title, export / import, interface language, opacity)
5. To cover the whole page, use 「遮住」 (Cover) in the popup or on the small button; click the small open-eye button on the page to restore

### Known limitations

- Doesn't run on `chrome://` pages, `file://` local files or the Chrome Web Store
- "Turn pictures & videos gray" only removes **the color**: image and video requests still happen, so this is neither a data saver nor an ad blocker. CSS background images, embedded players inside iframes, `<canvas>` and inline SVG are not grayed; `<audio>` and sound in general are not touched. The click-to-allow rule for videos looks at where you last clicked; on sites with unusual player structures you may need to click the video itself
- Covering the page also holds that tab's sound; uncovering, reloading or leaving the page brings it back. A mute you set yourself (Chrome's "Mute site" or the player) is not touched
- Elements **inside** iframes and shadow DOM can't be picked yet (their outer container can)
- Tab hover previews and the titles in browser history are drawn by the browser; the extension can't change them
- The curtain blocks sight, not input: fullscreen video and in-page dialogs render above it; keyboard focus stays in the page, so typing still edits content; the curtain disappears on reload or navigation
- The interface language follows the browser by default; switch to Simplified Chinese or English in Settings

### Privacy & permissions (for Chrome Web Store review)

- **No data collection, no uploads.** PageMask itself makes no network requests; there is no analytics and no third-party code. Settings live only in `chrome.storage.local`
- Permissions, one by one:
  - `storage`: saves your per-site settings (hidden items, tab title and icon, switch state, and the three picture/video/sound switches) on this device
  - `scripting`: for sites you have added only — registers the bundled content script, runs it once in the already-open tab, and inserts/removes the hiding styles you configured
  - `activeTab`: when you open the popup, reads the active tab's URL to identify the site and check whether it is supported
  - Optional host permissions: requested for a single origin only when you click 「收起内容」 (Hide items) or 「标题和图标」 (Title & icon), used to run the content script and apply your hiding styles and tab title/icon on that site
- Revoking access: use 「删除这个网站的设置」 (Delete this site's settings) from the ⋯ menu of that row in 「全部网站设置」 (All site settings), on the site's settings page, or at the very bottom of the popup (this also deletes its settings), or remove it under "Site access" in Chrome's extension details page
- This repository distributes no site presets or configurations

### Development

```bash
npm ci             # install exactly what the lockfile pins
npm run dev        # dev mode
npm run build      # build into .output/chrome-mv3
npm run zip        # package a store upload zip
npm test           # unit tests (vitest)
npm run test:e2e   # full E2E in real Chrome (needs Chrome for Testing; see tests/e2e)
```

Design docs: [docs/design.md](docs/design.md) (final design), [GLOSSARY.md](GLOSSARY.md) (glossary), [docs/adr/](docs/adr/) (architecture decisions); store submission material: [CHROMEWEBSTORE.md](CHROMEWEBSTORE.md).

## License

MIT
