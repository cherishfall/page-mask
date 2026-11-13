# Chrome 应用商店上架手把手指南（PageMask）

> 这份文件是**操作说明**：一步一步教你怎么做，内容本身不另造——所有名称、简介、描述、权限理由、隐私表单、测试步骤都以 [`docs/CHROMEWEBSTORE.md`](CHROMEWEBSTORE.md) 为唯一依据，本文件只讲「在哪点、填什么、怎么确认成功」。
> 核实日期：**2026-11-13**。政策类结论后面都带官方链接；官方页面改版或控制台字段变动时，**以控制台当时显示为准**（本文件把这类地方标了「以控制台为准」）。
>
> **两套章节号别混**：本文自己的章节写成 `§2.5`（带小数点）；`docs/CHROMEWEBSTORE.md`（下文简称「材料」）的章节写成 **材料 §3**（不带小数点）。

---

## 0. 先看这一页

### 0.1 这次要提交什么

| 项 | 值 |
|---|---|
| 商品 | PageMask（Chrome 扩展，Manifest V3） |
| 版本 | **0.9.7** |
| 上传用的包 | `.output/page-mask-0.9.7-chrome.zip`（仓库内路径；已核实存在，32 个文件 / 245 KB） |
| 同一份包的公开副本 | GitHub Release `v0.9.7` 已发布（<https://github.com/cherishfall/page-mask/releases/tag/v0.9.7>），审核员/用户要自己装时可指它 |
| 包内权限 | `storage` / `scripting` / `activeTab` + 可选主机权限 `*://*/*`（可选 = 安装时不授予任何站点） |
| 包内内容脚本 | 无（`manifest.json` 里没有 `content_scripts`、没有 `host_permissions`；内容脚本按站点动态注册） |
| 声明的快捷键 | `Ctrl+Shift+X`（遮住）/ `Ctrl+Shift+Y`（整页变灰），Mac 为 `⌘+Shift+X` / `⌘+Shift+Y` |

产物核实方式（你可以自己复核）：

```bash
unzip -l .output/page-mask-0.9.7-chrome.zip | head
unzip -p .output/page-mask-0.9.7-chrome.zip manifest.json
```

### 0.2 当前状态：什么已经齐了，什么还差你

**材料侧（已由仓库准备好，照抄即可）**

- [x] 名称与简短说明（来自 `public/_locales/*/messages.json`，**控制台里改不了**，见 §2.1 与 §2.2 的字段总表）
- [x] 详细描述中英两份（`docs/CHROMEWEBSTORE.md` §2）
- [x] 权限逐项理由（材料 §3）
- [x] 单一用途一句话（材料 §4）
- [x] 隐私表单填法（材料 §5）
- [x] 审核员备注与八步测试步骤（材料 §6）
- [x] 版本历史表（材料 §7）
- [x] 截图 6 张（各 1280×800）+ 宣传图块 440×280 + 商店图标 128×128（材料 §8）
- [x] `cherishfall/page-mask` 仓库**已经是公开仓库**（已核实为 Public，匿名浏览器可打开仓库页与 `docs/PRIVACY.md`）
- [x] `docs/PRIVACY.md` 存在，且英文在前中文在后，与商店披露口径一致（`docs/CHROMEWEBSTORE.md` §5 引用它）
- [x] 隐私政策已由 GitHub Pages 承载并发布：<https://cherishfall.github.io/page-mask/privacy.html>（已点验 200，与 `docs/PRIVACY.md` 逐条等义）——两条路径都通，审核员无需登录
- [x] 扩展界面内有隐私政策入口：插件设置页「关于」卡的「隐私政策」一行（#193）

**还差你亲自做的（AI 做不了）**

| # | 事 | 为什么必须你做 | 见本文 |
|---|---|---|---|
| 1 | 注册开发者账号 + 付注册费 + 开两步验证 + 验证邮箱 | 涉及你的 Google 账号与付款 | §1.1–§1.4 |
| 2 | 确认 `cherishfall@hotmail.com` 能正常收信（要加白名单、防垃圾箱） | 拒审/下架通知只发这一个邮箱 | §1.7 |
| 3 | 照材料 §6 八步在**真实 Chrome** 上人工实走一遍；复核两条快捷键真能按 | 自动化触发不了 Chrome 的「允许」授权弹窗和 `chrome://extensions/shortcuts` | §4.2 |
| 4 | 点「Submit for review」，并决定要不要自动发布 | 这是「提交商店」与「公开发布」的分界点 | §2.7、§5.1 |

### 0.3 预计耗时

| 阶段 | 预计 | 依据 |
|---|---|---|
| 注册 + 付款 + 两步验证 + 邮箱验证 | 15–40 分钟 | 取决于你的 Google 账号验证流程，**以控制台显示为准** |
| 填 5 个标签页（照抄材料 §1–§6） | 30–60 分钟 | 材料都已备好，主要是复制粘贴 |
| 提交 → 审核结果 | **多数几天，最多几周** | 官方原话：“For most extensions, review is completed within a few days, but it can take up to a few weeks.”（<https://developer.chrome.com/docs/webstore/review-process/>） |
| 审核通过 → 上线 | 自动发布即刻；手动发布需在**审核通过后 30 天内**点 Publish | <https://developer.chrome.com/docs/webstore/publish/> |

**PageMask 大概率比平均慢**，原因是官方点名的三个“会被仔细看”的信号 PageMask 全中：

- new developers（新开发者账号）
- new extensions（新扩展）
- dangerous permission requests（宽泛主机权限——官方原文点名 `*://*/*`、`https://*/*`、`<all_urls>` 这类模式）

见 <https://developer.chrome.com/docs/webstore/review-process/>。这条也决定了攻略重点：**权限理由要写足、审核员备注要写全**，别让审核员自己猜。

官方还说：审核超过三周可联系开发者支持（"If your extension is pending review for more than three weeks, please contact developer support"）。

---

## 1. 一次性准备（这些必须你亲自做）

### 1.1 注册开发者账号

1. 打开 Chrome Web Store Developer Dashboard：<https://chrome.google.com/webstore/devconsole>
2. 用你的 Google 账号登录（控制台入口就是 Google 账号）。
3. 第一次进会看到注册页：**先同意开发者协议与政策，再付一次性注册费**（"you must register as a CWS developer and pay a one-time registration fee"）。
   - **费用金额：官方文档没有写死数字，注册页现场显示为准**（本文件不编数字）。注册页地址：<https://chrome.google.com/webstore/devconsole/register>
4. **国家/地区**：官方注册页列出支持的地区，**中国大陆（China）在列表内**，香港、澳门、台湾也在（已核对该页列表）。<https://developer.chrome.com/docs/webstore/register/>
5. **账号建成后邮箱不能改**："After an account is created, you cannot change its email address."。想换邮箱只能新建账号并提交转移表单。所以这一步的邮箱要选好——建议用 `cherishfall@hotmail.com`（与商店对外联系邮箱一致），不要用临时邮箱。
6. 官方建议：用**专门发商店发布用**的邮箱，并且要经常看（拒审、下架通知都发这里）。

> 注册时问“是否同时在 Google Play 上架”之类，PageMask 不涉及。

### 1.2 两步验证（强制）

政策原文："2-Step Verification is required for all developer accounts prior to publishing an extension or updating an existing extension."
→ <https://developer.chrome.com/docs/webstore/program-policies/two-step-verification/>

即：**没有两步验证，连提交审核这一步都过不去**。去 <https://myaccount.google.com/security/signinoptions/two-step-verification> 给自己开上（手机 App / 验证器都行）。

### 1.3 账号资料（Account 页）

