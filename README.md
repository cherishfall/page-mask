# PageMask 页面面具

> 让非工作网站在一瞥之下"看起来不像它自己"。
> Make non-work sites stop looking like themselves at a glance.

[中文](#中文) · [English](#english)

---

## 中文

**PageMask** 是一个 Chrome 浏览器扩展：上班期间浏览非工作网站（微信读书、得到、极客时间、微博、即刻等）时，把页面上显眼的元素收起来，并把标签页的标题和图标换成低调的样子——有人经过时的一瞥之下，它不再像它自己。

**核心原则：用户不主动设置，插件对任何网站零影响。** 不添加任何站点，PageMask 不会向任何页面注入任何脚本、样式或界面元素。

### 功能

- **站点名单制**：只有你主动添加的网站才会被处理；未配置的网站完全不受影响
- **零专业知识点选**：鼠标悬停高亮、点击选中（可连选）、「选大一点 / 选小一点」调整层级——全程不需要懂 CSS
- **三种收起方案**：彻底移除（内容上移补位）/ 原地留白（保留位置）/ 遮罩覆盖（不改网站任何样式，保底可用）
- **标题与图标伪装**：标签页标题默认改为「新建标签页」，图标换为中性样式；网站动态改标题会被自动压回
- **每站点独立开关**：原样态 / 伪装态一键切换，同一网站所有标签页联动，状态按站点记忆
- **失效体检**：网站改版导致规则失配时，用人话提醒你重新设置
- **导出 / 导入**：全部配置导出为一个 JSON 文件，换电脑不丢失
- **完全本地**：所有配置只存在你自己的浏览器里，没有任何联网行为

### 与同类工具的定位差别

PageMask 的位置在「广告拦截器」和「阅读模式」之间的空档：

| 工具类型 | 代表 | 它们做什么 | PageMask 的不同 |
|---|---|---|---|
| 广告拦截器 | uBlock Origin | 全局规则拦截广告与追踪，规则体系面向高级用户 | 不拦广告、不需要规则：鼠标点哪个元素就收起哪个，预览满意再保存，随时还原 |
| 阅读模式 | 简悦 SimpRead、Just Read | 把文章**重排**成杂志式阅读版式 | 在**原页面做减法**，不改版式；可收起任意元素（推荐流、横幅、评论区），不止正文 |
| 信息流屏蔽 | News Feed Eradicator | 只针对预置的几个社交网站 | 任意网站都能用，收起什么由你自己点选 |
| 元素隐藏小工具 | 各类 "Hide xxx" | 功能单一，普遍粗糙或停更 | 完整产品：点选向导、实时预览、失效体检、按站点管理、导出导入，完全本地 |

一句话：**页面要清爽，但不想学规则、不想换版式、还想让标签页一起变低调——这就是 PageMask。**

### 安装（开发者模式自用）

1. 下载或克隆本仓库
2. `npm install && npm run build`
3. 打开 Chrome → 地址栏输入 `chrome://extensions` → 打开右上角「开发者模式」
4. 点「加载已解压的扩展程序」→ 选择项目的 `.output/chrome-mv3` 目录

### 使用方法

1. 打开你想伪装的网站，点浏览器工具栏的 PageMask 图标，点「为当前网站设置伪装」并允许授权
2. 点选页面上要藏起来的东西 → 预览（可给每个元素换收起方案）→ 保存
3. 完成。想临时还原，点页面右下角的小胶囊按钮；右键它可进入编辑面板
4. 所有站点的管理（标题/图标设置、一键清空、导出导入）在工具栏图标的「管理全部站点」

### 隐私与权限说明（Chrome 应用商店审核适用）

- **不收集、不上传任何数据**。无网络请求、无统计、无第三方代码。配置仅存于 `chrome.storage.local`
- 权限最小化设计：
  - `storage`：本地保存你的站点配置
  - `scripting` + `activeTab`：为当前标签页注入你设置的隐藏样式
  - 可选主机权限（`optional_host_permissions`）：逐站点按需授权——你在弹窗里点「允许」时才针对该站点生效，随时可通过「一键清空」收回
- 本仓库不作为任何配置分发通道，不提供预置规则

### 开发

```bash
npm install
npm run dev        # 开发模式
npm run build      # 构建到 .output/chrome-mv3
npm run zip        # 打包商店上传 zip
npm test           # 单元测试（vitest）
npm run test:e2e   # 真实 Chrome 全量 E2E（需 Chrome for Testing，见 tests/e2e）
```

设计文档见 [docs/design.md](docs/design.md)（最终设计共识）、[GLOSSARY.md](GLOSSARY.md)（术语表）、[docs/adr/](docs/adr/)（架构决策记录）。

## English

**PageMask** is a Chrome extension that makes non-work websites stop looking like themselves at a glance. While browsing reading/community sites during work hours, it collapses conspicuous page elements and replaces the tab title & favicon with low-key ones — so a passing glance no longer gives you away.

**Core principle: zero impact until you opt in.** Until you explicitly add a site, PageMask injects no script, no style, and no UI into any page.

### Features

- **Allowlist-based**: only sites you add are touched; everything else is completely unaffected
- **Zero-expertise picking**: hover to highlight, click to select (multi-select supported), "pick bigger / pick smaller" to adjust levels — no CSS knowledge needed
- **Three hiding strategies**: remove (content shifts up) / blank-in-place (space preserved) / overlay sticker (touches no site styles — always works)
- **Title & favicon disguise**: tab title becomes "New Tab" by default with a neutral icon; sites that rewrite their title dynamically get suppressed automatically
- **Per-site switch**: toggle between disguised / original with one click; all tabs of the same site switch together; state is remembered per site
- **Rule health check**: when a site redesign breaks a rule, you get a plain-language heads-up
- **Export / import**: all configs in one JSON file for moving between machines
- **Fully local**: everything stays in your browser. No network calls, ever

### How PageMask differs from similar tools

PageMask occupies the gap between ad blockers and reader modes:

| Tool type | Example | What they do | What PageMask does differently |
|---|---|---|---|
| Ad blockers | uBlock Origin | Block ads & trackers globally with rule systems aimed at power users | No rules needed: click any element to collapse it, preview, save, revert anytime |
| Reader modes | Just Read, SimpRead | **Re-layout** articles into a magazine-style view | Subtractive instead: keeps the original page, removes any element you pick — feeds, banners, comment boxes, not just the article |
| Feed blockers | News Feed Eradicator | Only a preset list of social sites | Works on any site; you choose what goes |
| Element hiders | Various "Hide xxx" utilities | Single-purpose, often rough or unmaintained | A complete product: pick wizard, live preview, health notices, per-site management, export/import — fully local |

In one line: **a clean page without learning rules or switching layouts — and your tab goes low-key too.**

### Install (developer mode)

1. Clone this repo
2. `npm install && npm run build`
3. Open `chrome://extensions`, enable **Developer mode**
4. **Load unpacked** → select the project's `.output/chrome-mv3` directory

### Privacy & permissions (for Chrome Web Store review)

- **No data collection, no network requests, no analytics, no third-party code.** Configs live only in `chrome.storage.local`
- Minimal permissions: `storage` (save your configs), `scripting` + `activeTab` (inject the hiding styles you configured), optional host permissions granted per-site only when you click "Allow", revocable at any time
- This repository distributes no site presets or configurations

## License

MIT
