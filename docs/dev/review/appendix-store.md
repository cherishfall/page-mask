# PageMask 0.1.0 商店合规与文档审查（只读审查，未改动任何项目文件）

审查对象：master @ da59f89。已核对：全部根目录文档、docs/**、wxt.config.ts、构建产物 manifest 与 zip、entrypoints/** 与 ui/** 的全部用户可见字符串、core/*.ts、9 张 evidence 图 + 6 张 store-assets 图（逐张看过）。
政策依据（2026-10 实时抓取）：
- [P-POL] Program Policies 总页 https://developer.chrome.com/docs/webstore/program-policies/policies （Impersonation、Listing Requirements、Keyword Spam、Minimum Functionality、Quality Guidelines/single purpose、Limited Use、Use of Permissions；并明确"政策适用于全部用户体验，含营销材料、落地页"）
- [P-DIT] Deceptive Installation Tactics https://developer.chrome.com/docs/webstore/program-policies/deceptive-installation-tactics
- [P-FAQ] User Data FAQ https://developer.chrome.com/docs/webstore/program-policies/user-data-faq （Q3：仅本地处理/存储的数据也须披露；Q4：用户数据含 Website content、Web browsing activity〔含域名/URL〕）
- [P-LIST] Store listing 填写说明 https://developer.chrome.com/docs/webstore/cws-dashboard-listing （名称/简短说明来自 manifest；本地化依赖 `_locales`；1280×800 截图 1–5 张；440×280 小图块）
- [P-PRIV] Privacy 字段说明 https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- [S-*] skill：SKILL.md Part 2、review-checklist.md、store-listing.md、privacy-policy.md、chromewebstore-template.md、permissions.md

已验证事实（供下文引用）：
- 代码中无 fetch/XHR/WebSocket/sendBeacon/eval/new Function；构建产物唯一 `fetch(` 是 Vite modulepreload 垫片（只取扩展包内 chunk）。字符串 URL 仅 `pagemask.invalid`、vuejs.org 报错链接、w3.org 命名空间。→「扩展自身不发起网络请求」成立；但见 D14（导入的远程 favicon）。
- zip 15 个文件、干净（无 map/测试/文档）。
- manifest：`permissions: storage, scripting, activeTab`；`optional_host_permissions: *://*/*`；`content_scripts` 有一条占位 `https://pagemask.invalid/*`；无 `_locales`；`icons` 仅 128；`action` 无 `default_icon`。
- 隐私政策 URL `https://github.com/cherishfall/page-mask/blob/master/PRIVACY.md` 经代理访问返回 200；issues 页 200。
- 收回授权只有一条 UI 路径：管理页「一键清空」（同时删除该站点全部配置）。没有"只收回授权"的界面。
- 透明 favicon 是 1×1 透明 PNG（core/disguise.ts:8）。

---

## 一、发现清单

### A. 审核风险 / 事实错误（P0）

**D1 · P0 · docs/store-assets/screenshot-3-popup.png（来源 core/origin.ts:32）**
原文（截图里的字）：「浏览器内部页面不支持伪装」
问题：商店截图直接出现「伪装」，而且展示的是报错态，没有体现任何功能。与 docs/store-submission.md:102「当前截图已是清爽话术 UI」、HANDOFF.md:21「用户可见层零『伪装/摸鱼』字样」都矛盾。审核员在 chrome:// 页面点开弹窗也会看到这句话。
建议：截图改为真实站点配置后的弹窗（显示 host、「清爽中」开关、规则数、「＋ 添加要去掉的元素」）。core/origin.ts 四条 reason 改为：
- 「浏览器内部页面无法使用 PageMask」/ "PageMask can't run on browser pages"
- 「本地文件页面无法使用 PageMask」/ "PageMask can't run on local files"
- 「Chrome 应用商店页面无法使用 PageMask」/ "PageMask can't run on the Chrome Web Store"
- 「此类页面无法使用 PageMask」/ "PageMask can't run on this page"
依据：[P-POL] Listing Requirements（截图不得 misleading/inaccurate/non-descriptive）；[S-review-checklist] Graphics。

**D2 · P0 · docs/store-assets/screenshot-4-management.png（来源 entrypoints/management/App.vue:12）**
原文：「站点未单独设置时使用。不能为空白——空白会让 Chrome 显示网址反而泄露。」
问题：「泄露」把功能目的写成"不让别人看出来"，与"专注阅读"定位矛盾，直接暴露真实意图，属于元数据和产品不一致。截图里站点是 `127.0.0.1`（一看就是测试环境），文件选择还是原生「选择文件 未选择任何文件」。
建议改写：「站点未单独设置时使用。不能留空：留空时 Chrome 会改为显示网址。」/ "Used when a site has no title of its own. Can't be empty: Chrome would show the page URL instead." 截图换成虚构但像样的域名（如 `reader.example`）。
依据：[P-POL] Listing Requirements；[P-DIT] "The features of your extension should be clear"。

