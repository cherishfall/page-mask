# 交接 / 工作前沿（0.7.x 批次）

最后更新：2026-11-06 21:00
当前版本：**`0.7.1`**（tag `v0.7.1`，release 已发布，附 `.output/page-mask-0.7.1-chrome.zip`），分支 `master`，`origin/master` = `6c60d26`。
`0.7.0` 已发布（tag `v0.7.0` + release + zip），issue#116 已关；复查票 #125–#130 逐票提交并立即推送、全部关闭。
下一步：代码侧已判定收敛，只剩**真机人工路径**（见下节），提交商店前由产品所有者完成。
本批目标：实现 issue#116「按站点收起图片 / 收起视频 / 静音网页」→ 发版 `0.7.0` → 全量复查并迭代到收敛 → 发版 `0.7.1`。

## 状态表

| 步骤 | 状态 | 备注 |
|---|---|---|
| 读项目文档 / 调研代码与同类产品 | 已完成 | 调研存档 `docs/dev/research-media-hiding.md`；平台事实已核实（见下） |
| 实现方案 + 待确认项 | 已完成，**产品所有者已确认** | `docs/dev/design-116.md`；拍板：小图标留原样、三处叫法定稿「收起图片 / 收起视频 / 静音网页」、菜单用开关角色、弹窗收成一组 |
| 子票 1 数据与行为 | **已完成、已推送** | 字段 / 校验 / CSS / 视频 / 静音 / 单测；`npm run compile` 通过、单测 670 全过、主 E2E 240 项全过 |
| 子票 2 三处界面 + i18n + 术语表 | **已完成、已推送** | 站点设置页卡片 / 弹窗一组三行 / ⋯ 菜单三个勾选项；`compile`、单测 679 项、全套 E2E 841 项全绿 |
| 子票 3 文档 + ADR-0012 | **已完成、已推送** | `21a3e13`：ADR-0012、`docs/design.md` / `design-ui.md` / `dev/design-116.md` / `dev/DEVLOG.md`、`README.md`、`CHANGELOG.md`（0.7.0 中英）、`CHROMEWEBSTORE.md`、`PRIVACY.md`；顺手修掉 PRIVACY 里废弃的「一键清空」与商店材料的「菜单四项 / 427 项」旧口径 |
| 发版 0.7.0 | **已完成** | `fd78e75` 版本号 → push → annotated tag `v0.7.0`（中文 changelog 小节为 message）→ `gh release create` 附 0.7.0 zip；发版门禁：compile / 679 单测 / check:docs / check:package（32 文件）/ 全套 E2E 841 项全绿 |
| 全量复查（含视觉）→ 新 issue → 0.7.x 迭代 | **三轮复查完成，#125–#130 全部关闭** | 独立代码复查 + 9 张真实渲染截图交「新眼睛」审（`tmp/review-0.7.0/`）；逐轮结论见下 |
| 发版 0.7.1 | **已完成** | `6c60d26` 版本号 + 双语 CHANGELOG + 商店材料 → push → annotated tag `v0.7.1`（中文 changelog 小节为 message）→ release 附 0.7.1 zip；发版门禁：compile / 693 单测 / check:docs / check:package（32 文件）/ 全套 E2E 842 项断言全绿 |

## 建议顺序

1. `0.7.0` 发版、三轮复查（#125–#130）与 `0.7.1` 发版已全部落地、逐票推送；`origin/master` = `6c60d26`。
2. 代码侧已收敛：三轮独立审查 + 主会话对最后一处修复的逐条核对，门禁全绿（693 单测 / 842 项 E2E 断言）。
3. 剩下的是**真机人工路径**（见下节），不是代码遗留问题；提交商店前由产品所有者完成。

## 硬约束（别踩）