登录后进控制台左侧 **Account** 页，逐项确认（字段与说明见 <https://developer.chrome.com/docs/webstore/set-up-account/>）：

| 控制台字段 | 填什么 | PageMask 的情况 |
|---|---|---|
| **Publisher name**（必填） | 你想对用户公开的开发者名，例如 `cherishfall` | 这会显示在商店页 "Offered by:" 后面 |
| **Verify your email**（必填） | 加 `cherishfall@hotmail.com`，点邮件里的验证链接 | 商店页的联系方式只显示这个 |
| **Physical address** | **留空** | 官方写明：只有“提供可购买的功能、附加功能或订阅”的商品才必须填物理地址（"Only items that offer functionality to purchase items, additional features, or subscriptions must include a physical address."）。PageMask 免费、无内购、不卖东西 → 不需要 |
| **Trusted tester accounts**（可选） | 填 1–2 个你自己的/同事的邮箱 | 上架前小范围验证用。注意这个字段**不支持 Google 群组邮箱**，只有普通个人邮箱；群组要用 Distribution 页里按单个商品的 Private + 群组 |
| 邮箱通知 | 打开「发布/暂存」等通知 | 拒审与下架通知本来就强制发，但你需要的是发布成功通知 |

### 1.4 付款

在注册页用 Google 支持的付款方式付掉那笔一次性注册费（金额以注册页为准）。**PageMask 不在商店里卖东西、不做内购**，不需要接支付。

### 1.5 「verified publisher」与官方网址（可选）

商店页可以显示一个经过验证的官方网址（在标题下方），前提是该网址通过 Google Search Console 验证归属你。
→ <https://developer.chrome.com/docs/webstore/cws-dashboard-listing/>

PageMask 已经有 GitHub Pages 域名 `cherishfall.github.io`，Pages 已开启并可用（见 §1.6），可以尝试认领。**这一项纯属加分，不做也能上架**，别卡在这。

### 1.6 隐私政策与支持页的托管（关键项，死链=自动拒审）

官方对隐私政策 URL 的要求写得很死，拒审理由原文包括：

- "The privacy policy URL is not working."
- "The privacy policy is not accessible."
- "The privacy policy URL is not leading to privacy policy."

→ <https://developer.chrome.com/docs/webstore/troubleshooting/>

**现状（我已核实）**：

| URL | 现状 | 能不能用 |
|---|---|---|
| `https://cherishfall.github.io/page-mask/privacy.html` | GitHub Pages 已开启并发布，页面返回 200，内容是完整隐私政策（与 `docs/PRIVACY.md` 逐条等义） | ✅ 能用。这就是 `docs/CHROMEWEBSTORE.md` §1 现在写的那个 |
| `https://github.com/cherishfall/page-mask/blob/master/docs/PRIVACY.md` | 仓库已公开，页面可访问，内容是完整隐私政策 | ✅ 也能用，作为仓库公开后的备用 |

托管现状：`cherishfall/cherishfall.github.io` 的 main 分支现在有 5 个文件——`page-mask/index.html`（PageMask 落地页）、`page-mask/privacy.html`（隐私政策）、根 `index.html`（项目索引页，以后加新项目只需加一行）、根 `privacy.html`（旧地址跳转页）、`.nojekyll`。**该仓库的 GitHub Pages 已开启**（Source = `main` / `/ (root)`）。四个地址都已点验 200：<https://cherishfall.github.io/>、<https://cherishfall.github.io/page-mask/>、<https://cherishfall.github.io/page-mask/privacy.html> 与 <https://cherishfall.github.io/privacy.html>。

**旧地址必须留着**：0.9.7 及更早的扩展里把 `https://cherishfall.github.io/privacy.html` 写死在「关于」卡上，商店审核员也可能点这个地址；删掉就是死链、会自动拒审。根 `privacy.html` 因此改成一个跳转页，自动把人送到 `/page-mask/privacy.html`。以后再改地址，同样要留一层跳转，不能直接删。

**为什么选 Pages 而不是仓库 blob 链接**：Pages 上的页面公开可访问、与仓库是否公开解耦，审核员无需登录、无需担心分支改名或仓库可见性；blob 页面外面包着 GitHub 的代码仓库界面，阅读体验一般。仓库 blob 链接作为备用保留在 `docs/CHROMEWEBSTORE.md` §1 的说明里。

**已经改好的地方（#193）**：

- `docs/CHROMEWEBSTORE.md` §1（隐私政策 URL）、§2（中英详细描述里的“隐私政策：”那两行）、§0（提交前清单）
- 扩展内入口：插件设置页「关于」卡新增「隐私政策」一行，链到同一个 URL（Chrome 官方要求显著披露在扩展界面内，商店描述不算）
- `README.md` 与 `docs/PRIVACY.md` 各加一行在线版本链接（与 Pages 上的页面互为镜像）

**提交前你只需做一件事**：用**无痕窗口**（没有登录状态的浏览器）把 <https://cherishfall.github.io/page-mask/privacy.html> 打开一次，确认在你自己机器上也打得开；再把 `https://github.com/cherishfall/page-mask/issues`（Support URL）也用无痕窗口点一遍。

**点验方法（务必做）**：开一个**没有登录状态**的浏览器窗口（无痕 / 另一台没登过 GitHub 的机器）打开链接。审核员没有你的登录态，你登录状态下能看不代表审核员能看。

### 1.7 确认联系邮箱可用

- `cherishfall@hotmail.com` 要能正常收信。
- 建议把 `chromewebstore-noreply@google.com` 加进联系人/白名单，官方明确建议："add chromewebstore-noreply@google.com to your contacts so that you receive all communications in a timely manner"（<https://developer.chrome.com/docs/webstore/check-review/>）。
- 拒审、下架通知只发这个邮箱；漏看邮件会一路拖到下架。

---

## 2. 提交步骤（逐步）

### 2.0 第 0 步：先在本地装一遍要传的那个包

官方要求："Test the exact files that you submit to the web store, not just a local development version of your extension."（<https://developer.chrome.com/docs/webstore/troubleshooting/>）

做法：把 `.output/page-mask-0.9.7-chrome.zip` 解压到 `tmp/` 下的空目录 → `chrome://extensions` → 开发者模式 → **Load unpacked（加载已解压的扩展程序）** → 选那个目录 → 照 §4.2 的八步走一遍。

> 安全提示：解压目录请放在仓库内的 `tmp/` 下，不要用系统临时目录。

### 2.1 第 1 步：创建商品并上传包

1. 控制台 → **Add new item**（添加新商品）→ **Choose file** → 选 `.output/page-mask-0.9.7-chrome.zip` → **Upload**。
2. 两条硬约束（官方）：
   - 包体积上限 **2GB**（"The maximum supported file size for an extension package is 2GB"）；
   - `manifest.json` 必须放在 **zip 根目录**，不能套一层文件夹（<https://developer.chrome.com/docs/webstore/prepare/>）。我们的包根目录就是 `manifest.json`，✅。

   （顺带：看到 "Cannot parse the manifest" 多半是 manifest 里有注释或 JSON 语法错——我们的包是构建产物，没有这个问题。）
3. 上传成功后，商品出现在控制台列表里，状态是 **Draft / 草稿**。此时 `Package` 标签页里的元数据**不能改**：官方原文——"After uploading your item, you won't be able to edit the metadata of your manifest in the developer dashboard"，要改就得改 manifest、**升版本号**、重新打包重传。

> 这一条直接关系到 PageMask：**名称与简介写死在 `_locales` 里**（`__MSG_extName__` / `__MSG_extDescription__`），控制台没有输入框。想改名字 = 改 `_locales` → 升版本号 → 重新 `npm run build && npm run zip` → 重传。