**D3 · P0 · screenshot-1-clean-page.png、screenshot-2-wizard.png（证实并扩展 REVIEW A3）**
原文：截图 1「三体（纪念版）/ 刘慈欣 / 球状闪电 / 流浪地球 / 超新星纪元 / © 微信读书」；截图 2 顶栏「微信读书 书架 发现 想法」+《三体》。
问题：① 第三方商标（微信读书）和真实书名、作者名出现在商店素材里，可能被理解为暗示合作关系；② docs/store-submission.md:147 写「图标与截图全部为本仓库程序生成，无第三方素材」，不属实；③ 截图 1 有 70% 是空白，看不出前后对比；悬浮按钮只有约 30px，商店缩略图里看不见；④ 截图 2 工具条说明文字约 11px，商店里放大前读不清；⑤ 没有一张截图出现标签页（标题/图标功能完全没被展示）。
建议：用虚构品牌（如「Daily Reader」/「每日阅读」）和虚构内容；首图做左右"之前/之后"对比，配大字标注（≥28px）「点选 → 一键收起」；加一张带浏览器标签栏的截图，展示自定义标题/图标；工具条区域局部放大。
依据：[P-POL] Impersonation & IP（"don't represent that your product is authorized by… another company"）；[S-store-listing] §5 Trademark；[S-review-checklist] "No trademark violations… in screenshots"。

**D4 · P0 · 标题默认「新建标签页 / New Tab」+ 透明图标，有"模仿浏览器界面"的风险**
位置：core/types.ts:19、ui/content-runtime.ts:32、entrypoints/management/App.vue:11/88/123、README.md:21/87、CHANGELOG.md:13、docs/store-submission.md:48/76、docs/design.md:23。
原文：「标签页标题默认改为「新建标签页」，图标换为中性样式」/ "tab title becomes "New Tab" by default with a neutral icon"/ 商店文案「把标签页标题换成「新建标签页」等低调样式」/ "set a low-key tab title (e.g. "New Tab")"
问题：政策原文写明"Your Product and its user experience also must not mimic functionality or warnings from a user's operating system or browser"。默认把网页标签伪装成 Chrome 自己的"新建标签页"（Chrome 新标签页的图标本身也是空白），正属于模仿浏览器界面。商店文案还主动举了这个例子，审核员很容易据此定性。英文 Chrome 下中文标题反而更显眼（REVIEW A6），说明这个默认值本身也不好用。
建议（需要用户决策，涉及代码）：
- 方案 1（推荐）：默认标题改为不模仿浏览器的中性文字，例如 zh「阅读」/ en "Reading"，或者默认不改标题，由用户自己填。
- 方案 2（最低限度）：代码不改，但商店文案、截图、README 一律不出现 "New Tab"/「新建标签页」，只写"自定义标签页标题和图标"。
可直接替换的文案：zh「为这个网站自定义标签页标题和图标（例如换成你自己的备注文字）」/ en "Set a custom tab title and icon for the site (for example, your own short note)"。
依据：[P-POL] Impersonation & Intellectual Property。

**D5 · P0 · 商店名称和简短说明只能来自 manifest，store-submission §3 的填写方式无法执行（证实并升级 REVIEW A5）**
位置：docs/store-submission.md:38-40、66-68、95；wxt.config.ts:6-7。
原文：「名称（≤45 字符）：`PageMask · 页面清爽模式`」「简短说明…」「Name: `PageMask — Clean & Focused Pages`」「语言：中文（简体）+ English（各填一份上面的文案）」
问题：控制台的 Store listing 页只能填详细描述、类别、语言、图片和链接；名称和简短说明直接取 manifest 的 `name`/`description`，多语言靠 `_locales`。当前 manifest `name` 是 "PageMask"，`description` 只有中文，也没有 `_locales`。所以：① 商店标题只会显示 "PageMask"，不会带副标题；② 英文页的简短说明会是中文；③ "en-US 一份"根本选不到。另外，skill 清单要求"Name matches manifest"。
建议：加 `_locales/en/messages.json`（default_locale: en）和 `_locales/zh_CN/messages.json`，`name`/`description` 改成 `__MSG_extName__`/`__MSG_extDesc__`，值见第二部分。§3 改写为：「名称与简短说明来自扩展包内 manifest（多语言见 `_locales`），控制台不可单独填写；控制台只粘贴"详细描述"。」
依据：[P-LIST] "information… that isn't included in the metadata of the manifest"、Localize your listing；[S-review-checklist] Manifest & Package。

**D6 · P0 · README 和 CHANGELOG 的公开文案以"不被路过的人看出来"为卖点，与商店定位不一致（证实并扩展 REVIEW A4）**
位置与原文：
- README.md:1 「# PageMask 页面面具」
- README.md:3-4 「让非工作网站在一瞥之下"看起来不像它自己"。」/ "Make non-work sites stop looking like themselves at a glance."
- README.md:12 「上班期间浏览非工作网站…有人经过时的一瞥之下，它不再像它自己」
- README.md:21 「**标题与图标伪装**」；:22 「原样态 / 伪装态一键切换」；:49 「打开你想伪装的网站…点「为当前网站设置伪装」」
- README.md:78 "While browsing reading/community sites during work hours… so a passing glance no longer gives you away."；:87 "**Title & favicon disguise**"；:88 "toggle between disguised / original"
- CHANGELOG.md:13 「标题与图标伪装」；:27 "Title & favicon disguise"
- package.json:4 "让非工作网站在一瞥之下看起来不像它自己 / Make non-work sites stop looking like themselves at a glance"
问题：政策适用于"entire user experience… including marketing materials… landing pages"。仓库就是主页和支持链接，审核员会点进去。商店说"专注阅读"，README 却写"上班时不被发现"，会被认定为元数据误导，或者被认为刻意隐瞒真实用途（Deceptive Installation："functionalities… stated clearly and in a transparent manner"）。另外，README:49 的按钮名「为当前网站设置伪装」与界面实际文案「为当前网站开启清爽模式」（entrypoints/popup/App.vue:24）对不上。
建议：README/CHANGELOG/package.json 统一改用第二部分的定位文案；README 标题改为「# PageMask · 页面清爽模式」；步骤 1 改为「打开想变清爽的网站，点工具栏的 PageMask 图标 →「为当前网站开启清爽模式」→ 在浏览器弹窗里点「允许」」/ "Open the site, click the PageMask toolbar icon → 「为当前网站开启清爽模式」(Enable clean mode for this site) → click Allow in Chrome's prompt"；功能条目改为「标签页标题与图标自定义」/ "Custom tab title & icon"；「原样态/伪装态」改为「原样 / 清爽中」/ "original / clean"。
说明：我不建议把"让标签页别那么显眼"这层意思藏起来，审核员看到行为后发现隐瞒，风险更大。建议用中性、如实的说法："在共享屏幕或公共场合时，让标签栏少露出一些信息"，不出现"老板/上班/被发现"。
依据：[P-POL] 总则 + Listing Requirements；[P-DIT]。