- 一票一提交一推送：做完立刻 commit + **立即 push** 到 `master`，`gh issue close --comment "已实现，commit <hash>：一句话"`，再更新本文件，才做下一张。严禁攒着批量关。
- 门禁：`npm run compile` + `npx vitest run` + E2E（`CHROME_ARGS="--no-sandbox --disable-gpu"`）；文档票加 `npm run check:docs` / `check:package`。
- 新增字段必须同时改 `core/types.ts`、`core/validate.ts` 的 `sanitizeProfile` 白名单、`core/apply-key.ts`（否则拨开关不生效）。
- CSS 走现有 `insertCSS` 用户样式表通道（`origin: 'USER'` + `!important`），禁止行内样式 / `<style>` 标签 / 新权限 / DNR。
- 不改 `wxt.config.ts` 的权限集；`tabs.update({muted})` 已核实无需 `tabs` 权限。
- 不碰「永不做」清单：全局总开关、快捷键（幕布那条除外）、预置规则、远程订阅、右键菜单、免保存临时隐藏。
- 界面文案以 `GLOSSARY.md` 为唯一权威，中英两份 `core/i18n/messages.*.ts` 同步（键集合有单测守门）；禁止「清空 / 一键 / 屏蔽 / 拦截 / 配置」等 Avoid 词。
- 全过程文档中文；`README.md` / `CHANGELOG.md` 中英双语。临时文件一律放仓库内 `tmp/`。
- 真实网站验证只用匿名可访问页面与专用测试浏览器配置，第三方截图不入库（要入库先打码并放 `docs/dev/`）。
- 批次结束后删除本文件，过程教训进 `docs/dev/DEVLOG.md`，架构决策进 `docs/adr/`。

## 已核实的事实（省后续排查）

- `chrome.tabs.update({muted})` 不需要新增权限；`MutedInfo` 有 `reason`（`user` / `capture` / `extension`）与 `extensionId`（Chrome 46+），可据此只解除本扩展设置的静音。
- Chrome 自带的「静音网站」是按域名持久的站点权限，与扩展的标签页级静音互不覆盖；扩展不抢它。
- 没有 `tabs` 权限时 `tabs.query({})` 读不到 `tab.url`，但已授权站点有主机权限；静音消息走 `sender.tab.id` 定位，不依赖 query 读 url。
- 胶囊菜单当前**不是** `role="menu"`（`ui/FloatingToggle.vue` 源码注释），mini 形态没有 ⋯ 菜单；三项勾选要用开关角色，不能孤零零用 `menuitemcheckbox`。
- 弹窗 `ui/popup/PopupBody.vue` 宽 320，欢迎页直接复用同一组件做示意图；改动会自动反映到首次引导第 2 步。
- E2E：CfT 157 品牌版 Chrome 忽略 `--load-extension`，权限靠构建产物改 manifest 预授予；`chrome.action.openPopup()` 不授予 activeTab；check-mask 偶发 CDP 超时复跑即过。
- 仓库 `git stash@{0}` 是 `wip(#116): types+validate 预留字段`，票里明确说**不要当半成品继续用**，按票定稿重做。

## 第一轮复查结论（0.7.0 → 待发 0.7.1）

**代码复查**（独立子代理审 `v0.6.7..v0.7.0` 全量 diff，主会话逐条回源码核对）：

- ✅ 确认为真：`core/background-engine.ts` 的 `releaseMute()` 复用了双向 `reconcileMute()`，删除**任意**站点时会遍历所有标签页，把用户手动取消的静音重新按回去（违反 ADR-0012 的公开承诺）。应改成单向：只在 `mutedByUs && !shouldMute(url)` 时解静音，任何情况都不写 `muted:true`。
- ✅ 确认为真：`ui/media-controller.ts` 的 `decideImage()` 先用不需布局的属性尺寸短路，导致 `width=16 height=16` 却被 CSS 放大的图片被当成小图标放行；应始终带上渲染尺寸再判定。
- ✅ 确认为真：只关「收起图片」保留「收起视频」时走 `wasOn && isOn` 分支，不调 `clearKeepMarks()`，页面残留 `data-pm-media-keep`。
- ✅ 确认为真：`touchedVideos` 是强引用 Set，信息流反复替换 `<video>` 时只增不减（建议级）。
- ✅ 确认为真：站点设置页媒体三行缺 `role="group"`（`design-ui.md` 自己写了「弹窗 / 设置页收成 group」）；菜单未选中项无可见状态标记（清晰度）。
- ✅ 确认为真：`CHROMEWEBSTORE.md` §10 写「不遍历标签页、不读网址」，但 `releaseMute` / `tabs.onUpdated` / `shouldMute` 都会 `tabs.query({})` 并读 `tab.url` —— 商店材料失实，必须改。另 §6 写「seven items」却列了 8 项（拖动悬浮按钮后才有第 8 项）。
- ⚠️ 判定为设计如此、不改：`openWizard` 不解除标签页静音（向导是点选界面，退出后按存储重新对账；ADR-0012 已补一句说明）。内部注释 / 过程文档里的「网页静音」旧词顺手扫成定稿叫法（GLOSSARY 的 Avoid 列与讲这段历史的记录保留原词）。
- ⚠️ 待人工真机：扩展被停用 / 卸载后 Chrome 是否自动清掉 `reason='extension'` 的标签页静音（扩展无 management 权限，无法自行收尾；用户可在标签页上手动取消）。
- ❌ 误报，勿改：说明小字对比度（`fg-muted on bg` 浅 4.83 / 深 5.98，`on bg-subtle` 4.51 / 5.16，`tests/tokens-contrast.test.ts` 守门 ≥4.5）；开关点击区（`check-toggle.mjs` / `check-pages.mjs` 有 ≥24 断言，WCAG 2.5.8 另有 spacing 例外）；「按设置 / 原样」叫法（GLOSSARY 明确规定的短名）；英文页残留中文是截图夹具数据。