### 2.2 第 2 步：认识五个标签页

控制台里一个商品有五个标签页（官方 <https://developer.chrome.com/docs/webstore/publish/>）：

| 标签页 | 干什么 | 本项目要点 |
|---|---|---|
| **Package** | 包与 manifest，**上传后不可编辑** | 只读 |
| **Store listing** | 商店页长什么样：描述、类别、语言、图片、链接 | 填 §2.3 |
| **Privacy practices** | 单一用途、权限理由、远程代码、数据披露、隐私政策 URL | 填 §2.4、§3.1–§3.2 |
| **Distribution** | 可见性（公开/未列出/私有）、地区、内购 | 填 §2.5 |
| **Test instructions** | 给审核员的说明与凭据 | 填 §2.6 |

> 文档版本差异：旧文档把这个标签页叫 **Privacy tab**，新文档叫 **Privacy practices**；同一个东西。

#### 全部字段总表（一张表看全要填的东西）

| 字段（控制台英文） | 在哪个标签页 | 填什么 | 出处 | 详见 |
|---|---|---|---|---|
| **Name**（名称） | —— **控制台没有输入框** | 来自 `public/_locales/*/messages.json`（`__MSG_extName__`）：en `PageMask — Hide the Parts You Don't Want`（40 字）、zh_CN `PageMask · 收起网页上不想看的部分`（22 字） | 材料 §1 | §2.1 |
| **Short description**（简短说明） | —— **控制台没有输入框** | 同样来自 `_locales`（`__MSG_extDescription__`）：en 120 字 / zh_CN 52 字（上限 132） | 材料 §1 | §2.1 |
| **Detailed description**（详情说明） | Store listing | 材料 §2 的 zh-CN 全文；再切 English 贴 en-US 全文 | 材料 §2 | §2.3 |
| **Category**（类别） | Store listing | `Productivity › Tools`（控制台无此项时取最接近的） | 材料 §1 | §2.3 |
| **Language**（商店页语言） | Store listing | 简体中文 + English | 材料 §1 | §2.3 |
| **Store icon**（图标） | Store listing | 128×128 PNG：`public/icon/128.png` | 材料 §8 | §2.3 |
| **Screenshots**（截图） | Store listing | 最多 5 张、每张 1280×800：传 1 / 2 / 4 / 5 / 6 | 材料 §8 | §2.3 |
| **Small promo tile**（宣传图块） | Store listing | 440×280 PNG：`docs/store-assets/promo-tile-440x280.png`（Marquee 1400×560 可选，没素材） | 材料 §8 | §2.3 |
| **Homepage URL** | Store listing | `https://github.com/cherishfall/page-mask` | 材料 §1 | §2.3 |
| **Support URL** | Store listing | `https://github.com/cherishfall/page-mask/issues` | 材料 §1 | §2.3 |
| **Content rating**（内容分级） | Store listing | 不勾 Mature | 材料 §11 | §2.3 |
| **Single purpose description**（单一用途） | Privacy practices | 材料 §4 那一段 | 材料 §4 | §2.4、材料 §3 |
| **Permissions justification**（权限理由） | Privacy practices | 材料 §3 的四段（`storage` / `scripting` / `activeTab` / 主机权限） | 材料 §3 | §2.4、§3.1 |
| **Remote Code**（远程代码） | Privacy practices | No | 材料 §3 | §2.4 |
| **Data usage**（数据使用） | Privacy practices | 材料 §5：Website content + Web history，再加三条证明 + Limited Use | 材料 §5 | §2.4、§3.2 |
| **Privacy Policy**（隐私政策 URL） | Privacy practices（页面底部） | `https://cherishfall.github.io/page-mask/privacy.html` | 材料 §1 | §1.6、§2.4 |
| **Visibility**（可见性） | Distribution | Public（建议）／Unlisted／Private | — | §2.5 |
| **Geographic distribution**（地区） | Distribution | All regions | — | §2.5 |
| **In-app purchases** | Distribution | 不勾 | — | §2.5 |
| **Test instructions**（审核员说明） | Test instructions | 材料 §6 的整段英文 | 材料 §6 | §2.6 |

### 2.3 第 3 步：Store listing（商店详情）

#### 字段表

| 控制台字段（英文） | 填什么 | 出处 | 怎么确认成功 |
|---|---|---|---|
| **Detailed description** | `docs/CHROMEWEBSTORE.md` §2 的 zh-CN 全文（代码块里整段复制） | 材料 §2 | 存草稿后回到页面，字数没被截断 |
| 语言下拉 | 先选 **中文（简体）**，贴中文描述；再切 **English**，贴 en-US 全文 | 材料 §2 | 每种语言各存一次（不同语言是分开填的） |
| **Category**（类别） | `Productivity › Tools`；控制台没有这一项时选最接近的 | 材料 §1 | 官方只要求“一个主要类别”，没有固定清单；**以控制台当次选项为准** |
| **Language**（商店页语言） | 简体中文 + English | 材料 §1 | 与 manifest 的 `_locales` 一致 |
| **Store icon** | 128×128 PNG：`public/icon/128.png`（与 `docs/store-assets/icon-128.png` 同一张） | 材料 §8 | 官方要求 **128×128 px** |
| **Screenshots** | 最多 **5 张**，每张 **1280×800 px**。我们有 6 张，按材料 §8 的建议上传 **1 / 2 / 4 / 5 / 6**（首图、向导、面板、两个管理页、菜单+幕布） | 材料 §8 | 官方原文："At least one 1280x800 px screenshot, up to 5 total." |
| **Small promo tile**（可选） | `docs/store-assets/promo-tile-440x280.png`，**440×280**，PNG/JPEG | 材料 §8 | 官方尺寸 440×280 px |
| **Marquee promo tile**（可选） | 没有素材，跳过 | — | 官方尺寸 1400×560 px |
| **Promo video**（可选） | 没有视频，跳过 | — | YouTube 链接 |
| **Homepage URL** | `https://github.com/cherishfall/page-mask` | 材料 §1 | 仓库已公开，能打开 |
| **Support URL** | `https://github.com/cherishfall/page-mask/issues` | 材料 §1 | 无痕窗口能打开 |
| **Content rating**（内容分级） | **不勾 Mature** | 材料 §11 | 官方：含成人内容才标 Mature；标了 Mature 的扩展**未登录用户在搜索结果里看不到** |
| **Official URL**（已验证发布者） | 可选，Pages 已开（见 §1.6），认领后填 `https://cherishfall.github.io/` | — | 没做就留空，不影响上架 |

#### 操作要点

1. **名称与简短说明在这一页找不到输入框**——这是正常的：它们写死在 `public/_locales/*/messages.json` 里（manifest 里是 `__MSG_extName__` / `__MSG_extDescription__`），控制台改不了（§2.1）。看到商店页顶部显示的名称与简介来自 `_locales`，就说明对了。
2. **截图只能传 5 张**：材料 §8 明确给了优先级——「商店控制台最多传 5 张截图时，优先传 1 / 2 / 4 / 5 / 6」。
3. **多语言一致性**：官方会用程序检查不同语言的元数据是否一致，不一致会弹一个 warning（不拦截提交，但别去踩）。
4. **别让截图/描述说没做的事**：官方 "Misleading or Unexpected Behavior" 政策写明：任何内容、标题、图标、描述或截图里有不实信息，都可能被下架。我们的截图是虚构站点 `acme-journal.test` 上的真实渲染，不误导（材料 §8 有口径说明），**描述里不能写「任何网站都可用」这种话**（材料 §11 已列）。

### 2.4 第 4 步：Privacy practices（隐私实践）——最容易填错的一页