**D7 · P0 · 英文商店文案描述了不存在的英文界面，遮罩方案的描述也与实现不符**
位置：docs/store-submission.md:75、88、47。
原文：EN "Click "Enable clean mode"…"；"a neutral overlay that touches no site styles — works on any site"；ZH「透明遮盖（不改网站任何样式，任何网站都可用）」
问题：① 界面只有中文（所有 .vue、`<html lang="zh-CN">`），没有叫 "Enable clean mode" 的按钮，英文用户按说明找不到；② 遮罩是不透明的 `#f4f4f4`（ui/content-runtime.ts:148），GLOSSARY:46 也写的是「不透明遮罩」，「透明遮盖」与事实相反；③ "works on any site / 任何网站都可用"不成立：chrome://、file://、Chrome 应用商店不支持（core/origin.ts），iframe 和 shadow DOM 里的元素选不了（design.md:93），晚加载的元素也不会被遮住（REVIEW C5）。
建议：EN 描述里注明 "The interface is currently in Simplified Chinese."，按钮写成「为当前网站开启清爽模式」(Enable clean mode for this site)；遮罩条目改为 zh「遮罩覆盖：在元素上盖一块纯色贴片，不改网站自身样式，适合前两种方式效果不理想的页面」/ en "Cover: places a solid patch over the element without changing the site's own styles — a fallback when the other two don't look right"。
依据：[P-POL] Listing Requirements（inaccurate metadata）；[S-store-listing] Rejection #3 Misleading description。

**D8 · P0 · 隐私政策写"什么都不收集"，但扩展在本地保存了网站相关数据；FAQ 要求本地数据也要披露**
位置：PRIVACY.md:7-9、:13；docs/store-submission.md:106-109。
原文："**Nothing.** The Extension contains no analytics…"；"Your configuration — which sites you enabled, which elements you chose to hide, your preferred tab titles/icons"；store-submission「隐私标签页逐项选「否」…不收集任何数据」
问题：[P-FAQ] Q3 明确"Extensions are required to disclose how they handle user data, even when data is processed or stored locally"。扩展实际在本地保存了：站点 origin（属于 Web browsing activity 的"域名"）、生效范围里的 URL 路径前缀（core/types.ts:24-26，如 `/web/reader/`）、元素名（取自页面文字、aria-label、alt、placeholder 的前 8 个字，core/naming.ts:19-46，属于 Website content）、CSS 选择器（可能包含页面里的 id 或属性值）、用户上传的图标、悬浮按钮位置、体检结果和时间戳、全局默认标题。另外，选择元素和体检时会在本地读取页面 DOM。现有政策只笼统写了"which sites…which elements"，没有提到 URL 路径和页面文字片段，也没写保留期限、政策变更和联系邮箱。
建议：① PRIVACY.md 按第二部分 §5 重写（逐项列出、注明"仅本机、开发者收不到"）；② 隐私表单：开发者确实收不到任何数据，不勾选数据类型有一定依据（业界纯本地扩展普遍这样填）。但 FAQ Q3 的措辞偏严，**我无法确认审核员按哪种口径判断**。更稳的做法是勾选 "Website content" 和 "Web history"，并在政策里说明"仅存本机、不传输"；代价是商店页会显示"会处理此类数据"。两种做法都必须勾选三条 Limited Use 证明。由用户决定，但政策文本必须如实列全。
依据：[P-FAQ] Q2–Q4；[P-POL] Limited Use / Listing Requirements（"privacy fields… contradicts… privacy policy, or the behavior"）；[S-privacy-policy]。

### B. 明显的质量或一致性问题（P1）

**D9 · P1 · PRIVACY.md:19 / README.md:60、116 / store-submission.md:56、84、144 —「随时可收回」的说法不准确**
原文："You can revoke any site at any time from the Extension's management page."；「随时可通过「一键清空」收回」；"revocable anytime"
问题：管理页没有单独的"收回授权"功能，只有「一键清空」，而它会同时删掉该站点全部规则（App.vue:66-69）。在 chrome://extensions 里手动收回授权后，扩展仍显示「清爽中」，实际已不生效（REVIEW E4，已证实：代码里没有 `permissions.onRemoved`）。
建议：zh「你可以随时收回某个网站的访问权限：在 PageMask 管理页对该网站点「一键清空」（同时删除该网站的配置），或在 Chrome 的扩展详情页"网站访问权限"中移除。」/ en "You can revoke a site's access at any time: use "Reset" (一键清空) for that site on the PageMask management page (this also deletes its settings), or remove it under Site access on Chrome's extension details page."