**视觉审查**（9 张真机截图 `tmp/review-0.7.0/`，独立「新眼睛」只看图）：

- 弹窗与站点设置页的**组级说明**跟最后一行「静音网页」的逐行说明视觉上分不开，容易被读成只解释静音 → 加一条细分隔 / 独立样式。
- 悬浮菜单三个开关的**未选中项**只有一个空占位，和同菜单里的普通动作项看不出区别 → 在同一 12px 占位里画一个淡的未选中框（文字不位移）。
- 截图脚本自身的两个覆盖缺口：`06-dark-popup.png` 没对 popup 单独设 `prefers-color-scheme`，与浅色弹窗同图；菜单展开后没关掉导致 `04-zh-page.png` 与菜单图重复。这两个是复查工具问题，不是产品问题，脚本要修。
- 其余（菜单项长得不像按钮、快捷键徽章小、危险红字贴底、图标无文字兜底、深色灰块边界偏弱）属既有设计或可忽略，本轮不动。

## 第二轮复查结论（专审第一轮修复，待发 0.7.1）

独立子代理审 `v0.7.0..HEAD`，主会话逐条核对后确认 4 处必修：

1. `releaseMute()` 用 `tabs.query` 的旧 `t.url` 算 `shouldMute`，却用 `tabs.get` 回查静音状态 —— 导航竞态下会解掉刚按新地址设对的静音。改用回查到的 `tab?.url`，两者同一快照。
2. `releaseMute()` 只在 `resetSite` 调；权限被收回（`permissions.onRemoved`）与整体替换导入（`storage.onChanged` 的 profile 增删）同样让配置消失，睡着 / 失联的标签页会留静音。这两条删除类触发点也补调用（单向、幂等）。
3. `decideImage()` 在渲染尺寸为 0（未布局 / `display:none`）时仍回退到 `width/height` 属性，等于把 #126 删掉的属性短路从判定函数内部复活；且 `attributeFilter` 没有 `class` / `style`，站点改类名把图显示成大图不会重判。改成「渲染尺寸无效时只有表情线索放行，其余先灰一帧」，`class` / `style` 纳入重判。
4. `forget()` 没把移除的元素从 `pending` 里删，后台标签页 rAF 被暂停时仍钉着引用；补 `pending.delete()`。
5. **写回归单测时另抓出一个 0.7.0 老 bug**（两轮审查都没报）：`onLoad` 只 `pending.add()`、不调 `schedule()`，所以「图片加载完重新判尺寸」全靠页面恰好还有别的 DOM 变动顺带触发，首屏懒加载的小图标可能一直灰着。补调度 + 回归单测；属第 3 条同一类（尺寸重判不可靠），已记进 #128 评论。

另收口：`pm-tg-box` 的真机断言补 `data-state=off` 与实际计算色；`media-ui.test.ts` 的 group 断言补 `aria-label`；商店材料里 `(As the site is)` / `as-is` 剩词与「0.7.0 待重走」标题统一到 0.7.1。

**判定可收敛、不改**：删自己站点仍能解除静音（有单测）、`shouldMute(undefined)` 的取舍、`forget` 移除又插入的生命周期、`clearKeepMarks` 与 pending 的竞态、`pm-tg-box` 深色对比度（tokens 单测 ≥3 守门）、group 嵌 region 的冗余、文案历史条目。

## 第三轮复查结论（专审第二轮修复与 #129，收口 0.7.1）