这一页四个字段，逐个填（官方说明 <https://developer.chrome.com/docs/webstore/cws-dashboard-privacy/>）：

| 字段（英文） | 填什么 | 出处 |
|---|---|---|
| **Single purpose description**（单一用途说明） | `docs/CHROMEWEBSTORE.md` §4 那一整段英文（英文控制台就填英文） | 材料 §4 |
| **Permissions justification**（权限理由） | 按控制台列出的条目逐个填：`storage` / `scripting` / `activeTab` 三项必有，对应 材料 §3 前三段；**主机权限 `*://*/*` 若控制台单列一项也填 材料 §3 第 4 段**，若没有单列字段，就把主机权限的理由并进最相关的一条，并在单一用途说明里补一句「按站点授权」 | 材料 §3 |
| **Remote Code**（远程代码） | 选 **"No, I am not using remote code."** | 材料 §3 / 材料 §11 |
| **Data usage**（数据使用） | 两组勾选，见 §3.2 | 材料 §5 |
| **Privacy Policy**（页面底部） | 隐私政策 URL（按 §1.6 定下来的那个） | 材料 §1 |

> 官方提醒一句，抄在这里免得忘："If there are permissions listed here that you don't require, remove them from your manifest and upload a new version of your extension before continuing."（列出来的权限必须都用得上）
> 官方还提醒：**Remote Code 选“是”会招来额外审查、拖长审核**；选了“是”却不声明远程代码的会被拒。

### 2.5 第 5 步：Distribution（分发）

| 字段 | 怎么选 | 依据 |
|---|---|---|
| **Visibility** | 见下方「公开 vs 未列出」小节 | 官方 |
| **Geographic distribution** | **All regions**（全部地区）。官方默认就是全部；要只给部分地区就取消 All regions 再勾 | 官方 |
| **In-app purchases / Payments** | 不勾（PageMask 不卖东西） | — |
| **Trusted testers** | 想小范围先试，就在这里再加群组；只加个人邮箱的话在 Account 页 | 官方 |

#### 公开 vs 未列出（Public vs Unlisted）怎么选

官方定义（<https://developer.chrome.com/docs/webstore/cws-dashboard-distribution/>）：

- **Public** —在商店里列出，所有人可见可装。
- **Unlisted** —商店里**没有**这个条目页，但**知道 URL 的人都能装**。
- **Private** —只有指定用户能装（测试用）。

官方另有一句关键话："All visibility settings have the same policy requirements and will go through the same review process."——**三种可见性走同一套审核、同样的政策要求**，选了 Unlisted 不会少审。

**我的建议：第一次上架选 Public。** 理由：PageMask 不采集数据、不做内购，没有需要藏的理由；仓库本身就是商店主页（公开可见），公开 listing 换来的好处是能被搜索、被推荐。而「什么时候上线」这个问题，用提交对话框里的**延迟发布**开关控制更合适（见 §2.7）。

### 2.6 第 6 步：Test instructions（给审核员的说明）

官方定位：这个标签页是给你**需要受限凭据或付费账号**的扩展放凭据和说明用的，"This is only useful if the item requires restricted credentials or a paid account for full access to all features."（<https://developer.chrome.com/docs/webstore/cws-dashboard-test-instructions/>）

PageMask 不需要登录、不需要付费账号，所以**硬性凭据这一项没有**。但 `docs/CHROMEWEBSTORE.md` §6 的那八步仍然是**最有价值的审核员说明**：审核员是按说明来验证功能的，说明写清楚能显著减少「功能不可用」类误判（这类拒审的官方 ID 是 Yellow Magnesium）。

**做法**：把 材料 §6 的整段英文（含 “What it does / Permissions model / … / Test steps (no login needed): 1–8”）贴进 Test instructions。材料 §6 已经把要点说全了，特别是：

- 安装时不注册任何内容脚本、不授予任何站点；
- 授权发生在用户点击「收起内容」/「标题和图标」时，按站点申请；
- 快捷键可在 `chrome://extensions/shortcuts` 改，扩展读 `commands.getAll()` 显示当前键位。

**怎么确认成功**：保存后回到 Test instructions 页，文本完整显示、没有截断。

### 2.7 第 7 步：提交审核（这一步 ≠ 公开发布）

1. 五个标签页填完 → 点 **Submit for review**（提交审核）。
2. 弹出确认对话框，里面有一个**发布方式勾选框**：

   - **勾上**（默认）＝ 审核一通过就**自动公开发布**；
   - **不勾**＝ 审核通过后不会立刻上架，你会得到一个“可发布”状态，**由你自己挑时间点 Publish**。

   官方原文（<https://developer.chrome.com/docs/webstore/publish/>）："If you uncheck the checkbox, your item will not be published immediately after its review is complete. Instead, you'll be able to manually publish it at a time of your choosing once the review is complete."

3. **重要：审核通过后你有 30 天时间发布。** 官方："Once the review is complete, you will have up to 30 days to publish. After that period expires, the staged submission will revert to a draft which will have to be submitted again for review."（过期后退回草稿，要重新提交审核）

> **这是最容易搞混的一步**：「提交审核」和「公开发布」是两件事：
> - 提交审核 = 交给审核员看（**你可以自己做**）；
> - 公开发布 = 让所有人能在商店里搜到并安装（**这一步要你点**）。
>
> 建议：**第一次提交时取消勾选**（延迟发布）。这样审核期间你可以把商店页再核一遍（描述、截图、链接），确认无误再点 Publish，不会出现「刚过审就自动上架、发现写错了还要改描述再等一轮审核」的情况。

4. 如果提交后发现包里有 bug 或描述写错：**⋮ View more menu options → Cancel review**（取消审核），包会退回草稿状态，换新包再提交。
   - 只在状态为 **Pending review** 时这个菜单项才出现；每个发布者每天最多取消 6 次。
   - <https://developer.chrome.com/docs/webstore/cancel-review/>

### 2.8 第 8 步：等结果、看状态

- 商品页标题下方显示状态：**Published / Pending / Rejected / Taken Down**（已发布 / 审核中 / 被拒 / 已下架）。
- 被拒的细节在商品页的 **Status** 标签页里。
- 邮件也会告诉你（拒审与下架通知是强制的）。
- <https://developer.chrome.com/docs/webstore/check-review/>

---

## 3. 权限与数据披露

### 3.1 逐项权限：声明什么、审核员可能问什么

来源：`docs/CHROMEWEBSTORE.md` §3（理由原文）与 材料 §10（预置问答）。**声明文字直接复制 材料 §3，别自己重写。**