**D10 · P1 · PRIVACY.md:25 — 删除范围写得过宽**
原文："Uninstalling the Extension (or using its per-site "reset" feature) deletes all related data from your browser."
问题：卸载确实会清掉 storage.local 和动态注册（成立）。但单站点「清空」只删除该站点的数据，不删全局默认标题；用户导出的 JSON 文件留在磁盘上，扩展删不到。
建议："Uninstalling PageMask removes all of its stored data from your browser. "Reset" on a site removes that site's settings and access permission only. Files you exported yourself stay wherever you saved them."

**D11 · P1 · README.md:59、116 / PRIVACY.md:18 — 权限用途写得不准确**
原文：「`scripting` + `activeTab`：为当前标签页注入你设置的隐藏样式」；"`scripting` and `activeTab` — apply the hiding styles…"
问题：代码里，`activeTab` 只用于弹窗读取当前标签页的网址，判断是哪个网站、能否支持（popup/App.vue:47 `tabs.query`；没有 `tabs` 权限时，没有 activeTab 就拿不到 url）。之后每次打开页面的注入（insertCSS、registerContentScripts、executeScript）依靠的是用户授予的该站点主机权限，与 activeTab 无关。
建议：见第二部分 §3 的逐项理由。

**D12 · P1 · 管理页和隐私政策都没有联系邮箱，商店链接不完整**
位置：PRIVACY.md:27-29；store-submission 全文。
问题：skill 要求隐私政策"Include an email address at minimum"；[P-POL] 要求"meaningful customer support"，并保持联系信息有效。store-submission 没有提到 Contact email、Support URL、Homepage URL 怎么填。
建议：PRIVACY 加 `Email: <你的监控邮箱>`；控制台 Support URL 填 `https://github.com/cherishfall/page-mask/issues`，Homepage URL 填仓库首页（前提是 D6 已修）。

**D13 · P1 · store-submission.md:110 + HANDOFF.md:25 ④ — 隐私政策 URL 依赖 `master` 分支**
问题：HANDOFF 计划"master→main 改名"。改名后 `blob/master/PRIVACY.md` 会经 GitHub 重定向，一般仍能打开，但不保证长期有效。另外，blob 页面周围是代码仓库界面，审核员阅读体验一般。
建议：改用 GitHub Pages（`https://cherishfall.github.io/page-mask/privacy`）或 `blob/HEAD/PRIVACY.md`；或者明确不改分支名。

**D14 · P1 ·「无任何网络请求」在导入功能修好前存在反例（关联 REVIEW S1）**
位置：README.md:25、91、115；PRIVACY.md:9；CHANGELOG.md:19、33；store-submission.md:55、82、126。
问题：扩展代码本身确实不联网（已 grep 验证）。但导入的配置里 `faviconDataUrl` 可以是 `https://…`，选择器还可以注入 `url(...)` 样式，导致页面去请求外部地址。T1 修好之前，"no network requests of any kind"可能被指出不实。
建议：T1 合入前改为「PageMask 自身不发起任何网络请求」/ "PageMask itself makes no network requests"；T1 合入后可以恢复原说法。

**D15 · P1 · 图标问题（证实 REVIEW A1/A2，级别从 P0 下调为 P1）**
已证实：manifest 只有 128px 图标，action 没有 default_icon；图标是"蓝底文档加绿色对勾"，内容铺满整个画布、没有留白；宣传图块里的图标（灰色文档）与商店图标不是同一个。
调整理由：这些不会直接导致审核被拒（Chrome 会自动缩放），属于质量问题和品牌不一致。不过宣传图块与图标不一致，算是"不一致的元数据"的轻微风险。
建议照 REVIEW 的 T9 处理。注意不要用面具或🎭这类图案（见 D21）。

**D16 · P1 · docs/dev/evidence/real-dedao.png、real-mowen.png、e2e-disguised.png — 公开仓库里有第三方内容**
问题：real-dedao 里有真实人物的照片和姓名（万维钢、蔡钰等）以及商业广告；real-mowen 里有真实用户的昵称、头像和私人帖子内容（"今天，媳妇说…"）；real-weread 有微信读书 logo 和书籍封面；e2e-disguised 有极客时间课程名「左耳听风」。这些不在扩展包里，但仓库就是商店主页，涉及肖像、个人信息和版权。AGENTS.md:51 只规定了"用匿名可访问页面"，没有规定截图怎么处理。
建议：把这些图从仓库中移除（历史提交里仍有，需要用户决定是否改写历史），或者打码；在 AGENTS.md 补充规则：「真实网站截图不入库，或入库前对第三方人物、用户内容、商标打码」。

**D17 · P1 · 版本策略前后矛盾**
位置：HANDOFF.md:46「1.0.0 留给商店上架定版」；REVIEW A9「计划 1.0.0 定版」；store-submission.md:9、30「page-mask-0.1.0-chrome.zip」；§8「版本号 +0.0.x」。
建议：二选一后统一写进 store-submission。我的建议是：上架版本就是首次提交的版本，用 1.0.0（已有 REVIEW 的 11 张票待修，修完再定版）；之后修复递增 patch，加功能递增 minor。