独立子代理审 `v0.7.0..HEAD` 的修复本身，主会话回源码核对：

- ✅ 确认为真并已修（#130）：`permissions.onRemoved` 的收尾是空转的——收回站点权限时配置不删，`shouldMute()` 只看配置，`releaseMute()` 不会解除静音；`tabs.onUpdated` 的双向对账还可能把已经不该管的标签页重新静音。把 `permissions.contains` 加进 `shouldMute()` 的前提，`releaseMute()` 仍只单向解除，重新授权后由 `syncMute` 恢复。补 3 条后台单测；ADR-0012 补「权限是生效前提」。0.7.1 的 CHANGELOG / 商店材料原先写「收回权限也不留哑标签页」属失实，修完才成立。
- ✅ 已核对无误：`releaseMute()` 用同一次 `tabs.get()` 取地址与静音状态、`resetSite` / `permissions.onRemoved` / profile 增删三条删除类路径、小图 rect=0 不回退属性尺寸、`onLoad` 自己排帧、`forget()` 清 pending、`restoreVideos()` 一轮一清、#125 的单向承诺。
- **#129（#128 关闭后自查）**：`childList` 里「把节点挪位置」原先先 `collect` 后 `forget`，刚排进 `pending` 的元素被抹掉。第一版改成「同一条记录里两个列表都出现的节点视为移动」，回归单测立刻抓出 jsdom 会把移动拆成两条记录、静音被还原一帧；最终改成 `forget()` 用 `node.isConnected` 判断——还在文档里就只重判、不还原、不删这一轮的原值记录。补回归单测盯住 `muted` 的赋值序列（只断言最终值看不出闪一帧）。
- 判定不改：`openWizard` 不解除标签页静音（ADR-0012 已写明）、`shouldMute(undefined)` 取舍、说明小字对比度、菜单项外观、`pm-tg-box` 深色对比度、group 嵌 region 的冗余、文案历史条目。

## 第四轮收口判定（复核 #130 修复本身）

独立复核者已派发，主会话同步按源码 + 测试逐条核对；按已完成的门禁判定**未发现新的功能性问题，代码侧可收敛**：

- `releaseMute()` 本身未改，仍是「`mutedByUs && !shouldMute` 才写 `muted:false`」，#125 的单向承诺不变；删别的网站时另一个网站上本扩展设的静音保持不动、用户手动取消的静音不被按回去，后台 80 项单测全过。
- 正常已授权路径：测试夹具默认授予 origin，`permissions.contains` 为真；693 单测与 842 项 E2E 断言（含 `check-media.mjs` 的静音归属、原样态还原）全绿。
- 非 http(s) / 读不到地址：`shouldMute(undefined)` 提前返回 false；`file://`、`chrome-extension://` 拼出的 pattern 若让 `permissions.contains` 抛错，被 catch 成「不该静音」，不会越界。
- 竞态：`permissions.onRemoved` 与 `resetSite()` 可能同时触发 `releaseMute()`，两者都单向且幂等；`resetSite()` 内部先撤权、再删配置，storage 变化还会再收一次尾。
- 同类排查：CSS 注入与内容脚本注册本就由 `reconcile()` 按站点权限对账，静音是唯一「不随配置消失、由浏览器记在标签页上」的状态，现已把权限算进判定。

## 待人工真机（不属于代码遗留问题，提交商店前完成）

- `CHROMEWEBSTORE.md` §6 的 8 步在真实 Chrome 上重走；品牌版 Chrome 的「允许」授权弹窗点一次确认（E2E 用等价消息代替）。
- 隐私表单在控制台勾选；提交前点验隐私政策 URL。
- 按 0.7.1 界面重拍商店截图 4 / 6（`tests/e2e/store-shots.mjs`）。
- 真实网站明暗底色下的灰块观感、中英文界面字长、菜单在矮窗口里的翻转、标签页静音小喇叭。
- 扩展被停用 / 卸载后 Chrome 是否自动清掉 `reason='extension'` 的标签页静音（扩展无 management 权限，无法自行收尾；用户可在标签页上手动取消）。

## 发版流程

版本号 → `CHANGELOG.md`（中英）→ push → annotated tag（message = 中文 changelog 小节）→
`HTTPS_PROXY=http://127.0.0.1:7890 gh release create` 附 `.output/*.zip` → 更新本文件。