| 权限 / 声明 | 控制台要填什么（出处） | 审核员可能追问 | 怎么答（依据） |
|---|---|---|---|
| `storage` | 材料 §3 第 1 段：把每个站点的设置存在本机 `chrome.storage.local`，不同步、不外发 | “为什么需要本地存储权限？” | 因为要记住用户选的收起规则、标签页标题图标、开关状态；官方最小权限政策要求说明用到哪个 API（`chrome.storage` → 需要 `storage`） |
| `scripting` | 材料 §3 第 2 段：只为用户显式开启的站点注册随包内容脚本、对已打开标签页跑一次、插入/移除用户自己的隐藏样式表 | “`scripting` 是不是用来偷页面内容？” | 注入的是用户自己点选出来的选择器（`insertCSS`/`removeCSS`），灰度也是同一份样式表里的一条 grayscale 规则；不注入远程代码（官方 “Blue Argon” 拒审项的正解，见 §5.2） |
| `activeTab` | 材料 §3 第 3 段：打开弹窗时读当前标签页网址，用来显示是哪个网站、支不支持、是否已配置 | “官方说 `activeTab` 在有宽泛主机权限时通常不需要，你为什么要？” | 官方原文（<https://developer.chrome.com/docs/webstore/troubleshooting/>）：`activeTab` “When is it NOT required? When the extension has access to broad host permissions…”。PageMask 的主机权限是**可选且安装时不授予任何站点**，所以读当前标签页网址必须靠 `activeTab`。**这条要主动写进权限理由里**，别等审核员问 |
| 可选主机权限 `*://*/*` | 材料 §3 第 4 段：声明得宽是因为用户可能对任意站点生效，但**安装时一个站点都不授予**；点「收起内容」/「标题和图标」时才按站点申请（普通域名是裸域+子域两条模式，IP/localhost/带端口按精确模式） | “`*://*/*` 范围太大了吧？” | 材料 §10 第一问就是这条的标准答案：安装零授权、按站点申请、用到即授、删除站点设置即回收权限。补充一句官方认可的软化理由：官方明确说 “You may also want to consider structuring your code in a way that is easy for others to understand.”，而**把内容脚本动态注册、manifest 里不留 `content_scripts`/`host_permissions`**，正是让审核员一眼看清「装上什么都不跑」的写法（材料 §11 记的是：安装时权限警告数组为空） |
| **Remote Code** | 选 **No** | “你注入的样式算远程代码吗？” | 不算：样式表内容由用户在页面上点选出来，在本机生成，用 `insertCSS` 注入；包内无 `eval`、无 `new Function`、无外部脚本引用（官方 Blue Argon 的三条常见拒审原因我们都不占） |

> 官方关于 `activeTab` 的一段还提到：使用 `action`/`browserAction`/`pageAction` API 时这些 API 会顺带授予 activeTab 临时主机权限，但它们本身不需要 activeTab 就能工作。PageMask 的弹窗读网址是**用户主动点图标**触发的，符合 activeTab 的适用场景（"temporary access to a tab in response to a user invoking your extension"）。

### 3.2 数据披露（Privacy practices → Data usage）

按 `docs/CHROMEWEBSTORE.md` §5，**两组分开填，别混**：

**第一组：数据类型（勾选你处理的用户数据）**

| 勾选 | 理由（写进理由栏/描述） |
|---|---|
| **Website content** | 为了让你点选元素、以及核对规则是否仍然命中，扩展会读取你已添加网站的页面结构；短标签（最多 8 字符）会存在本机 |
| **Web history** | 站点配置里保存了网站地址与生效页面的路径前缀 |

**第二组：三条证明（与是否收集无关，全部勾选）**

- 不出售或转让给第三方（批准的用途除外）
- 不用于与单一用途无关的目的
- 不用于判断信用或放贷
- 并勾选「遵守 Chrome 应用商店用户数据政策（含 Limited Use 要求）」

`docs/PRIVACY.md` 的 "What we don't do" 一节已有对应声明（材料 §5 已核对）。

#### 三条容易漏的官方要求

1. **只在本机处理也要披露。** 官方 FAQ 原文："Extensions are required to disclose how they handle user data, even when data is processed or stored locally on a user's device and is not transmitted to external servers or third parties."
   → <https://developer.chrome.com/docs/webstore/program-policies/user-data-faq/>
   （所以 PageMask 不联网也照样要勾 Website content / Web history，这跟 材料 §5 的填法一致。）

2. **Limited Use 对「浏览活动」的额外要求。** 官方政策："Collection and use of web browsing activity is prohibited, except to the extent required for a user-facing feature described prominently in the Product's Chrome Web Store page and in the Product's user interface."
   → <https://developer.chrome.com/docs/webstore/program-policies/limited-use/>
   PageMask 存网址路径前缀是为了“在哪些页面收起”这个**面向用户的功能**，所以合规，但**这个功能必须在商店页描述里显著写出来**——材料 §2 的详细描述里已有「在哪些页面收起：整个网站，或只在这类页面 / 除了这类页面」这一条，符合要求。

3. **Limited Use 要求你自己的网站上有一句肯定声明。** 官方原文要求在属于该扩展的网站上声明遵守用户数据政策（含 Limited Use）。`docs/PRIVACY.md` 的 "What we don't do" 里已有这句（"PageMask's use of data complies with the Chrome Web Store User Data Policy, including the Limited Use requirements."）——**隐私政策页面要能打开，这一串才算数**，这又回到 §1.6 的点验。

### 3.3 扩展界面内的隐私政策入口（已加，#193）

官方 FAQ 还有一条：**显著披露与用户同意必须发生在扩展自己的界面里**，商店描述与安装页不算：

> "The prominent disclosure and consent must occur within the Product's user interface. Disclosures in the Chrome Web Store description or inline installation page do not satisfy this requirement."
> → <https://developer.chrome.com/docs/webstore/program-policies/user-data-faq/>

现状：**已加**。插件设置页（Chrome 的「扩展程序选项」）的「关于」卡里新增一行「隐私政策」/ "Privacy policy"，外链到 <https://cherishfall.github.io/page-mask/privacy.html>，与商店 listing 填的是同一个 URL；中英文案都在 `core/i18n/messages.{zh,en}.ts` 的 `settings.privacyPolicy`。另外官方最小权限 FAQ 建议把权限清单与理由也放进「商店 listing 或扩展内的 about 页面」——权限逐项理由见材料 §3，扩展内这一条由「关于」卡与设置页各功能卡承担。

---

## 4. 提交前最后一查（可执行清单）

### 4.1 材料与链接

- [ ] 包在：`.output/page-mask-0.9.7-chrome.zip`；版本号 `0.9.7`（`unzip -p .output/page-mask-0.9.7-chrome.zip manifest.json | grep version`）
- [ ] `manifest.json` 在 zip 根目录；无 `.map`、无 README/CHANGELOG/CHROMEWEBSTORE.md、无测试与配置文件（`npm run check:package` 会验）
- [ ] manifest 里 `permissions` = `storage`/`scripting`/`activeTab`，`optional_host_permissions` = `["*://*/*"]`，**没有** `content_scripts`、**没有** `host_permissions`
- [ ] 名称/简介与 `_locales` 一致：en 40/120 字符、zh_CN 22/52 字符（≤45 / ≤132）
- [ ] 截图 5 张（1/2/4/5/6），每张 1280×800；宣传图块 440×280；图标 128×128
- [ ] **隐私政策 URL（<https://cherishfall.github.io/page-mask/privacy.html>）用无登录浏览器能打开**，且页面里确实有「收集什么、怎么用、怎么共享」的说明
- [ ] Support URL（`.../issues`）与 Homepage URL 无痕能打开
- [ ] 材料 §3 四段权限理由、材料 §4 单一用途、材料 §5 两组勾选、材料 §6 八步测试说明，都已贴进对应标签页
- [ ] Remote Code 选了 No
- [ ] 描述里没有「任何网站都可用」「完全不出网」这类不实说法（材料 §11 的口径已核过）

### 4.2 必须在真实 Chrome 上人工实走的八步（材料 §6）

把 0.9.7 装进真实 Chrome 后，按 `docs/CHROMEWEBSTORE.md` §6 的 1–8 步逐条走：

1. 打开 <https://en.wikipedia.org/wiki/Main_Page> → 点 PageMask 图标 → 点「收起内容」→ **在 Chrome 的授权提示里点「允许」**
2. 页面上点选元素 → 「下一步：看效果」
3. 清单里改收起方式 / 「调整」里改在哪些页面收起 → 「保存」→ 元素真的被收起
4. 「标题和图标」→ 填标题 → 「保存」→ 标签页标题变了
5. 点悬浮按钮切回「原样」→ 内容回来、标题还原
6. 悬浮按钮「⋯」菜单四项（拖过之后第五项「按钮放回右下角」出现）；胶囊上的「媒体」钮
7. 弹窗：四块卡 + 两颗编辑入口 + 「遮住这一页」+ 底部两个入口
8. 整页变灰（无新权限）+ 幕布静音（遮住即哑、恢复有声、标签页斜线小喇叭）