**D18 · P1 · 透明 favicon 显示"通用地球图标"的说法很可能不对**
位置：docs/design.md:25「默认空白透明（Chrome 自动显示通用地球图标）」；core/types.ts:60「透明图标，Chrome 显示通用地球」。
问题：1×1 透明 PNG 是一张能正常加载的图片，Chrome 应该会照常显示它，也就是一块空白。通常只有没有 favicon 或图片加载失败时才显示默认地球。**我没有实测**，需要在 Chrome 里打开一次确认。
建议改写：「默认使用一张透明图标（标签页上显示为空白）；可上传自定义图片」。

**D19 · P1 · store-submission.md:106-109 隐私表单的填写说明有误导**
原文："Does not sell or transfer data to third parties: **是（不收集）**"；「Does not use data for unrelated purposes / credit / lending / 不用于任何目的：全部按「不收集」勾选」
问题：表单分两组：数据类型（勾选会处理的数据）和三条证明（必须全部勾选，与是否收集无关）。现在的写法把两组混在一起，第一次提交的用户容易填错。
建议：「① 数据类型：按 D8 的决策勾选或不勾选；② 下面三条证明全部勾选：不出售或转让给第三方（批准的用途除外）；不用于与单一用途无关的目的；不用于判断信用或放贷。」

**D20 · P1 · store-submission.md:115-121 权限理由不够准确，也不完整**
- "scripting: injects the user-authored hiding styles into tabs" → 漏了动态注册内容脚本和对已打开标签页的 executeScript。
- "activeTab: determines the current tab to act on" → 应写明"读取当前标签页的网址，判断是哪个网站"。
- "optional host permissions: …used to register the content script that renders the user's chosen clean layout. Never requested globally." → "renders… clean layout"说法含糊；manifest 声明的是 `*://*/*`，审核员看到的是"全部网站"，需要解释为什么这样声明，以及实际只申请单个 origin。
建议：见第二部分 §3。

**D21 · P1 · entrypoints/onboarding/App.vue:3 / README.md:1 / docs/design.md:5 — 🎭 和「页面面具」**
原文：「欢迎使用 PageMask 🎭」；「PageMask 页面面具」；「中文别名"页面面具"」
问题：戏剧面具和"面具"都在强化"伪装"的意思，与清爽定位冲突；🎭 还会出现在首次引导的截图里。
建议：「欢迎使用 PageMask」（去掉 emoji）；中文名统一为「PageMask · 页面清爽模式」。

**D22 · P1 · onboarding/App.vue:11 — 界面里点名了第三方品牌**
原文：「比如微信读书、得到、极客时间。」
问题：在说明性语境里提品牌一般可以接受，但加上 D3 的截图，会叠加成"暗示和这些站点有关联"。README.md:12、GLOSSARY.md:3 也一样。
建议：「比如你常看的阅读、资讯或社区网站。」/ "e.g. a reading, news or community site you visit often."

**D23 · P1 · README 中英文内容不对等，违反 AGENTS.md:25「双语」要求**
问题：中文有「使用方法」四步（README:47-52）和「开发」一节，英文都没有。英文 Install 只有 4 步，缺少使用说明。
建议：英文补 "### How to use" 四步（与中文逐条对应，按钮名用中文原文加英文释义），以及 "### Development"。

**D24 · P1 · GLOSSARY 本身与公开定位冲突，且缺少"界面用词"的对照**
位置：GLOSSARY.md:1「# 伪装插件（Chrome Extension for Work Disguise）」；:3「让上班期间浏览的非工作网站…看起来不像它自己」；:57「### 范围与泄露面」。
问题：GLOSSARY 放在公开仓库根目录，标题直接写 "Work Disguise"。更关键的是，界面已经改用「清爽中 / 原样 / 标签页标题 / 标签页图标 / 编辑规则」，GLOSSARY 却没有收录这些词，导致"术语以 GLOSSARY 为准"与"界面用清爽话术"两条规则互相冲突，后来的 agent 无所适从。
建议：标题改为「# PageMask 术语表」，简介改用第二部分的定位文案；每个术语增加一行「界面用词」，例如：
- 伪装态 → 界面用词「清爽中」/ "Clean"
- 原样态 → 「原样」/ "Original"
- 伪装标题 → 「标签页标题」/ "Tab title"
- 伪装图标 → 「标签页图标」/ "Tab icon"
- 开关 → 「切回原样 / 开启清爽」
- 页面内编辑面板 → 「编辑规则」
同时规定：「伪装」只用于代码和内部文档，用户可见层禁用。小节标题「范围与泄露面」改为「范围与标签页」。

### C. 打磨项与文档一致性（P2）

**D25 · P2 · docs/design.md 多处与实际界面不一致（扩展 REVIEW A7）**
- :6「上班摸鱼伪装器——让非工作网站在一瞥之下"看起来不像它自己"」→ 改为定位文案。
- :52「插件弹窗点「为当前网站设置伪装」（新站点）或「添加元素」」vs popup/App.vue:24「为当前网站开启清爽模式」/「＋ 添加要去掉的元素」。
- :63「「设置/添加元素」+「管理全部」」vs 界面「管理全部站点」。
- :64「右键 → 编辑伪装等菜单」vs FloatingToggle.vue:5-6「编辑规则 / 按钮归位」。
- :67「首次引导…怎么给一个网站设伪装」vs onboarding 实际为「清爽」话术。
- :26-36「③ 在哪藏…可此时设置」vs DEVLOG「向导保存的范围选择是整批一个范围」：design.md 没有同步这条已经发生的偏离。
- :12「无注入、无界面、无性能开销」只对未配置站点成立；已配置站点有每秒一次的 URL 轮询（content-runtime.ts:322）。建议改为「未配置的网站：无注入、无界面、无性能开销」。

