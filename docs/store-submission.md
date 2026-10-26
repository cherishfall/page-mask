# Chrome Web Store 上架全套指南（PageMask）

面向第一次提交 Chrome 扩展商店的完整教程，所有需要填写的内容都已写好，直接复制粘贴即可。资料清单与商店文案基于「清爽模式/专注阅读」定位（2026-10-26 与用户确认的策略：功能不变，用途表述用商店成熟品类的话术，降低审核风险）。

## 0. 已备齐的资料（都在本仓库）

| 资料 | 位置 | 说明 |
|---|---|---|
| 上传包 | `npm run zip` → `.output/page-mask-0.1.0-chrome.zip` | 已验证可构建（84KB） |
| 商店图标 | `docs/store-assets/icon-128.png` | 128×128，已同步进扩展 manifest |
| 截图 ×4 | `docs/store-assets/screenshot-*.png` | 1280×800 标准尺寸：清爽生效页 / 向导预览 / 弹窗（居中放大展示图）/ 管理页 |
| 宣传图块 | `docs/store-assets/promo-tile-440x280.png` | 440×280，品牌 + 一句话定位，建议上传 |
| 商店文案 | 本文 §3 | 中英双语，可直接粘贴 |
| 隐私政策 | 仓库 `PRIVACY.md`（英文版） | 隐私政策 URL 填其 GitHub 页面链接 |

截图不够时补充：`node tests/e2e/store-shots.mjs` 重新生成（需要 Chrome for Testing，见 `tests/e2e/`）。

## 1. 注册开发者账号（一次性，约 10 分钟）

1. 准备一个 Google 账号，**先给它开启两步验证**（myaccount.google.com → 安全性）——这是注册开发者账号的硬性要求
2. 打开 https://chrome.google.com/webstore/devconsole/register
3. 同意条款 → 选择「公开发布」身份（个人即可）→ 支付一次性注册费 **5 美元**
   - 中国大陆付款：双币信用卡（Visa/MasterCard）一般可直接支付；若失败，换账单地址为英文拼写的地址重试，或使用支持外币支付的虚拟卡
4. 验证邮箱 → 注册完成

> 注意：新开发者账号首次提审的审核时间可能偏长（几天到两周不等），属正常现象。

## 2. 上传与提交流程

1. 开发者控制台 → 「新增项」→ 上传 `page-mask-0.1.0-chrome.zip`
2. 左侧逐项填写（下面 §3–§5 全部给出现成内容）
3. 「提交审核」→ 等待邮件通知（一般 1–7 天，新号可能更久）

## 3. 商店信息（Store listing，逐字段粘贴）

### 中文（zh-CN）

- **名称**（≤45 字符）：`PageMask · 页面清爽模式`
- **简短说明**（≤132 字符）：
  `一键收起网页上的干扰元素，专注阅读。支持自定义标签页标题与图标，每个网站单独开关，配置完全本地保存。`
- **详细描述**：
```
PageMask 给你一个清爽专注的阅读界面。

【它能做什么】
• 清爽模式：鼠标点选页面上让你分心的元素（推荐流、横幅、评论区……），一键收起，页面瞬间清爽
• 三种收起方式：彻底移除（内容上移）、原地留白（保留位置）、透明遮盖（不改网站任何样式，任何网站都可用）
• 标签页自定义：把标签页标题换成「新建标签页」等低调样式，图标换成中性样式
• 按站点记忆：每个网站独立开关，只对你添加的网站生效
• 失效提醒：网站改版导致规则失效时，用大白话提醒你重新设置
• 导出/导入：配置导出为一个文件，换电脑不丢失

【为什么放心】
• 零影响原则：不添加任何网站，插件不会向任何页面注入任何内容
• 完全本地：所有配置只保存在你自己的浏览器里，不联网、不上传、无统计
• 权限最小：只在你主动为某个网站开启时才申请该网站权限，随时可收回

【怎么用】
1. 打开想变清爽的网站，点工具栏的 PageMask 图标
2. 点「开启清爽模式」，鼠标点选要去掉的元素，预览满意后保存
3. 完成！点页面右下角小胶囊可随时还原
```

### English（en-US）

- **Name**: `PageMask — Clean & Focused Pages`
- **Summary**:
  `Hide distracting page elements for focused reading. Custom tab title & favicon, per-site switch, fully local.`
- **Detailed description**:
```
PageMask gives you a clean, focused reading interface.

WHAT IT DOES
• Clean mode: click to pick distracting elements (feed, banners, comment boxes...) and collapse them instantly
• Three hiding strategies: remove (content shifts up), blank-in-place, or a neutral overlay that touches no site styles — works on any site
• Tab customization: set a low-key tab title (e.g. "New Tab") and a neutral favicon
• Per-site memory: an independent switch for each site; only sites you add are ever touched
• Health notices: if a site redesign breaks your rules, you get a plain-language heads-up
• Export / import: all settings in one file, portable across machines

WHY IT'S SAFE
• Zero impact by default: no script, style or UI is injected into any page until you opt in per site
• Fully local: settings live only in your browser. No network calls, no analytics
• Minimal permissions: host access is requested per site, only when you enable it, revocable anytime

HOW TO USE
1. Open the site you want to clean, click the PageMask toolbar icon
2. Click "Enable clean mode", pick the elements to remove, preview and save
3. Done! The small capsule button in the corner toggles it back anytime
```