**这四项自动化触发不了，必须人工**（材料 §6 末尾已注明）：

- [ ] Chrome 授权弹窗点「允许」的完整路径
- [ ] `chrome://extensions/shortcuts` 里两条命令都真的有键；在那一页改一次键，切回插件设置页与欢迎页，键帽跟着变
- [ ] 标签页小喇叭（静音）图标真的出现
- [ ] 自动播放视频的真实观感（被按住 / 点击放行）

### 4.3 隐私政策与实际数据流一致

- [ ] 政策里写的三类本机数据（收起规则与选择器、标签页标题与图标、站点开关状态）与 `docs/PRIVACY.md` 一致
- [ ] 政策里「不上传、不同步、不统计」与实现一致（只用 `chrome.storage.local`，不用 `storage.sync`，无网络请求）
- [ ] 幕布静音写的是「浏览器记在标签页上的状态，不由扩展保存」——不是我们采集的数据，**不新增数据勾选**

### 4.4 版本一致性

- [ ] `package.json` = `0.9.7`，`CHANGELOG.md` 有 0.9.7 的中英条目，tag `v0.9.7` 已打、Release 已发
- [ ] `docs/CHROMEWEBSTORE.md` 头部与 材料 §7 版本历史表已同步到 0.9.7

---

## 5. 提交之后

### 5.1 审核时长与状态

| 状态 | 含义 | 你该做什么 |
|---|---|---|
| **Pending**（审核中） | 排队等审核 | 等。官方口径：多数几天，最多几周；**超过三周**可联系开发者支持 |
| **Published**（已发布） | 通过并已上架 | 检查商店页展示是否正常 |
| **Staged / 可发布**（延迟发布时） | 通过了但没自动上架 | **30 天内**点 Publish，否则退回草稿要重新提交 |
| **Rejected**（被拒） | 有政策违规 | 见 §5.2 |
| **Taken Down**（已下架） | 已上架后被判违规 | 见 §5.2 |

- 看状态：控制台商品列表 + 商品页 **Status** 标签页（拒审细节在这里）。
- 邮件也会到（拒审/下架通知强制发）。
- 来源：<https://developer.chrome.com/docs/webstore/check-review/>、<https://developer.chrome.com/docs/webstore/review-process/>

### 5.2 被拒了怎么办

**官方流程（三条路）**：

1. **自动化邮件**：拒审邮件会写明违反了哪条政策、怎么改、以及怎么申诉。
2. **申诉（Appeal）**：在控制台**商品详情页**点 **Appeal** 按钮，按表填补充说明。
   - 适用：下架（takedown）、警告（warning）、以及“审核员认为你没用某个权限但你确实用了”的情况。
   - 官方原话："If the reviewer indicated that your extension did not use a given permission but you believe it does, use the Appeal button on the item detail page to appeal the decision and to provide a detailed explanation of why the permission is necessary and how it is used."
3. **One Stop Support 表单**：其他问题（账号、统计、转移等）走这个；**提交后所有沟通都转到邮件**，一般 3 天内回复。

**重要限制**：同一条违规**只能申诉一次**（"Developers are permitted to appeal a violation decision once."），而且必须是善意申诉；滥用申诉流程可能导致以后连申诉机会都没有。
→ <https://developer.chrome.com/docs/webstore/program-policies/notification-and-appeals/>

**被拒后的处理顺序（照这个顺序走，别跳）**：

1. **先读拒审理由原文**（邮件 + Status 标签页），找出官方给的**违规 ID**（两词组成，颜色 + 元素，例如 `Purple Potassium`）。
2. **按 ID 对照官方 troubleshooting 页**（<https://developer.chrome.com/docs/webstore/troubleshooting/>）看官方给的原因清单和整改方法。
3. **分类**：是「材料问题」（描述、截图、链接、隐私政策 URL）还是「功能/权限问题」（用不了、权限过多、远程代码）还是「单一用途问题」。
4. **改**：材料问题 → 改控制台字段，**不用重新打包**；功能/权限问题 → 改代码 → 升版本号 → `npm run build && npm run zip && npm run check:package` → 重新上传 → 重新提交审核。
5. **重新提交 vs 申诉**：
   - 你能改到审核员满意 → **改完重新提交**（最稳）。
   - 审核员对**权限的使用**判断有误、或你的实现是对的只是没解释清 → **申诉**，并在申诉里写清「为什么这个权限必要、怎么用的」（材料 §10 就是为此准备的）。
6. 提交前如果发现包本身有 bug → 先 **Cancel review**（状态为 Pending 时）再换包，别等审核结果。

### 5.3 常见拒审原因 ↔ PageMask 预防动作对照表

| 官方拒审类别（notification ID） | 官方给的理由（摘） | PageMask 可能踩到的点 | 预防动作（已在仓库里） |
|---|---|---|---|
| **Blue Argon** — Manifest V3 远程代码 | 引用包外 `<script>`；`eval()` 执行远程字符串；把远程命令当数据跑 | 注入的用户样式表内容是不是“远程来的”？ | 样式内容全在本机由用户点选生成；包内无 `eval`/`new Function`/外部脚本。材料 §6 明写 "no remote code"；Privacy 页 Remote Code 选 No |
| **Yellow Magnesium** — 功能不可用 | 包装错误（manifest 提到的文件不在包里）；行为与列表描述不符 | 审核员按说明走却走不通（授权弹窗、子域页面的「需要允许访问」） | 材料 §6 八步实走；材料 §6 步骤 1 已写子域页面的处理；材料 §11 记录 “安装时零权限警告” |
| **Purple Potassium** — 权限过度 | 请求了没用到的权限；权限范围超出功能所需 | `activeTab` 会不会被认为多余（官方明确列出 `activeTab` 是常见误解项） | 材料 §3 四段理由逐项写清用途；材料 §10 预置问答；材料 §6 讲清“装上不跑、点才跑” |
| **Purple Lithium** — 用户数据披露 | 收集了数据却没给隐私政策；政策放在描述里而不是指定字段；**URL 打不开 / 不可访问 / 不是隐私政策**；政策没写清收集、使用、处理、共享 | 隐私政策 URL 死链（**已改指 GitHub Pages 并点验 200**，仍需提交前用无痕窗口再点一次）；政策页缺“共享给谁” | §1.6 点验；政策 URL 填在 Privacy 页底部指定字段；`docs/PRIVACY.md` 的 “What we don't do” 已写共享与 Limited Use |
| **Red Magnesium / Red Copper / Red Lithium / Red Argon** — 单一用途 | 一个扩展干两件不相关的事；工具栏塞一排不相干入口 | 「整页变灰」「幕布遮住」看起来像第二个用途 | 材料 §4 的单一用途句把整页变灰说成“按站点把页面变灰”的同一件事的一部分；幕布说成“遮住整页并按住声音”。官方对“单一用途”的解释是**窄的领域**也算（<https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines-faq/>），PageMask 属“让用户自己选的网站变清爽”这一窄领域 |
| **Yellow Zinc** — 元数据缺失/不足 | 缺图标、标题、截图或描述；标题无意义或误导；截图没讲清功能 | 截图传 6 张超限（控制台上限 5 张，多传的会在上传时就被挡住，不会走到审核） | 传 5 张（1/2/4/5/6）；描述照 材料 §2 整段贴 |
| 命名规范 / 关键字堆砌 | 描述里堆品牌词 | 描述里只有必要的品牌词 | 材料 §11 已核 |
| 行为与元数据不一致 | 截图/描述里说了扩展没做的事 | “整页变灰”写成省流量/挡广告（实际不拦请求） | 材料 §2 与 材料 §9 都明确写了“不省流量、不代替广告过滤工具” |

