# 实现方案：按站点收起图片 / 收起视频 / 网页静音（#116，0.7.0）

> 状态：**待产品所有者确认**（2026-11-06）。确认后才开始写代码。
> 依据：issue#116 正文与两条拍板评论、`docs/dev/research-media-hiding.md`（两份调研报告合并存档）、
> `docs/design.md`、`docs/design-ui.md`、`GLOSSARY.md`、`AGENTS.md` 的 UI/UX 准则。

## 一、调研结论（先把事实摆清）

### 同类产品与平台事实

| 参考对象 | 取用的做法 | 出处 |
|---|---|---|
| 微博 App 无图模式、X Data Saver、Reddit Low data、Telegram | 图片变成**灰块占位**，布局不动、页面不塌、点了还能打开内容 | `docs/dev/research-media-hiding.md` §原生产品先例 |
| HoverBlurr、Blur. | **小尺寸图片豁免**：按钮图标、表情不收，否则页面「坏相」比不收更明显 | 同上 §产品侧调研 |
| uBlock Origin | 按站点切换、图与媒体是**两个独立开关**；全局开关是同类产品最高频差评 | 同上 §uBO 四层机制 |
| Text Mode、Chrome 站点禁图 | 反例：裂图 / 布局塌 / 关掉不复原，都是差评形态 | 同上 |
| Chrome 自带标签页静音 | `chrome.tabs.update({muted})` 不需要新增 `tabs` 权限；`MutedInfo.reason` 有 `user` / `capture` / `extension`，`extensionId` 标明是哪个扩展改的静音状态（Chrome 46+） | [Chrome 官方 tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs)、[中文版](https://developer.chrome.com/docs/extensions/reference/tabs/?hl=zh-cn) |
| Chrome 自带「静音网站」 | 按域名持久、浏览器自己记；扩展的标签页静音是**标签页级、会话级**，两者不是一回事 | 同上官方文档 + Chrome 帮助 |

设计系统侧按 `AGENTS.md` 要求对照了 [GOV.UK Button](https://design-system.service.gov.uk/components/button/)、
[Carbon Button/Type](https://carbondesignsystem.com/)、[Ant Design Button](https://ant.design/components/button)、
[Material 3](https://m3.material.io/) 与 [WCAG 2.2](https://www.w3.org/TR/WCAG22/)：
四家在「一屏一个主按钮、次按钮成对、危险色只给破坏性动作」上完全一致；
开关 / 勾选要满足 2.5.8 点击区 ≥24 与 4.1.2 名称角色值。
本项目落地口径见 `docs/design-ui.md` 与 `styles/controls.css`。

### 代码落点（已逐处核对）

| 位置 | 为什么必须改 |
|---|---|
| `core/types.ts` | `SiteProfile` 加 `hideImages? / hideVideos? / mutePage?`，显式 `true` 才落字段（同 `capsuleMini` 口径） |
| `core/validate.ts` `sanitizeProfile` | **字段白名单**：不加就写不进存储，导入也会丢 |
| `core/apply-key.ts` | **不加就不会即时生效**：键没变时 `refreshState` 提前返回，拨开关页面不会重应用 |
| `core/css-builder.ts` `buildDisguiseCss` / `core/background-engine.ts` `disguiseCssFor` | 灰块 CSS 作为常量文本块并入正式样式；原样态 / 0 条规则时也要能只输出媒体块 |
| `ui/content-runtime.ts` `shield.narrow` / `applyAll` | 首屏遮挡与正式样式用同一份 CSS 文本，防首屏闪真图 |
| `core/messages.ts` + `core/background-engine.ts` | 新增一条内容脚本 → 后台的静音消息，按 `sender.tab.id` 定位（与 `resetSiteHere` 同套路） |
| `ui/content-runtime.ts` `applyAll/restoreAll/clearPageUi` | 视频 pause / 拦 `play`、静音状态的生命周期与还原 |
| `core/i18n/messages.{zh,en}.ts` | 键集合有单测强制一致，两边同步 |
| `GLOSSARY.md` / `docs/design.md` / `README.md` / `CHROMEWEBSTORE.md` / `CHANGELOG.md` | 术语、设计共识、商店描述、发版说明 |

**权限**：`wxt.config.ts` 现有 `storage / scripting / activeTab + 按站点可选主机权限` 够用，
`chrome.tabs.update({muted})` 不需要新权限（已核实），安装时的「无站点权限提示」不变。
**数据兼容**：`mergeProfiles` 取 `updatedAt` 较新一方的站点级字段，三个开关自动跟着走；
旧数据缺省即「不收起」，不需要迁移；导出文件结构不变。

## 二、做出来是什么样（用户视角）

三个开关都在「按你的设置显示」时生效，切「网站原样」全部还原（包括声音）；按网站记，一个网站设一次，
同站多个标签页一起变。三个开关互相独立：

| 开关 | 打开后 | 关掉后 |
|---|---|---|
| 收起图片 | 网页上的图片变均匀灰块，**位置不变、链接还能点**，像手机上的无图模式 | 图片原样回来 |
| 收起视频 | 视频变灰块 + **暂停 + 不出声**（站点脚本反复调播放也会被拉停） | 画面回来，播放由网站自己决定 |
| 网页静音 | 整个标签页没声音（就是 Chrome 标签页上那个小喇叭），**画面照常**，适合「看视频不出声」 | 声音回来 |

明示边界（写进界面说明与 README，不夸大）：

- 这是**看起来收起，不是不加载**：图片请求照发，浏览器开发者工具的 Network 面板里还在。
- 本期不收：用 CSS 背景图画出来的头像 / 横幅、网页里嵌入的第三方播放器、`<canvas>`、内联 SVG 插图；
  整站生效，不按页面细调；不做单张点击恢复、不做模糊形态、不做「连请求都不发」档位。
- 不做全局开关（`docs/design.md`「永不做」清单）。

## 三、三处界面怎么放

| 位置 | 形态 |
|---|---|
| 站点设置页 | 新卡「图片和视频」：三行开关，每行下面一句白话说明；卡片底部一行总说明写清「只在按你的设置显示时起作用，切原样会连声音一起还原」「图片其实还在加载」 |
| 插件弹窗 | 只在**已添加的网站**出现。三行紧凑开关收成一组，说明只留一行放在这组下面；不新增按钮，主按钮仍是「收起内容」 |
| 悬浮按钮 ⋯ 菜单 | 新分组三项可勾选项，勾中状态就地显示；放在现有「标题和图标 / 收起内容」组之后、「调整不透明度」组之前 |
| 首次引导 | 不加步骤（第 2 步的弹窗示意图是真实组件，自动跟上） |

说明文字一律跟着它解释的那组开关走，不塞进操作栏（AGENTS.md「界面整屏审查」第 1 条）。

### 我不同意票里三处细节，先报备（不擅自改产品决策）

1. **菜单勾选项的技术做法**：票里写 `role="menuitemcheckbox" + aria-checked`，
   但 `ui/FloatingToggle.vue` 的菜单**刻意不是** `role="menu"`（源码注释：那要配套方向键导航契约）。
   孤零零给三项加 `menuitemcheckbox` 会让读屏软件读到没有父菜单的菜单项，违反 WCAG 4.1.2。
   建议改成「三个带勾选标记的按钮，用开关的角色（`role="switch"` + `aria-checked`）」——
   视觉与交互完全一样，读屏正确，也不用重写整个菜单的键盘导航。
2. **小图标豁免**：票里定「本期不做，真机看过再说」。但调研里这是明确的差评形态
   （HoverBlurr 的最小尺寸过滤、微博无图模式的做法都是留着图标）：微博 / X 上 16–24px 的按钮图标、
   表情全变灰方块，页面会显得**坏了**，反而更扎眼，与「不显眼」的产品目的相反。
   建议本期就做：只收渲染尺寸较大的图，≤32px 的图标与 `[class*=emoji]` 留原样；
   代价是仅在开关打开期间挂一个轻量的增量扫描（不影响未开启的页面与未添加的网站）。
   **这一条是真正的产品取舍，需要你拍板。**
3. **三个开关的叫法**：票里正文写「网页静音」、标题写「网站静音」，
   而本项目「网站」特指按域名存的那份设置，混着叫会让人以为在管整个网站的声音。
   建议三处界面统一为动词 + 对象的一组：「收起图片」「收起视频」「静音网页」，
   英文 "Hide images" / "Hide videos" / "Mute this page"；依据 `GLOSSARY.md`「同一件事只有一种叫法」
   与 Chrome 自身「静音网站」的动词写法。**也请你一并拍板。**

另外一条意见（不用拍板，按准则核对后的结论）：原 spec 建议「弹窗本期不加，保持密度」，
拍板改成三处都放。对照 uBlock 面板、Dark Reader 弹窗，多个开关并列是成熟做法；
「一屏一个主操作」约束的是实心主按钮，开关不在此列。加三行后弹窗仍在一屏内，可以加，
但必须收成一组、说明只留一行，不能变成三块各带一段说明。

## 四、静音的边界（我按最稳妥的方式定，提前讲清不问）

平台限制带来的副作用，用户不可能自己问出来，按 `AGENTS.md` 协作原则第 4 条主动写明：

1. **静音是标签页级，不是网站级**：从这个网站点到别的网站，那个标签页可能还是静音的。
   扩展会在离开该网站（导航、SPA 换域）时自动恢复声音。
2. **用户手动取消静音后，扩展不追着按回去**：想临时听一下就听；直到下次拨开关 / 切两态才重新按设置来。
3. **只解除自己静音的标签页**：解除前核对 `mutedInfo.reason === 'extension'` 且
   `extensionId === 本扩展 ID`（已核实 Chrome 46+ 提供），不抢用户手动静音、也不抢 Chrome 自带的「静音网站」。
4. **删除这个网站的设置 / 一键清空 / 切「网站原样」时**，先还原声音再收尾，避免留下一个哑掉的标签页。
5. 标签页上出现小喇叭斜线图标是 Chrome 的正常状态显示，不是异常；这条写进界面说明。

## 五、拆票与验收

一张票一个提交一推送，做完立刻 `npm run compile` + `npx vitest run` + E2E，再 commit / push / 关票 / 更新 HANDOFF。

| # | 内容 | 验收 |
|---|---|---|
| 1 | 数据与行为：三个字段、校验 / 导入导出 / 旧数据、灰块 CSS 并入管线、视频 pause + 拦 play、标签页静音与四类边界清理 | 单测覆盖字段口径、CSS 文本、静音归属判断；`compile` / 单测通过 |
| 2 | 三处界面 + 中英文案 + `GLOSSARY.md` | 三处数据同源、拨动即时；i18n 键集合测试通过；按「界面整屏审查」五条自查 |
| 3 | 文档与真机验收：`docs/design.md`、`design-ui.md`、`README.md`、`CHROMEWEBSTORE.md`、`CHANGELOG.md`、ADR-0012；真机灰块观感（明暗站点、小图豁免）、E2E 全套 | `check:docs` / `check:package` / E2E 全绿；截图入 `docs/dev/evidence/0.7.0/` |
| 4 | 发版 0.7.0：版本号 → CHANGELOG（中英）→ push → annotated tag → `gh release create` 附 `.output/*.zip`；更新 `HANDOFF.md` | release 与 tag 一致 |
| 5 | 全量复查（含视觉）：按 `docs/dev/visual-review.md` 巡检全部界面 + 真机路径；发现问题开新 issue → 修 → 版本号第三位 +1 发版 → 再复查，直到收敛 | 每轮留审查结论与截图 |

**门禁**：`npm run compile`、`npx vitest run`、
`CHROME_ARGS="--no-sandbox --disable-gpu"` 下的 E2E、文档票加 `npm run check:docs` / `check:package`。
真机验证只用匿名可访问页面与专用测试浏览器配置。

## 六、待确认清单

1. 小图标（≤32px、表情）本期要不要留原样 —— 推荐**留原样**。
2. 「收起图片 / 收起视频 / 静音网页」这组叫法是否定稿 —— 推荐**定稿这组**。
3. 上面第三节另外两点（菜单用开关角色、弹窗收成一组）是否照建议做 —— 推荐**照做**。
4. 整份方案是否开工。