**D26 · P2 · HANDOFF.md 应该删除（证实 REVIEW A7）**
AGENTS.md:38「交接完成后删除」。另外 HANDOFF:7「epic #2 及 15 子票全关」与 REVIEW:98「#7、#8、#9 仍 OPEN」矛盾；HANDOFF:19「4 张截图…商店包…就绪」已被 D1–D3 推翻。

**D27 · P2 · docs/store-submission.md 内部错误**
- :169「竞品空位分析见 README「与同类工具的定位差别」一节」→ README 实际标题是「与同类工具：各自适合什么」，链接文字对不上。
- :16「`node tests/e2e/store-shots.mjs` 重新生成」vs HANDOFF:37「store-shots-extra.mjs」：两个脚本都存在，没说明分工。
- :94「类别：生产力（Productivity）」：商店 2024 年改版后类别分了两级（例如 Productivity › Tools、Make Chrome Yours › Functionality & UI）。**我没在控制台里确认**，提交时以控制台选项为准，建议选 "Make Chrome Yours › Functionality & UI" 或 "Productivity › Tools"。
- :102「当前截图已是清爽话术 UI」：不属实（D1、D2）。
- :147「无第三方素材」：不属实（D3）。
- :161「name ≤45 字符（当前满足）」：manifest name 实际是 "PageMask"，与 §3 计划的名称不一致（D5）。

**D28 · P2 · CHANGELOG.md 格式**
问题：没有 `Unreleased` 区；中英两节不是逐条对应（例如中文第 5 条有"中性图标"，英文第 5 条没有）；用了「补刀」这类俚语。
建议：采用 Keep a Changelog 结构（每个版本下 `### 中文` 与 `### English` 逐条对应），「补刀压制」改为「自动恢复」/ "re-applied automatically"。

**D29 · P2 · GLOSSARY 的 _Avoid_ 词使用情况（逐一 grep 结果）**
- 「老板键」：docs/adr/0001:7「全局总开关（老板键式）」。用于说明被否决的方案，GLOSSARY:11 本身也是在解释这个词，可以保留，但公开仓库里建议改为「全局一键切换」。
- 「配置文件」（_Avoid_ 指站点配置）：core/storage.ts:76「不是有效的 PageMask 配置文件」是用户可见的导入报错，这里说的是导出文件，与站点配置容易混淆。建议改为「不是有效的 PageMask 导出文件」/ "Not a valid PageMask export file"。
- 「卸载」：只出现在 content-runtime.ts:69 和 REVIEW:32，指 Vue 组件卸载，不是术语误用，不算违规。
- 「规则集」：core/css-builder.ts:42 注释里的「规则集合」，算轻微违规，改为「规则列表」。
- 「白名单 / 黑名单 / 悬浮球 / 悬浮窗 / 隐藏模式 / 假标题 / 假图标 / 规则校验 / 占位符 / 匹配规则 / 站点范围 / 设置页 / 弹窗编辑 / 检查器 / 选择器工具 / 拦截规则 / 规则组 / 备份 / 重置插件 / 开/关态 / 隐藏态」：没有发现使用。「全局开关」出现在 HANDOFF:12、REVIEW:117，都是在复述"永不做"清单，属于合规用法。
- 不在 _Avoid_ 里、但偏离术语的近义词：「悬浮胶囊按钮 / 小胶囊（按钮）/ capsule」（CHANGELOG:14、28，README:51，store-submission:61、89）对应 GLOSSARY 的「悬浮切换按钮」。建议 GLOSSARY 把「小胶囊按钮」收为界面用词，或者文档统一改成「页面右下角的悬浮切换按钮」。另外「透明遮盖」（store-submission:47）偏离「遮罩覆盖」，且与事实相反（D7）。

**D30 · P2 · 关于"零注入"与 manifest 里的占位内容脚本**
manifest 里有 `content_scripts: [{matches:["https://pagemask.invalid/*"]}]`。`.invalid` 是保留顶级域名，永远无法访问，所以"未配置的网站零注入"的说法**成立**。但审核员会看到这一条，建议在审核备注里主动说明（第二部分 §4 已写入）。

**D31 · P2 · 隐藏遮挡层可能被用来绕过付费墙或登录墙**
政策："Do not facilitate unauthorized access to content… circumventing paywalls or login restrictions"。PageMask 没有预置规则，也没有宣传这种用法，风险低。建议商店文案的举例只用「推荐流、横幅、评论区、侧栏」，不要出现「弹窗」「登录提示」。

**D32 · P2 · 关于 CHROMEWEBSTORE.md（REVIEW A8）**
这是 skill 的约定，不是商店要求。WXT 打包只包含 `.output` 目录，放在根目录不会进 zip。可以由 store-submission.md 演进而来，但要注意 AGENTS.md 对根目录文档的限制，需要在 AGENTS.md 的目录表里登记。

**D33 · P2 · homepage_url（REVIEW A9）**
商店控制台本身有 Homepage URL 字段，manifest 里不加 `homepage_url` 也可以。加上的话，在 chrome://extensions 里能看到。属于可选项。