---

## 6. 发布之后

### 6.1 发新版本的完整流程

1. 改代码 → 提票 → 合并（仓库规矩：一票一提交一推送）。
2. **升版本号**：`package.json` 的 `version` 必须**大于**已发布的版本（官方硬性要求："Each new version must have a larger version number than the previous version"）。
3. `CHANGELOG.md` 加中英双语条目（Keep a Changelog 结构）。
4. `docs/CHROMEWEBSTORE.md` 同步：头部「对应构建」、材料 §0 清单、材料 §7 版本历史表、材料 §11 复核结论。
5. `npm run build && npm run zip && npm run check:package` → 得到 `.output/page-mask-<版本>-chrome.zip`。
6. 打 tag（`v<版本>`，annotated）+ 发 GitHub Release，附上 zip。**要不要同步 GitHub Release？——要。** 它是本项目对外的版本分发渠道（商店条目在审核通过前给不了用户可装的东西），也是审核员备注里可以引用的公开坐标。
7. 控制台：商品页 → **Package** 标签页 → **Upload New Package** → 选新 zip。
   - **再点一次 Submit for Review**（上传新包不会自动送审）。
   - 审核通过前，已装的用户不受影响（"When you submit an update for review, it doesn't yet affect your published item"）。
   - 新包会发布到**和上一版相同的可见性**（Public 还是 Unlisted），要换可见性得在 Distribution 页改。
   - **新增权限**会弹给用户“接受新权限或停用扩展”的提示——PageMask 权限集合不变就不会有。
8. 发布后可以开 **Percentage rollout**（灰度放量），但**只有 7 日活跃用户超过 10,000 的 item 才有这个选项**——新扩展用不上。
   - <https://developer.chrome.com/docs/webstore/update/>

### 6.2 出事了怎么办

| 场景 | 操作 | 依据 |
|---|---|---|
| 刚发的新版本有 bug | **Roll back to previous version**（回滚到上一版本）：在商品页 ⋮ 菜单，或 Build → package 页的 “Roll back to previous version”。回滚需要**给一个新的版本号**把上一版重新发布（例如当前 1.1、上一版 1.0，用 1.2 回滚到 1.0）。**不需要重新审核，一分钟内生效**；但**待审的提交会被丢弃**（回滚后要重新提交） | <https://developer.chrome.com/docs/webstore/rollback/> |
| 想彻底下架 | 商品页 ⋮ → **Unpublish**（下架）：列表页不再可见。**重新上架必须提交新版本并重新过审** | <https://developer.chrome.com/docs/webstore/account-deletion/> |
| 提交后发现包有错 | ⋮ → **Cancel review**（仅 Pending 时可见，每天最多 6 次），退回草稿 | <https://developer.chrome.com/docs/webstore/cancel-review/> |

> 注意 CWS **没有**“免审核更新”的路子给 PageMask：免审核更新（skip review）只对使用 **Declarative Net Request API** 且改动限于规则资源的扩展开放，PageMask 不用 DNR，所以每次更新都要过审。
> → <https://developer.chrome.com/docs/webstore/skip-review/>

### 6.3 Manifest V2 下架时间线对 PageMask 的影响

**没有影响。** 官方时间线：

- 2022 年 1 月：Chrome 应用商店停止接受新的 Manifest V2 扩展（公开 / 未列出）。
- **2026 年 8 月 31 日：所有残留的 Manifest V2 扩展从 Chrome 应用商店移除**（"All remaining Manifest V2 extensions have been removed from the Chrome Web Store"）。

→ <https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline/>

PageMask 是 Manifest V3，不在影响范围内——这条时间线只是让你确认「不用担心 MV2 的下架潮把商店条目带走」。

### 6.4 版本历史怎么写

`docs/CHROMEWEBSTORE.md` §7 的表格是**提交商店时填的版本历史**（控制台在每次更新时会让你写 release notes）：

- 格式照 材料 §7 的表：一行一个版本，「版本号 | 日期 | 要点」。
- 0.9.7 那行已写好，内容与 `CHANGELOG.md` 的 0.9.7 条目一致（功能与权限集合无可见变化）。
- 材料 §7 开头注明：「0.4.2、0.5.0–0.5.5、0.6.2–0.6.7 为未上架商店的内部版本，故本表不列」——**商店的版本历史只写对外发过的版本**，内部版本别写进去。
- 提审时第一次填的版本历史应包含 0.9.7 这一行即可（更早的版本都是内部版本）。

---

## 7. 附录

### 7.1 术语小表：商店控制台用词 ↔ 本项目用词

| 控制台英文 | 中文 | 本项目对应 / 注意 |
|---|---|---|
| Item / Listing | 商品 / 商店条目 | PageMask |
| Store listing tab | 商店详情标签页 | 描述、类别、图片、链接 |
| Privacy practices tab（旧文档叫 Privacy tab） | 隐私实践 | 单一用途、权限理由、远程代码、数据披露、隐私政策 |
| Distribution tab | 分发 | 可见性、地区、内购 |
| Test instructions tab | 审核员测试说明 | 材料 §6 八步；官方定位是「需要凭据时用」 |
| Package tab | 包 | 上传后不可编辑 |
| Visibility: Public / Unlisted / Private | 公开 / 未列出 / 私有 | 见 §2.5 |
| Single purpose description | 单一用途说明 | 填 材料 §4 那一段 |
| Permissions justification | 权限理由 | 填 材料 §3 的四段 |
| Remote Code | 远程代码 | 选 No |
| Data usage | 数据使用 | 两组勾选，见 材料 §5 |
| Website content / Web history | 网站内容 / 浏览历史 | 材料 §5 勾的两项 |
| Limited Use | Limited Use（限定用途） | 政策里的术语，不翻译；`docs/PRIVACY.md` 有一句肯定声明 |
| Submit for review | 提交审核 | 交给审核员 |
| Defer publish / Publish | 延迟发布 / 发布 | 「提交」≠「公开」的分界，见 §2.7 |
| Pending review / Published / Rejected / Taken Down | 审核中 / 已发布 / 被拒 / 已下架 | 见 §5.1 |
| Appeal | 申诉 | 同一条违规只能一次 |
| Cancel review | 取消审核 | 仅 Pending 时可用，每天 6 次 |
| Roll back to previous version | 回滚到上一版本 | 需要新版本号，免审，一分钟生效 |
| Unpublish | 下架 | 列表页不再可见；重上要重新过审 |
| Developer / Publisher | 开发者 / 发布者 | 一个人 = 一个 developer；商店条目挂在 publisher 下 |
| Trusted tester accounts | 受信任测试者 | Account 页填个人邮箱，不支持群组 |
| Official URL（verified publisher） | 已验证发布者的官方网址 | 需要 Search Console 验证域名 |
| Content rating: Mature | 内容分级：成人内容 | PageMask 不勾；勾了未登录用户搜不到 |

### 7.2 控制台路径速查

