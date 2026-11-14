# PageMask · 收起网页上不想看的部分

> 点选网页上不想看的元素把它们收起来；标签页标题和图标也能一起变低调。
> Hide the parts of a page you don't want — and keep the tab low-key.

[落地页](https://cherishfall.github.io/page-mask/) · [隐私政策](https://cherishfall.github.io/page-mask/privacy.html) · [问题反馈](https://github.com/cherishfall/page-mask/issues) · [中文](#中文) / [English](#english)

---

## 中文

**PageMask** 是一个 Chrome 扩展：在你主动添加的网站上，用鼠标点选页面上不想看的部分（推广位、推荐流、侧栏、页脚……）把它们收起来；标签页的标题和图标也可以换成低调的样子。

**核心原则：你不主动设置，PageMask 对任何网站都没有影响。** 不添加任何网站，PageMask 不会向任何页面注入脚本、样式或界面。

### 功能

**点选收起** — 悬停高亮、点击选中要收起的部分（可连选），「选大一点 / 选小一点」调整范围，不需要懂 CSS。三种收起方式：**消失**（整块不见，下面的内容往上顶）、**留空**（看不见了，但位置还占着）、**盖住**（原位盖一块与背景同色的方块，不改网站自身样式，也不依赖网站的样式写法）。每个元素都能单独换收起方式，保存前先「看效果」；还能限定「在哪些页面收起」——整个网站，或只在这类页面 / 除了这类页面（从当前网址自动推导，不用输入）。网站改版导致某一项找不到目标时，会提醒你重新选一次。

**标签页标题与图标** — 为某个网站把标签页标题（默认「阅读」）和图标换成低调的样子：图标三选一——网站原来的、不显示、或换成内置的 10 个图标之一。网站自己改标题时会被自动改回。只想改标题、不收起任何内容，也是一份正经设置。

**整页变灰** — 按网站的一个开关：整个页面变成黑白——文字、图片、视频、背景图全都一样，位置大小不变、链接还能点、文字照样读。会自动播放的视频被按住，点一下那个视频就能看；声音完全不参与。悬浮按钮上的「媒体」钮、弹窗、站点设置页三处都能改，也可以按快捷键（默认 Ctrl+Shift+Y，Mac 是 ⌘+Shift+Y），状态按网站记住。它有自己的开关，不受「按你的设置显示 / 原样」影响；没配置过的网站也能直接用——第一次会像添加网站一样申请权限。

**幕布** — 「遮住这一页」把整页连同标签页标题一起遮住（比如有人走近时），并把这个标签页的声音一起按住；再点一下就回到刚才的样子。遮住后页面上只剩一颗可拖动的睁眼小按钮，鼠标移上去显出「恢复」。也可以按快捷键（默认 Ctrl+Shift+X，Mac 是 ⌘+Shift+X）——悬浮按钮、弹窗、快捷键三个入口互相通用，任何一处遮住，另两处都能恢复。没添加过的网站也能用。

**悬浮按钮** — 页面右下角的一颗胶囊：点它在「按你的设置显示」和「原样」之间切换，同一网站的所有标签页一起变；按住它拖到页面任何位置；不透明度 10%–100% 可调（调它闲着的时候有多淡，鼠标移上去立刻清楚）；嫌占地方可以在弹窗里按网站把它关掉，再打开时回到右下角。

**设置与数据** — 「全部网站设置」列出你添加过的网站，点进去是每个网站的设置页；「插件设置」放默认标题、快捷键、悬浮按钮的不透明度、导出 / 导入、界面语言与版本信息，也是 Chrome 的「扩展程序选项」。全部网站的设置和插件设置能导出成一个文件（文件名带版本号与导出时间），换电脑后导入。全界面中英双语，切换马上生效。

**隐私基线** — 只有你主动添加的网站才被处理，其它网站完全不受影响；没有账号、没有同步，设置只存在本机；PageMask 自身不发起任何网络请求，没有统计，没有第三方代码。

### 与同类工具：各自适合什么

| 工具类型 | 代表 | 最适合 | 不太适合 |
|---|---|---|---|
| 广告拦截器 | uBlock Origin | 系统性屏蔽广告与追踪、全局生效；愿意了解一点规则概念 | 只想收起某几个特定元素、完全不想碰规则 |
| 阅读模式 | 简悦 SimpRead、Just Read | 长文沉浸阅读、杂志式排版、标注与同步等阅读增强 | 想保留原页面布局只做减法；首页、社区等非文章页 |
| 信息流屏蔽 | News Feed Eradicator | 戒掉预置社交网站的信息流刷屏 | 其他网站、自选任意元素 |
| **PageMask** | — | 零专业知识、鼠标点选任意元素即时预览；按网站独立开关、随时还原；标签页标题图标一起变低调；设置完全本地 | 拦截广告与追踪（请用广告拦截器）；重排版式的沉浸长文（请用阅读模式）；多设备自动同步（PageMask 提供导出/导入） |

一句话：**页面要清爽，但不想学规则、不想换版式、还想让标签页一起变低调——这就是 PageMask。**

### 安装

Chrome 应用商店版本准备提交审核，通过后这里会补上商店安装链接。目前可从源码安装（开发者模式自用），需要 **Chrome 116 或更高版本**：

1. 下载或克隆本仓库
2. `npm ci && npm run build`
3. 打开 Chrome → 地址栏输入 `chrome://extensions` → 打开右上角「开发者模式」
4. 点「加载已解压的扩展程序」→ 选择项目的 `.output/chrome-mv3` 目录

### 升级：换版本不丢设置

开发者模式加载的扩展靠**文件夹位置**认身份，设置按「这个扩展」存——换文件夹或点「移除」，浏览器就当成另一个扩展，设置全部清空（所有扩展都这样，不是本扩展的毛病）。所以换版本时：

1. **覆盖到同一个目录**，不要解压到新文件夹（最省事：直接用仓库的 `.output/chrome-mv3`，`npm run build` 会原地更新它）
2. 回到 `chrome://extensions`，点这张卡片上的**刷新**按钮
3. **已经打开的页面再刷新一次**——内容脚本只在页面加载时注入

**确认身份没变**：`chrome://extensions` → 卡片「详情」→「ID」那串字符，升级前后应当一模一样。发布到商店后不存在这个问题：商店更新在原扩展上原地升级，设置不会丢。

### 使用方法

1. 打开要设置的网站，点工具栏的 PageMask 图标，点「收起内容」或「标题和图标」，在 Chrome 的提示里选「允许」（每个网站第一次会问这一次）
2. 「收起内容」分两步：先在页面上点选要收起的内容（已经收起的项也在清单里，点它就去掉），再「看效果」确认——保存就完成了；「标题和图标」填完点「保存」
3. 点页面上的悬浮按钮可以临时看网站原样；想改设置，用弹窗里的「收起内容」「标题和图标」，或悬浮按钮的「⋯」菜单
4. 弹窗底部两个入口：「全部网站设置」（网站列表与每个网站的设置页）、「插件设置」（默认标题、快捷键、不透明度、导出 / 导入、界面语言）
5. 想整个页面变黑白，点悬浮按钮上的「媒体」钮（或弹窗、站点设置页里的「整页变灰」，三处是同一组设置）；想临时遮住整页，用「遮住这一页」，恢复时点页面上的睁眼小按钮

### 已知限制

- 不支持 `chrome://` 内部页面、`file://` 本地文件、Chrome 应用商店页面
- iframe 与 shadow DOM **内部**的元素暂时点不到（外层容器可以）
- 「整页变灰」只是去掉颜色：页面内容照常加载，既不省流量，也不代替广告过滤工具；本扩展自己的悬浮按钮等界面也会跟着变黑白（功能不受影响）；`<audio>` 与一切声音不参与；「点击视频放行」按最近一次点击位置判断，个别播放器结构特殊的站点可能需要直接点视频本体
- 幕布遮住时会把当前标签页连声音一起按住，恢复（或刷新、离开页面）时声音跟着回来；你自己用 Chrome 右键或播放器做的静音不受影响
- 幕布只挡眼睛不挡输入：视频全屏、页面里的对话框会盖住幕布；键盘焦点仍在页面里，继续打字仍会改内容；刷新或离开页面后幕布消失
- 标签页悬停缩略图、浏览器历史记录里的标题由浏览器自己绘制，扩展改不到
- 界面语言默认跟随浏览器，可在插件设置里改成简体中文或 English

### 隐私与权限说明（Chrome 应用商店审核适用）

- **不收集、不上传任何数据**。PageMask 自身不发起任何网络请求，没有统计，没有第三方代码。设置仅存在 `chrome.storage.local`
- **在线版本**：[落地页](https://cherishfall.github.io/page-mask/)（含[隐私政策](https://cherishfall.github.io/page-mask/privacy.html)在线版，与本仓库的 `docs/PRIVACY.md` 内容一致）
- 权限逐项说明：
  - `storage`：在本机保存你的网站设置（收起的内容、标签页标题与图标、开关状态，以及「整页变灰」开关）
  - `scripting`：只对你已添加的网站——注册内置内容脚本、在已打开的标签页里运行一次、按需增删你设置的收起样式
  - `activeTab`：打开弹窗时读取当前标签页的网址，用来判断是哪个网站、是否支持
  - 可选主机权限：只在你点「收起内容」或「标题和图标」时按站点申请（一个可注册域名，即裸域 + 子域两条模式；IP、`localhost` 与带端口的地址按原样精确匹配），用于在该网站上运行内容脚本、应用你设置的收起样式与标题图标
- 收回访问权限：「全部网站设置」列表该行的「⋯」菜单点「删除这个网站的设置」，或在该网站的设置页点同名项，或用弹窗最底部的同名入口（会同时删掉该网站的设置），或在 Chrome 扩展详情页的「网站访问权限」里移除
- 本仓库不作为任何配置分发通道，不提供预置规则

### 面向开发者

**技术栈**：[WXT](https://wxt.dev)（Web Extension Tools，MV3 框架）+ Vue 3 + TypeScript；单元测试 vitest，E2E 用 puppeteer-core 驱动真实 Chrome（Chrome for Testing）。需要 Node ≥ 22.13。依赖一律精确版本。

```bash
npm ci                # 按 lockfile 精确安装
npm run dev           # 开发模式
npm run build         # 构建到 .output/chrome-mv3
npm run zip           # 打包商店上传 zip
npm run compile       # vue-tsc 类型检查
npm test              # 单元测试（vitest）
npm run test:e2e      # 真实 Chrome 全量 E2E（见 tests/e2e）
npm run check:docs    # 用户可见文档禁词与链接守门
npm run check:package # 构建产物 manifest 守门
```

**代码导览**：`entrypoints/` 各入口（popup、background、content、各页面）；`core/` 纯逻辑，不碰 DOM，单测最密；`ui/` Vue 组件；`styles/` 设计 token（界面样式只用 `--pm-*` 变量）。改完代码重新 `npm run build` 后，回到 `chrome://extensions` 点刷新，**已打开的页面要再刷新一次**（内容脚本只在页面加载时注入）；出问题时看两处日志——页面的 DevTools Console、`chrome://extensions` 里本扩展的「服务工作进程」→「检查」。

**二次开发先读**：[docs/design.md](docs/design.md)（最终设计共识，实现的唯一依据）、[docs/GLOSSARY.md](docs/GLOSSARY.md)（术语表，唯一权威）、[docs/design-ui.md](docs/design-ui.md)（界面基础规范）、[docs/adr/](docs/adr/)（架构决策记录）。改用户可见文案需过 `npm run check:docs`；新增 / 升级依赖后运行 `npm run notices` 重新生成第三方声明（CI 校验其未过期）。

欢迎 fork 与二次开发（[MIT](LICENSE)）；问题与想法请到 [GitHub Issues](https://github.com/cherishfall/page-mask/issues)。

## English

**PageMask** is a Chrome extension: on sites you add yourself, click the parts of a page you don't want (promos, feeds, sidebars, footers…) and they're gone. The tab title and icon can go low-key too.

**Core principle: zero impact until you opt in.** Until you explicitly add a site, PageMask injects no script, no style, and no UI into any page.

### Features

**Point-and-click hiding** — hover to highlight, click to select what you don't want (multi-select supported), use "bigger / smaller" to adjust the range — no CSS knowledge needed. Three hide methods: **disappear** (gone, and the content below moves up), **keep space** (invisible, but the space stays), **cover** (a block in the page color sits on top — the site's own styles are left untouched, and the method does not depend on how the site is styled). Change the method per element and check the result before saving; you can also decide "where it applies" — the whole site, or only these pages / except these pages (worked out from the current address, no typing). If a site redesign means an item can no longer be found, you get a heads-up to pick it again.

**Tab title & icon** — make a site's tab low-key: set the tab title (default "Reading") and pick an icon — the site's own, none, or one of 10 built-in icons. If the site rewrites its title, it is changed back automatically. A title-only site doesn't need anything hidden — that is a real, first-class setup too.

**Whole-page gray** — one per-site switch: the entire page turns black & white — text, pictures, videos, background images alike; same place, same size, links still work, text stays readable. Videos that autoplay are held down; click one to watch that one. Sound is not touched at all. Flip it from the floating button's "Media" button, the popup or the site's settings page — or press the shortcut (Ctrl+Shift+Y by default, ⌘+Shift+Y on Mac); the state is remembered per site. It has its own switch and does not follow "Your settings / As is"; it also works on sites you haven't set up — the first flip asks for that site's access, first-time-style.

**Curtain** — "Cover this page" covers the whole page and the tab title (say, when someone walks over) and holds that tab's sound; one more click brings everything back. After covering, a small draggable open-eye button remains — hovering it reveals the word "Restore". There is also a shortcut (Ctrl+Shift+X by default, ⌘+Shift+X on Mac) — the floating button, the popup and the shortcut share one state, so any of them can undo any other. It works on sites you have not added too.

**Floating button** — a capsule at the bottom-right of the page: click it to flip between "Your settings" and "As is" (all tabs of that site switch together); press and drag it anywhere; its idle opacity is adjustable from 10% to 100% (how faint it sits when idle is your call; it turns clear the moment you touch it); if it feels intrusive, hide it per site from the popup — showing it again puts it back at the bottom-right.

**Settings & data** — "All site settings" lists the sites you added; click one for its settings page. "Settings" holds the default title, the keyboard shortcuts, the floating button's opacity, export / import, interface language and version info, and is registered as Chrome's "Options" page. All site settings plus the plugin settings export as one file (the file name carries the version and the export time); import it on another computer. The whole interface is bilingual (Chinese and English) and switching takes effect immediately.

**Privacy baseline** — only sites you explicitly add are touched; everything else is completely unaffected. No account, no sync — settings stay on this device. PageMask itself makes no network requests; there is no analytics and no third-party code.

### Compared to similar tools: which fits you

| Tool type | Example | Best for | Not so good for |
|---|---|---|---|
| Ad blockers | uBlock Origin | Systematically blocking ads & trackers, globally; okay with rule concepts | Hiding just a few specific elements with zero learning curve |
| Reader modes | Just Read, SimpRead | Immersive long-form reading, magazine layout, highlights & sync | Keeping the original layout and only subtracting; non-article pages like homepages or forums |
| Feed blockers | News Feed Eradicator | Breaking doom-scrolling on a preset list of social sites | Other sites; picking arbitrary elements yourself |
| **PageMask** | — | Zero expertise — click any element with live preview; per-site switch, revert anytime; tab title & icon go low-key too; settings fully local | Blocking ads & trackers (use an ad blocker); re-laid-out immersive reading (use a reader mode); automatic multi-device sync (PageMask offers export/import) |

In one line: **a clean page without learning rules or switching layouts — and your tab goes low-key too.**

### Install

The Chrome Web Store version is being prepared for review; the store link will be added here once it is approved. For now you can install from source (developer mode, for personal use). Requires **Chrome 116 or later**:

1. Clone or download this repo
2. `npm ci && npm run build`
3. Open `chrome://extensions` and enable **Developer mode**
4. **Load unpacked** → select the project's `.output/chrome-mv3` directory

### Upgrading without losing your settings

An unpacked extension is identified by the folder it was loaded from, and settings belong to "this extension" — a different folder or clicking **Remove** makes Chrome treat it as a different extension, and everything is wiped (that's how Chrome treats every extension, not something specific to PageMask). So when a new version comes out:

1. **Overwrite the same folder** — don't unzip into a new one (easiest: keep loading the repo's `.output/chrome-mv3`, which `npm run build` refreshes in place)
2. Back in `chrome://extensions`, click the **reload** button on the extension card
3. **Reload any open pages** — the content script is only injected when a page loads

**To confirm the identity didn't change**: `chrome://extensions` → **Details** on the card → the **ID** string should be identical before and after. Once published on the Chrome Web Store this stops mattering: store updates upgrade the same extension in place and keep your settings.

### How to use

1. Open the site you want to tidy up, click the PageMask toolbar icon, click "Hide items" or "Title & icon", and choose Allow in Chrome's prompt (asked once per site, the first time)
2. "Hide items" takes two steps: pick what to hide on the page (what you hid before is already in the list — click it to take it out), then check the result — saving completes it; "Title & icon" is saved with "Save"
3. Click the floating button to see the site as it is; to change settings, use the popup's two buttons or the "⋯" menu on the floating button
4. Two entries at the bottom of the popup: "All site settings" (the site list and each site's settings page) and "Settings" (default title, keyboard shortcuts, opacity, export / import, interface language)
5. To turn the whole page black & white, click the floating button's "Media" button (or the "Whole-page gray" switch in the popup or on the site's settings page — all three are the same setting); to cover the page for a moment, use "Cover this page" and click the small open-eye button to restore

### Known limitations

- Doesn't run on `chrome://` pages, `file://` local files or the Chrome Web Store
- Elements **inside** iframes and shadow DOM can't be picked yet (their outer container can)
- "Whole-page gray" only removes **the color**: the page still loads as usual, so this is neither a data saver nor an ad blocker; PageMask's own interface (the floating button and friends) turns black & white with the page — it keeps working; `<audio>` and sound in general are not touched; the click-to-allow rule for videos looks at where you last clicked, so on sites with unusual player structures you may need to click the video itself
- Covering the page also holds that tab's sound; uncovering, reloading or leaving the page brings it back. A mute you set yourself (Chrome's "Mute site" or the player) is not touched
- The curtain blocks sight, not input: fullscreen video and in-page dialogs render above it; keyboard focus stays in the page, so typing still edits content; the curtain disappears on reload or navigation
- Tab hover previews and the titles in browser history are drawn by the browser; the extension can't change them
- The interface language follows the browser by default; switch to Simplified Chinese or English in Settings

### Privacy & permissions (for Chrome Web Store review)

- **No data collection, no uploads.** PageMask itself makes no network requests; there is no analytics and no third-party code. Settings live only in `chrome.storage.local`
- **Online version**: the [landing page](https://cherishfall.github.io/page-mask/) (which carries the online [privacy policy](https://cherishfall.github.io/page-mask/privacy.html), same content as `docs/PRIVACY.md` in this repo)
- Permissions, one by one:
  - `storage`: saves your per-site settings (hidden items, tab title and icon, switch state, and the "Whole-page gray" switch) on this device
  - `scripting`: for sites you have added only — registers the bundled content script, runs it once in the already-open tab, and inserts/removes the hiding styles you configured
  - `activeTab`: when you open the popup, reads the active tab's URL to identify the site and check whether it is supported
  - Optional host permissions: requested for that site only when you click "Hide items" or "Title & icon" — one registrable domain, so the bare domain plus its subdomains (IP addresses, `localhost` and addresses with a port are kept exact); used to run the content script and apply your hiding styles and tab title/icon on that site
- Revoking access: use "Delete this site's settings" from the ⋯ menu of that row in "All site settings", on the site's settings page, or at the very bottom of the popup (this also deletes its settings), or remove it under "Site access" in Chrome's extension details page
- This repository distributes no site presets or configurations

### For developers

**Stack**: [WXT](https://wxt.dev) (Web Extension Tools, MV3 framework) + Vue 3 + TypeScript; unit tests with vitest, E2E drives a real Chrome (Chrome for Testing) with puppeteer-core. Requires Node ≥ 22.13. Dependencies are pinned to exact versions.

```bash
npm ci                # install exactly what the lockfile pins
npm run dev           # dev mode
npm run build         # build into .output/chrome-mv3
npm run zip           # package a store upload zip
npm run compile       # vue-tsc type check
npm test              # unit tests (vitest)
npm run test:e2e      # full E2E in real Chrome (see tests/e2e)
npm run check:docs    # gate: forbidden words & links in user-facing docs
npm run check:package # gate: built manifest invariants
```

**Code tour**: `entrypoints/` holds the entry points (popup, background, content, pages); `core/` holds the pure logic — no DOM access, the densest unit-test coverage; `ui/` holds the Vue components; `styles/` holds the design tokens (UI styles use `--pm-*` variables only). After changing code, run `npm run build` again and hit **reload** on the extension card in `chrome://extensions` — and **reload open pages too** (the content script is only injected when a page loads). When something looks wrong, check two places: the page's DevTools Console, and "service worker" → "Inspect" on the extension card.

**Read before forking**: [docs/design.md](docs/design.md) (the final design consensus — the single source of truth for the implementation), [docs/GLOSSARY.md](docs/GLOSSARY.md) (glossary, the single authority), [docs/design-ui.md](docs/design-ui.md) (UI base spec), [docs/adr/](docs/adr/) (architecture decisions). Copy changes to user-facing text must pass `npm run check:docs`; after adding or upgrading dependencies, run `npm run notices` to regenerate the third-party notices (CI checks they are fresh).

Forks and derivative work are welcome ([MIT](LICENSE)); issues and ideas go to [GitHub Issues](https://github.com/cherishfall/page-mask/issues).

## License

MIT