### D. 对 REVIEW A1–A9 的结论
| 编号 | 结论 |
|---|---|
| A1 | 证实；级别从 P0 下调为 P1，不会导致审核被拒（D15） |
| A2 | 证实；级别下调为 P1；宣传图块与图标不一致已确认（D15） |
| A3 | 证实并扩大：截图 2 也有微信读书品牌，截图 3、4 另有违规文字（D1–D3） |
| A4 | 证实并扩大：界面字符串 core/origin.ts、management 的「泄露」、CHANGELOG 英文、GLOSSARY 标题（D1、D2、D6、D24） |
| A5 | 证实并升级为 P0：名称和简短说明都来自 manifest，§3 的填写方式无法执行（D5） |
| A6 | 证实，并且有模仿浏览器界面的政策风险，升级为 P0（D4） |
| A7 | 证实，并补充 design.md 的 6 处不一致（D25、D26） |
| A8 | 证实，级别 P2（D32） |
| A9 | 证实，并补充版本口径矛盾（D17、D33） |

---

## 二、推荐的最终商店文案（与当前代码功能一致；如果 D4 采用方案 1，标题示例相应调整）

### 1. manifest（通过 `_locales` 提供）
| 字段 | en（default_locale） | zh_CN |
|---|---|---|
| name（≤45） | `PageMask — Clean & Focused Pages`（32） | `PageMask · 页面清爽模式`（17） |
| description（≤132） | `Hide distracting page elements you pick, on sites you choose. Optional custom tab title and icon. Data stays in your browser.`（125） | `点选网页上让你分心的元素，一键收起；可为该网站自定义标签页标题和图标。只对你添加的网站生效，配置只存在本机。`（54） |

### 2. 详细描述

zh-CN：
```
PageMask 让你自己选的网站更清爽：用鼠标点选页面上让你分心的部分，一键收起。

【功能】
• 点选收起：鼠标悬停高亮、点击选中（可连选），用「选大一点 / 选小一点」调整范围，不需要懂任何代码
• 三种收起方式：彻底移除（下方内容上移）、原地留白（保留位置）、遮罩覆盖（盖一块纯色贴片，不改网站自身样式）
• 保存前预览：每个元素都能单独换收起方式，满意再保存
• 生效范围：整站，或只在 / 排除某一类页面
• 标签页标题与图标：可为该网站自定义标签页标题和图标
• 每个网站一个开关：页面角落的小按钮一点即可切回原样，同一网站的所有标签页一起切换
• 失效提醒：网站改版导致某条规则找不到目标时，会提醒你重新选择
• 导出 / 导入：全部配置导出为一个文件，换电脑后导入

【怎么用】
1. 打开想变清爽的网站，点工具栏的 PageMask 图标
2. 点「为当前网站开启清爽模式」，在 Chrome 的授权提示里点「允许」
3. 点选要收起的元素 →「预览」→「保存」
4. 想看原样，点页面右下角的小按钮；右键它可以编辑规则

【隐私与权限】
• 只对你添加的网站生效；没添加的网站，PageMask 不会运行任何内容
• 访问某个网站的权限只在你点「为当前网站开启清爽模式」时申请，而且只申请这一个网站
• 所有配置只保存在你的浏览器里；PageMask 自身不发起任何网络请求，没有统计，没有第三方代码
• 隐私政策：<PRIVACY URL>

【说明】
• 界面目前为简体中文
• 不支持浏览器内部页面、本地文件和 Chrome 应用商店页面；iframe 和 shadow DOM 里的元素暂时无法选择
• 反馈与支持：https://github.com/cherishfall/page-mask/issues
```

en-US：
```
PageMask declutters the sites you choose: point at the distracting parts of a page, click, and they're gone.

FEATURES
• Point-and-click hiding: hover to highlight, click to select (multi-select supported), use "bigger / smaller" to adjust the selection. No code needed
• Three ways to hide: Remove (content below moves up), Blank (keeps the space), Cover (a solid patch over the element; the site's own styles are left untouched)
• Preview before saving: change the hiding method per element, then save
• Scope: whole site, only a type of page, or everything except a type of page
• Tab title & icon: set a custom tab title and icon for the site
• One switch per site: a small on-page button flips back to the original page; all tabs of that site switch together
• Broken-rule notices: if a site redesign means a rule no longer finds its target, you're asked to re-pick it
• Export / import: move all your settings to another computer as one file

HOW TO USE
1. Open the site and click the PageMask toolbar icon
2. Click 「为当前网站开启清爽模式」 (Enable clean mode for this site) and choose Allow in Chrome's prompt
3. Click the elements to hide → 预览 (Preview) → 保存 (Save)
4. Click the small button in the bottom-right corner to see the original page; right-click it to edit rules

PRIVACY & PERMISSIONS
• Runs only on sites you add. On every other site, PageMask runs nothing
• Access to a site is requested only when you enable it, and only for that one site
• Settings are stored only in your browser. PageMask itself makes no network requests, has no analytics and no third-party code
• Privacy policy: <PRIVACY URL>

NOTES
• The interface is currently in Simplified Chinese
• Doesn't run on browser pages, local files or the Chrome Web Store; elements inside iframes/shadow DOM can't be picked yet
• Support: https://github.com/cherishfall/page-mask/issues
```
（D14 修好前保留"PageMask itself makes no network requests"的措辞。没有用 "best/any site/zero impact" 这类绝对化说法，品牌词没有重复堆砌。）