| 想做什么 | 在控制台哪里点 |
|---|---|
| 注册 / 付注册费 | <https://chrome.google.com/webstore/devconsole> → 首次进入的注册页 |
| 填开发者资料、验证邮箱、加受信任测试者 | 左侧 **Account** |
| 新建商品、传包 | 左侧 **Items / 商品** → **Add new item** → Choose file → Upload |
| 改描述/图片/链接 | 商品页 → **Store listing** 标签页 |
| 填单一用途/权限理由/数据披露/隐私政策 URL | 商品页 → **Privacy practices** 标签页 |
| 选可见性、地区 | 商品页 → **Distribution** 标签页 |
| 贴审核员说明 | 商品页 → **Test instructions** 标签页 |
| 传新版本 | 商品页 → **Package** 标签页 → **Upload New Package** |
| 提交审核 | 商品页 → **Submit for review** |
| 取消审核 / 下架 / 回滚 | 商品页右上 **⋮ View more menu options** |
| 看被拒细节 | 商品页 → **Status** 标签页 |
| 申诉 | 商品页 → **Appeal** 按钮 |
| 看公开后的商店页 | <https://chromewebstore.google.com/> 搜 PageMask |

### 7.3 本项目特有的注意点清单

1. **名称与简介控制台改不了**。它们来自 `public/_locales/*/messages.json`（manifest 里是 `__MSG_extName__` / `__MSG_extDescription__`）。要改名字 = 改 `_locales` + 升版本号 + 重新打包重传（上传后 manifest 元数据不可编辑）。
2. **截图 6 张 > 上限 5 张**，按材料 §8 传 1/2/4/5/6。
3. **`*://*/*` 是官方点名的“拉长审核”因素**，权限理由与审核员备注必须写足（材料 §3、材料 §10、材料 §6），别让审核员自己推。
4. **`activeTab` 是官方“常见误解权限”清单里的一项**：官方说拥有宽泛主机权限时通常不需要 activeTab。我们的主机权限是可选的、安装时不授予任何站点，所以需要它——**主动说明，别等被问**。
5. **隐私政策 URL 指向 GitHub Pages**：<https://cherishfall.github.io/page-mask/privacy.html>（已点验 200；仓库 blob 那条作为备用）。改 URL 时要**同步改多处**：材料 §1、材料 §2 中英详细描述里的“隐私政策：”行、扩展设置页「关于」卡的「隐私政策」入口（`entrypoints/settings/App.vue` 的 `PRIVACY_URL` 与链接显示文字）、`tests/e2e/check-pages.mjs` 的 href 断言、`README.md` 与 `docs/PRIVACY.md` 的在线版本链接、以及本文件。另外**旧地址 `https://cherishfall.github.io/privacy.html` 的跳转页不能删**：老版本扩展和审核员还会点它（#193 的死链自动拒审）。改完也要发新版，已装着的旧扩展才会指到新地址。
6. **描述里不能出现不实说法**：「任何网站都可用」「完全不出网」「省流量」「挡广告」都不能写；正确口径是「PageMask 自身不发起任何网络请求」「变灰只是去掉颜色，页面照常加载」。
7. **中英两份描述必须一致**，不一致官方会弹 warning。
8. **两条快捷键的绑定要在真机复核**：`chrome://extensions/shortcuts` 改键 → 切回插件设置页/欢迎页，键帽要跟着变；自动化触发不了这一步。
9. **单账号只提交一个 PageMask**：官方 Spam & Placement 政策写明，任何开发者账号、**关联账号或 affiliate** 不得提交体验重复的扩展。
10. **每次更新都要过审**：免审核更新只给用 DNR 的扩展，PageMask 不适用。
11. **发布后 30 天内要点 Publish**（若选了延迟发布），过期会退回草稿、重新提交。
12. **扩展界面里有隐私政策入口**（插件设置页「关于」卡，#193，见 §3.3）：审核员在扩展里就能找到政策，不只是商店页上有。

---

## 8. 本指南的来源清单

写这份指南时核对过的官方页面（2026-11-13 核实，全部为 `developer.chrome.com` 官方文档）：

| 用途 | 链接 |
|---|---|
| 注册开发者账号、一次性注册费、邮箱不可改、支持的国家地区 | <https://developer.chrome.com/docs/webstore/register/> |
| 账号资料：Publisher name、验证邮箱、物理地址的适用条件、受信任测试者 | <https://developer.chrome.com/docs/webstore/set-up-account/> |
| 两步验证为发布前提 | <https://developer.chrome.com/docs/webstore/program-policies/two-step-verification/> |
| 上架流程、五个标签页、提交对话框、延迟发布、30 天期限、2GB 上限、新发布者最多 2 个已发布扩展 | <https://developer.chrome.com/docs/webstore/publish/> |
| 商店详情字段：图标 128×128、截图至少 1 张最多 5 张 1280×800、图块 440×280 / 1400×560、类别、语言、多语言、Homepage/Support URL、内容分级 | <https://developer.chrome.com/docs/webstore/cws-dashboard-listing/> |
| 隐私实践页四个字段 | <https://developer.chrome.com/docs/webstore/cws-dashboard-privacy/> |
| 可见性 Public/Unlisted/Private、地区、测试版标签 | <https://developer.chrome.com/docs/webstore/cws-dashboard-distribution/> |
| 审核员测试说明的定位 | <https://developer.chrome.com/docs/webstore/cws-dashboard-test-instructions/> |
| 审核时长、三类加严信号、宽泛主机权限拖长审核、拒绝/警告/下架、申诉与支持 | <https://developer.chrome.com/docs/webstore/review-process/> |
| 状态与邮件、加 `chromewebstore-noreply@google.com` | <https://developer.chrome.com/docs/webstore/check-review/> |
| 各类拒审原因与官方整改方法（含隐私政策死链、常见误解权限） | <https://developer.chrome.com/docs/webstore/troubleshooting/> |
| 打包要求、manifest 元数据不可编辑、版本号递增、描述 ≤132 | <https://developer.chrome.com/docs/webstore/prepare/> |
| 版本更新流程、灰度放量门槛 | <https://developer.chrome.com/docs/webstore/update/> |
| 回滚机制 | <https://developer.chrome.com/docs/webstore/rollback/> |
| 取消审核 | <https://developer.chrome.com/docs/webstore/cancel-review/> |
| 免审核更新的适用条件（仅 DNR） | <https://developer.chrome.com/docs/webstore/skip-review/> |
| Unpublish（下架）与账号/发布者删除 | <https://developer.chrome.com/docs/webstore/account-deletion/> |
| 政策总表（单一用途、Limited Use、披露要求、最小权限、Spam & Placement） | <https://developer.chrome.com/docs/webstore/program-policies/> |
| 用户数据 FAQ（本地处理也要披露、显著披露须在扩展界面、最小权限清单） | <https://developer.chrome.com/docs/webstore/program-policies/user-data-faq/> |
| 单一用途 FAQ（窄的领域也算单一用途） | <https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines-faq/> |
| 申诉次数限制与善意申诉要求 | <https://developer.chrome.com/docs/webstore/program-policies/notification-and-appeals/> |
| Manifest V2 下架时间线（2026-08-31 全部移除） | <https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline/> |

**没查到官方明文、按「以控制台为准」处理的项**：

- 注册费**具体金额**：官方文档只写 “a one-time registration fee”，金额在注册页现场显示。
- 「开发者身份验证（developer verification）」的**专门流程页**：本次核实 `developer.chrome.com` 的 Chrome 应用商店文档目录（`/docs/webstore/*` 与 `/docs/webstore/program-policies/*`）里**没有**这样一页（相关候选地址均返回 404）。与开发者身份最接近的官方要求是本文 §1.1–§1.3（Google 账号、一次性注册费、验证邮箱、Publisher name、强制两步验证）与 §1.5（verified publisher 官方网址）。**如果控制台弹窗要求补身份材料，按控制台的提示走**，别按本文猜。
- 「AI 生成内容」专项政策：本次核实未在现行政策目录里找到单独条款。PageMask 也没有 AI 功能；真出现新条款时以控制台为准。