### 其它字段

- **类别**：生产力（Productivity）
- **语言**：中文（简体）+ English（各填一份上面的文案）

## 4. 图形资产（Graphics）

- **商店图标**：`docs/store-assets/icon-128.png`（128×128）
- **截图**（至少 1 张，至多 5 张，1280×800）：`screenshot-1-clean-page`（主图）、`screenshot-2-wizard`、`screenshot-4-management`、`screenshot-3-popup`
- **小型宣传图块**（440×280，可选但建议）：`docs/store-assets/promo-tile-440x280.png` 已备好
- 注意：截图里不要出现「伪装/摸鱼」等字样（当前截图已是清爽话术 UI）

## 5. 隐私（Privacy）与合规答复

隐私标签页逐项选「否」——本扩展**不收集任何数据**：

- Does not sell or transfer data to third parties: **是（不收集）**
- Does not use data for unrelated purposes / credit / lending / 不用于任何目的：全部按「不收集」勾选
- **隐私政策 URL**（建议填写）：填 `https://github.com/cherishfall/page-mask/blob/master/PRIVACY.md`
- **单一用途说明（Single purpose）**，粘贴：
```
Customizes how web pages are displayed for focused reading: hiding user-selected distracting elements and adjusting the tab's title/favicon, on a per-site opt-in basis.
```
- **权限理由（Permission justification）**，粘贴：
```
storage: saves the user's per-site cleaning rules locally in the browser.
scripting: injects the user-authored hiding styles into tabs, on sites the user explicitly enabled.
activeTab: determines the current tab to act on when the user clicks the toolbar action.
optional host permissions: requested one site at a time, only when the user clicks "Enable clean mode" for that site; used to register the content script that renders the user's chosen clean layout. Never requested globally.
```

### 给审核员的备注（Item 里的 "Notes" / 审核备注字段，建议填写）

```
PageMask is a per-site page decluttering tool. It injects content scripts ONLY into sites the user explicitly enables via the popup (optional host permissions, one site at a time), lets the user pick distracting elements with a visual wizard, and applies hiding styles via chrome.scripting.insertCSS. Tab title/favicon customization is applied only on enabled sites in "clean mode". There is no network activity, no data collection, no remote code, and no bundled site presets.
```

### 远程代码声明

提交表单会问是否使用远程代码：勾选「否」。本扩展无任何远程加载的脚本/样式/配置（构建产物静态自包含，代码中无 eval / 远程 URL 引用），满足 MV3 远程代码禁令。

## 6. 分发设置（Distribution）

- 可见性：公开（Public）→ 「Chrome 商店内公开列出」
- 地区：所有地区
- 明确「无需登录」即可使用

## 7. 审核与常见拒因对照（本插件的预防）

| 常见拒因 | 我们的预防 |
|---|---|
| 用途描述含糊或单一用途不清 | §5 的单一用途说明明确单一：按站点定制页面展示 |
| 权限过大/与用途不符 | 权限最小化设计：可选主机权限逐站点申请，可收回（README 隐私节有说明） |
| 隐私声明与实际不符 | 无任何网络请求与数据收集，PRIVACY.md 如实声明 |
| 误导性功能描述 | 商店文案只描述实际存在的功能（隐藏元素/标签页自定义），无夸大 |
| 商标/版权素材 | 图标与截图全部为本仓库程序生成，无第三方素材 |

若被拒：控制台会给出原因编号，对照 https://developer.chrome.com/docs/webstore/review-process 修改后重传即可，重传免费。

## 8. 后续版本更新流程

1. 改代码 → `npm test` + `npm run compile` 全绿
2. `package.json` 版本号 +0.0.x → `npm run build && npm run zip`
3. 控制台该扩展 → 「打包」页上传新 zip → 提交审核（老账号更新审核通常 1–3 天）
4. CHANGELOG.md 补双语条目

## 8.5 提交前自查清单（全部打勾再点提交）

- [ ] zip 是最新构建（`npm run build && npm run zip`，版本号比已发布版本大）
- [ ] manifest description ≤132 字符、name ≤45 字符（当前满足）
- [ ] 截图全部 1280×800、图标 128×128（已验证尺寸）
- [ ] 截图与描述中无「伪装/摸鱼」等字样，全部为清爽话术 UI
- [ ] 隐私标签全部勾「不收集」，隐私政策 URL 可公开访问
- [ ] 单一用途说明、权限理由、审核员备注已粘贴
- [ ] 远程代码勾「否」
- [ ] 语言 zh-CN 与 en-US 两份文案都已填写

## 9. 名字策略（已定，2026-10-26 与用户确认）

**保留 PageMask 品牌名 + 品类副标题**（中「PageMask · 页面清爽模式」/ 英 "PageMask — Clean & Focused Pages"）。理由：商店第一印象由「图标+名称+副标题+首图」四件套共同承担，品牌名管记忆与搜索，副标题管品类认知（命中「清爽」搜索词）；纯描述性名字会同质化且锁死后续扩展方向。竞品空位分析见 README「与同类工具的定位差别」一节。若日后要换店名，只改 §3 名称字段与 manifest `name` 即可，与仓库名互不影响。