### 3. 权限理由（逐字段粘贴）
- **storage**: Saves the user's settings for each site they add (which page elements to hide, how, on which pages, the tab title/icon they chose, the on/off state) in chrome.storage.local on the device. Nothing is synced or sent anywhere.
- **scripting**: For sites the user has explicitly enabled only: (1) registers PageMask's bundled content script for that site's pages, (2) runs it once in the already-open tab right after the user enables the site, and (3) inserts/removes the user's hiding stylesheet (insertCSS/removeCSS) when the user switches the site between clean and original. No remote code is ever executed.
- **activeTab**: When the user opens the popup, it reads the active tab's URL to show which site it is, whether it's supported (browser pages, local files and the Web Store are not), and whether it is already configured. No other tab is accessed.
- **Host permissions (optional, declared as `*://*/*`)**: Declared broadly only because the user may enable any site they choose; nothing is granted at install. When the user clicks "Enable clean mode for this site", PageMask calls permissions.request for that single origin (e.g. https://example.com/*). The grant is used only to run the content script and apply the user's hiding styles and tab title/icon on that origin. Resetting a site in the management page removes that origin's permission.

### 4. 单一用途（Single purpose）
```
Declutters websites the user chooses: it hides page elements the user picks (with optional custom tab title and icon for that site), and does nothing on sites the user has not added.
```

### 5. PRIVACY.md 建议全文（en；建议附一份中文译文）
```
# PageMask Privacy Policy
Effective date: <YYYY-MM-DD> · Last updated: <YYYY-MM-DD>

PageMask is a browser extension that hides page elements you choose on websites you add. This policy explains what data it handles.

## Summary
PageMask does not send any data to the developer or to anyone else. There is no server, account, analytics, advertising or third-party code. Everything described below stays in your own browser.

## Data stored on your device
Only for sites you add, PageMask stores in your browser's local extension storage (chrome.storage.local):
- the site's address (scheme, host, port);
- your hide rules: CSS selectors that identify the elements you picked, a short label (up to 8 characters taken from the element's text or accessibility label, which you can edit), the hiding method, and the pages it applies to (a URL path prefix, if you chose one);
- the tab title and icon image you set for that site, and the site's on/off state;
- the position of the on-page button, and whether each rule still found its element the last time the page was opened (with a timestamp);
- one global default tab title.

To work, PageMask reads the page structure locally on sites you added (to let you pick elements and to check that rules still match). That page content is not stored except for the short label above, and is never transmitted.

## What we don't do
We do not collect, transmit, sell or share any data. Your data is not used for advertising, profiling, credit or lending. PageMask's use of data complies with the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Permissions
- storage: saves the settings above locally.
- activeTab: when you open the popup, reads the current tab's URL to identify the site.
- scripting and per-site host access: requested one site at a time, only when you enable that site, and used only to apply your settings there.

## Retention and your controls
Data stays until you remove it. "Reset" on a site in the management page deletes that site's settings and removes its access permission. Uninstalling PageMask deletes all of its stored data. "Export" creates a file you save yourself; PageMask cannot access or delete it afterwards. You can also remove a site's access in Chrome's extension details page.

## Children
PageMask is not directed at children and does not knowingly handle children's personal information.

## Changes
If this policy changes, the new version will be published at this URL with an updated date, and changes will be noted in the release notes (CHANGELOG).

## Contact
Email: <monitored email> · Issues: https://github.com/cherishfall/page-mask/issues
```
如果 D8 决定勾选数据类型：控制台勾 "Website content" 和 "Web history"，上面的政策文本无需修改。

### 6. 审核员备注（Notes / Test instructions）
```
What it does: lets the user hide page elements they pick on sites they explicitly add, with an optional custom tab title/icon for those sites. UI is in Simplified Chinese.

Permissions model: no host access at install. The popup button 「为当前网站开启清爽模式」("Enable clean mode for this site") calls permissions.request for that single origin; only then is the bundled content script registered (scripting.registerContentScripts) for that origin. The manifest's content_scripts entry matches only https://pagemask.invalid/* (a reserved, unresolvable TLD) and exists solely so the build emits the script file; it never runs.

Hiding is done with scripting.insertCSS (user origin) using selectors the user picked; the "cover" method adds a solid overlay element. Tab title/icon are changed only on enabled sites while the site's switch is on, and restored when switched off.

No network requests, no analytics, no remote code, no bundled site rules. All data stays in chrome.storage.local.

Test steps (no login needed):
1. Open https://en.wikipedia.org/wiki/Main_Page, click the PageMask icon, click the blue button, choose Allow.
2. Hover and click the left sidebar → 「预览」(Preview) → 「保存」(Save) → 「保存」.
3. The sidebar disappears and the tab title changes. Click the small grey button at the bottom-right to switch back to the original; right-click it → 「编辑规则」 to edit.
4. Toolbar icon → 「管理全部站点」(Manage all sites) → 「一键清空」(Reset) removes the site's settings and its permission.
```
（测试步骤**未在 Wikipedia 实测**，提交前请照走一遍；HANDOFF 也提到权限弹窗这条路径还没有人工端到端验证过。）

---

## 三、无法验证或需要用户决策的事项
1. 透明 favicon 在 Chrome 里显示为空白还是地球图标（D18），需要实测。
2. 隐私表单在"仅本地存储"情况下是否必须勾选数据类型：FAQ 措辞偏严，审核实际口径无法确认（D8）。
3. 当前商店类别的具体名称需在控制台确认（D27）。
4. 默认标题"新建标签页"是否会被判定为模仿浏览器界面：政策条文明确，但具体执行尺度无法预知（D4）。这一条需要用户在方案 1 和方案 2 之间选择。
5. evidence 图片是否需要改写 git 历史（D16），由用户决定。
6. 隐私政策 URL 是用代理访问验证的（200）；没有验证在审核员网络环境下能否访问（GitHub 在全球一般可达）。
