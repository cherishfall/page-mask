# PageMask · 页面清爽模式

> 点选网页上让你分心的元素，一键收起；标签页标题和图标也能一起变低调。
> Hide the distracting parts of a page with a click — and keep the tab low-key.

[中文](#中文) · [English](#english)

---

## 中文

**PageMask** 是一个 Chrome 扩展：你主动添加的网站，可以点选页面上让你分心的部分（推广位、推荐流、侧栏、页脚……）一键收起；标签页的标题和图标也可以换成低调的样子。适合想安静看内容、又不想学规则写法的场景。

**核心原则：你不主动设置，PageMask 对任何网站都没有影响。** 不添加任何网站，PageMask 不会向任何页面注入脚本、样式或界面。

### 功能

- **按网站生效**：只有你主动添加的网站才会被处理，其它网站完全不受影响
- **零专业知识点选**：悬停高亮、点击选中（可连选），用「选大一点 / 选小一点」调整范围，不需要懂 CSS
- **三种收起方式**：消失（下方内容上移）/ 留空（位置保留）/ 盖住（不改网站自身样式，任何网站都可用）
- **保存前预览**：每个元素都能单独换收起方式，满意再保存
- **生效范围**：整站，或「只在这类页面 / 除了这类页面」（零输入，从当前地址推导）
- **只想改标题也可以**：不收起任何元素，只为某个网站换个标签页标题 / 图标，一样是一份正经设置
- **标签页标题与图标**：可为该网站设置标签页标题（默认「阅读」）和图标；图标三层生效顺序——网站自己设的 > 插件默认图标 > 透明（不显示），网站自己改标题会被自动改回
- **设置分成两个页面**：「你添加的网站」是网站列表，点进去是一个网站的设置页；「插件设置」放默认标题、默认图标、导出 / 导入、界面语言与版本信息，也是 Chrome 的「扩展程序选项」
- **每个网站一个开关**：页面右下角的小按钮一点即可切回原样，同一网站的所有标签页一起切换
- **失效提醒**：网站改版导致某条规则找不到目标时，会用人话提醒你重新选择
- **幕布**：面板上的「遮住本页 / 恢复本页」一键把整页连同标签页标题一起遮住，再一键回到点击前的样子；遮住后页面上是一颗睁眼的小按钮，可以拖动，鼠标移上去显出「恢复」。没添加过的网站也能用
- **界面语言**：全界面中英双语，插件设置里可选（跟随浏览器 / 简体中文 / English），切换立即生效
- **导出 / 导入**：全部网站设置和插件设置导出为一个文件（文件名带版本号与导出时间），换电脑后导入
- **配置只存在本机**：没有账号、没有同步、PageMask 自身不发起任何网络请求

### 与同类工具：各自适合什么

不同工具解决不同问题，选适合你的：

| 工具类型 | 代表 | 最适合 | 不太适合 |
|---|---|---|---|
| 广告拦截器 | uBlock Origin | 系统性屏蔽广告与追踪、全局生效；愿意了解一点规则概念 | 只想收起某几个特定元素、完全不想碰规则 |
| 阅读模式 | 简悦 SimpRead、Just Read | 长文沉浸阅读、杂志式排版、标注与同步等阅读增强 | 想保留原页面布局只做减法；首页、社区等非文章页 |
| 信息流屏蔽 | News Feed Eradicator | 戒掉预置社交网站的信息流刷屏 | 其他网站、自选任意元素 |
| **PageMask** | — | 零专业知识、鼠标点选任意元素即时预览；按网站独立开关、随时还原；标签页标题图标一起变低调；配置完全本地 | 拦截广告与追踪（请用广告拦截器）；重排版式的沉浸长文（请用阅读模式）；多设备自动同步（PageMask 提供导出/导入） |

一句话：**页面要清爽，但不想学规则、不想换版式、还想让标签页一起变低调——这就是 PageMask。**

### 安装（开发者模式自用）

需要 **Chrome 116 或更高版本**。

1. 下载或克隆本仓库
2. `npm ci && npm run build`（有 `package-lock.json`，用 `npm ci` 装出来的依赖与发布版一致）
3. 打开 Chrome → 地址栏输入 `chrome://extensions` → 打开右上角「开发者模式」
4. 点「加载已解压的扩展程序」→ 选择项目的 `.output/chrome-mv3` 目录

### 本地自测

1. 按上面的步骤加载后，打开任意你想变清爽的网站，点工具栏的 PageMask 图标（建议先把它固定到工具栏：拼图图标 → 图钉）
2. 改完代码重新 `npm run build` 后，回到 `chrome://extensions` 点这个扩展卡片上的**刷新**按钮；**已经打开的页面要再刷新一次**——内容脚本只在页面加载时注入
3. 想从头再来：在「你添加的网站」里打开该网站的设置页，点「删除这个网站的设置」，或点页面右下角小胶囊菜单里的同名项（两种方式都会同时收回授权），或直接在 `chrome://extensions` 移除扩展
4. 出问题时先看两处日志：页面的 DevTools Console（内容脚本的报错会打在这里）、`chrome://extensions` 里本扩展的「服务工作进程」→「检查」

之前装过 0.1.0 的话，对同一个目录点刷新即可，旧配置会保留；如果旧规则看起来不对，清空后重新设置一次最省事。

### 使用方法

1. 打开想变清爽的网站，点工具栏的 PageMask 图标，点「为当前网站开启清爽模式」，在 Chrome 的授权提示里选「允许」
2. 设置向导三步走：先填标签页标题和图标（只改标题也可以，直接完成），再点选要收起的内容，最后「看效果」确认——保存即完成
3. 想临时看原样，点页面右下角小胶囊里的「清爽 / 原样」；想改收起的内容，点胶囊上的「⋯」→「编辑收起的内容」，或从面板点「编辑当前网站」；想换标签页标题和图标，点胶囊上的「⋯」→「标签页标题和图标」就地改
4. 面板底部两个入口：「管理全部网站」（网站列表与每个网站的设置页）、「插件设置」（默认标题与图标、导出 / 导入、界面语言）
5. 想临时挡住整页，用面板或胶囊上的「遮住」；恢复时点页面上的睁眼小按钮

### 已知限制

- 不支持 `chrome://` 内部页面、`file://` 本地文件、Chrome 应用商店页面
- iframe 与 shadow DOM **内部**的元素暂时点不到（外层容器可以）
- 标签页悬停缩略图、浏览器历史记录里的标题由浏览器自己绘制，扩展改不到
- 幕布只挡眼睛不挡输入：视频全屏、页面里的对话框会盖住幕布；键盘焦点仍在页面里，继续打字仍会改内容；刷新或离开页面后幕布消失
- 界面语言默认跟随浏览器，可在插件设置里改成简体中文或 English

### 隐私与权限说明（Chrome 应用商店审核适用）

- **不收集、不上传任何数据**。PageMask 自身不发起任何网络请求，没有统计，没有第三方代码。配置仅存在 `chrome.storage.local`
- 权限逐项说明：
  - `storage`：在本机保存你的网站配置（收起规则、标签页标题与图标、开关状态）
  - `scripting`：只对你已开启的网站——注册内置内容脚本、在已打开的标签页里运行一次、按需增删你设置的收起样式
  - `activeTab`：打开 popup 时读取当前标签页的网址，用来判断是哪个网站、是否支持
  - 可选主机权限：只在你点「为当前网站开启清爽模式」时按单个网站申请，用于在该网站上运行内容脚本、应用你设置的收起样式与标题图标
- 收回权限：在「你添加的网站」里打开该网站的设置页点「删除这个网站的设置」，或点页面右下角小胶囊菜单里的同名项（会同时删除该网站的配置），或在 Chrome 扩展详情页的「网站访问权限」里移除
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

**PageMask** is a Chrome extension: on sites you add yourself, click the parts of a page that distract you (promos, feeds, sidebars, footers…) and they're gone. The tab title and icon can go low-key too. Built for quiet reading without learning rule syntax.

**Core principle: zero impact until you opt in.** Until you explicitly add a site, PageMask injects no script, no style, and no UI into any page.

### Features

- **Works per site**: only sites you add are touched; everything else is completely unaffected
- **Point-and-click, no expertise**: hover to highlight, click to select (multi-select supported), use "bigger / smaller" to adjust the range — no CSS knowledge needed
- **Three ways to hide**: disappear (content below moves up) / keep space (the gap stays) / cover (a solid patch over the element; the site's own styles are left untouched)
- **Preview before saving**: change the hiding method per element, then save
- **Scope**: whole site, or "only these pages / except these pages" (no typing — derived from the current address)
- **Title only is fine**: change just the tab title or icon of a site without hiding anything — that is a real, first-class setup too
- **Tab title & icon**: set a tab title (default "Reading") and icon per site; icons follow a three-layer order — the site's own icon > the default icon in Settings > transparent (nothing shown). If the site rewrites its title, it is changed back automatically
- **Settings split into two pages**: "Your sites" lists the sites you have added; click one to open that site's settings page. "Settings" is its own page with the default title, default icon, export / import, interface language and version info, and is registered as Chrome's "Options" page
- **One switch per site**: a small button at the bottom-right flips back to the original page; all tabs of that site switch together
- **Broken-rule notices**: when a site redesign means a rule no longer finds its target, you get a plain-language heads-up to re-pick it
- **Curtain**: the "Cover this page / Restore this page" switch in the popup covers the whole page and the tab title in one click, then goes straight back to what it was. After covering, a small open-eye button remains — draggable, and hovering it reveals the word "Restore". It works on sites you have not added too
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

### Local testing

1. After loading, open any site you want to declutter and click the PageMask toolbar icon (pin it first if you like: puzzle icon → pin)
2. After changing code and running `npm run build` again, click the **reload** button on the extension card in `chrome://extensions`; **reload open pages too** — the content script is only injected when a page loads
3. To start over: open that site's settings page from 「你添加的网站」 (Your sites) and use 「删除这个网站的设置」 (Delete this site's settings), or click the same item in the ⋯ menu of the small capsule at the bottom-right (this also revokes its permission), or remove the extension from `chrome://extensions`
4. When something looks wrong, check two places: the page's DevTools Console (content-script errors land there) and 「服务工作进程」 → 「检查」 (service worker → Inspect) on the extension card

If you had 0.1.0 loaded, just hit reload on the same folder — existing settings are kept. If old rules look off, reset that site and set it up again.

### How to use

1. Open the site you want to declutter, click the PageMask toolbar icon, click 「为当前网站开启清爽模式」 (Enable clean mode for this site) and choose Allow in Chrome's prompt
2. The setup wizard has three steps: first the tab title and icon (title only is fine — finish right there), then pick what to hide, then check the result — saving completes it
3. To see the original page, use 「清爽 / 原样」 (Clean / Original) on the small capsule at the bottom-right; to edit what's hidden, click 「⋯」→「编辑收起的内容」 (Edit hidden items) on the capsule, or 「编辑当前网站」 (Edit this site) in the popup; to change the tab title and icon, click 「⋯」→「标签页标题和图标」 (Tab title and icon) and edit in place
4. Two entries at the bottom of the popup: 「管理全部网站」 (Manage all sites — the site list and each site's settings page) and 「插件设置」 (Settings — default title and icon, export / import, interface language)
5. To cover the whole page, use 「遮住本页」 (Cover this page) in the popup or on the capsule; click the small open-eye button on the page to restore

### Known limitations

- Doesn't run on `chrome://` pages, `file://` local files or the Chrome Web Store
- Elements **inside** iframes and shadow DOM can't be picked yet (their outer container can)
- Tab hover previews and the titles in browser history are drawn by the browser; the extension can't change them
- The curtain blocks sight, not input: fullscreen video and in-page dialogs render above it; keyboard focus stays in the page, so typing still edits content; the curtain disappears on reload or navigation
- The interface language follows the browser by default; switch to Simplified Chinese or English in Settings

### Privacy & permissions (for Chrome Web Store review)

- **No data collection, no uploads.** PageMask itself makes no network requests; there is no analytics and no third-party code. Settings live only in `chrome.storage.local`
- Permissions, one by one:
  - `storage`: saves your per-site settings (hide rules, tab title and icon, on/off state) on this device
  - `scripting`: for sites you have enabled only — registers the bundled content script, runs it once in the already-open tab, and inserts/removes the hiding styles you configured
  - `activeTab`: when you open the popup, reads the active tab's URL to identify the site and check whether it is supported
  - Optional host permissions: requested for a single origin only when you click 「为当前网站开启清爽模式」, used to run the content script and apply your hiding styles and tab title/icon on that site
- Revoking access: open that site's settings page from 「你添加的网站」 (Your sites) and use 「删除这个网站的设置」 (Delete this site's settings), or click the same item in the ⋯ menu of the small capsule at the bottom-right (this also deletes its settings), or remove it under "Site access" in Chrome's extension details page
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
