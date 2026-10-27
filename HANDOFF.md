# HANDOFF — PageMask 0.2.0 质量加固交接（2026-10-27，因积分不足暂停）

> 接手者读完本文件 + `AGENTS.md` + `docs/dev/AGENT-KICKOFF.md`（开工说明，无人值守规则全在里面）即可继续。
> 用户在 GitHub spec #18 下已把所有产品决策定好，**不要向用户提问**。
> `gh` 命令必须加前缀 `HTTPS_PROXY=http://127.0.0.1:7890`；git 免前缀。

## 1. 一句话现状

#18 下 19 张子票，**12 张已完成关闭**，剩 **6 张待做**（#23 #34 #24 #25 #36 #29）+ #37（P2，本轮不做）。
远程 `master` 最新代码提交 `f3781e2`（交接文档提交 `e4c53c5` 之后会更新）。版本仍是 0.1.0，tag `v0.2.0` 未打，#18 早间报告未写。

## 2. 已完成的票（均已推送，票内有验证评论，可当作可信基线）

| 票 | 内容 | 关键产出 |
|---|---|---|
| #19 | 存储层 | `core/validate.ts` 统一校验；`updateProfile(origin, fn)` 原子更新；导入先校验后写入 |
| #27 | 新图标 | `assets/icon/*.svg`、`scripts/gen-icons.mjs`、`public/icon/{16,32,48,128}.png`；`assets/icon/mono.svg` 供悬浮按钮 |
| #30 | 工程基建 | postinstall、精确版本、官方源 lockfile、CI、`scripts/check-package.mjs` 打包门禁、`THIRD_PARTY_NOTICES.txt`、SECURITY.md |
| #31 | 测试接缝 | `core/background-engine.ts` 工厂 + fakeBrowser 单测；可移植 E2E；工具见 `docs/dev/e2e.md` |
| #32 | 选择器与范围 | 候选非空、禁裸标签、稳定过滤；根路径精确匹配（`ScopePattern.match:'exact'`）、前缀带边界、hash 路由提示 |
| #33 | 设计 tokens | `styles/{tokens,base,shadow-base}.css`、`ui/shadow-styles.ts`、`tests/tokens-contrast.test.ts` |
| #20 | 注入引擎 | 按文档跟踪（`core/doc-styles.ts`）、prev/next 协议、首屏遮挡（ADR-0005）、document_start |
| #21 | 生命周期对账 | `core/reconcile.ts`；待授权状态；一键清空先还原页面；去占位内容脚本 |
| #35 | 默认标签页 | 全透明图标；默认标题「阅读」/Reading（`core/titles.ts`）；快捷标题；设置迁移 |
| #22 | 内容脚本生命周期 | WXT ctx；自定义元素宿主 + 宿主保护样式（`core/host-shield.ts`、`ui/page-host.ts`）；扩展更新后接管（ADR-0006） |
| #26 | 扩展页面 | popup/管理页/引导页：switch、dialog、编辑态分离、图标压缩、深色；`tests/e2e/check-pages.mjs` |
| #28 | manifest 多语言 | `public/_locales/{en,zh_CN}`；`minimum_chrome_version: 116`；门禁检查键一致 |

架构要点（接手前值得读）：`docs/adr/0005`（按文档注入 + 首屏遮挡）、`docs/adr/0006`（受保护宿主 + 更新接管）、`docs/dev/DEVLOG.md`（每票取舍）、`docs/dev/e2e.md`（E2E 用法与实测坑）。

## 3. 剩余票清单 + 模型强弱建议

判断依据：改动面大小、是否有状态机/并发/跨上下文推理、是否需要读懂 #20/#22 的架构、E2E 难度、出错后是否难以发现。

### 难度排序与分配

| 优先 | 票 | 难度 | 建议模型 | 理由 |
|---|---|---|---|---|
| 1 | **#34 向导状态机** | **高** | **强模型** | 向导 `ui/wizard/WizardApp.vue` 721 行，涉及选择集、草稿、预览、Esc 多层状态机、幽灵标记定位、命中检测；N6–N15 十几个相互牵连的缺陷，改一处易引出另一处。需要对交互状态建模。工作区已有大量半成品（见 §4）。 |
| 2 | **#23 遮罩方案** | **高** | **强模型** | MutationObserver 节流 + 事件驱动跟随定位 + 静止停帧 + 颜色算法 + 命中拦截；E2E 要在内容脚本隔离环境里统计 rAF；性能与正确性都得论证。半成品已有 `ui/mask-layer.ts`、`ui/follow.ts` 重写。 |
| 3 | **#25 悬浮按钮与页内无障碍** | **中高** | **强模型（或中档 + 严格验收）** | 要拆按钮/菜单、Popover 翻转定位、拖动用 pointer capture、向导确认框改原生 `<dialog>`、tokens 全量替换、对比度；还要处理 #22 提到的拖动监听泄漏。修的是实测故障 N1（菜单点「编辑规则」切换开关），E2E 需真实鼠标 + 视口边界断言，容易写偏。依赖 #34 先完成（向导确认框）。 |
| 4 | **#24 编辑面板** | **中** | **中档模型** | 范围清晰：popup 加入口、重选原子替换（改向导入参，**要等 #34 完成**）、面板监听存储、逐行校验、5 秒撤销。逻辑不深，但有 4 处跨文件联动。可用中档模型，验收时盯「重选取消规则不丢」「面板写入不把开关改回」。 |
| 5 | **#36 文档话术** | **低-中** | **弱/中档模型** | 纯文档重写，有附录 store 第二部分的现成文案可直接取用。风险在「一致性」与「逐字对应界面按钮名」，需逐条核对清单。不碰运行时代码。 |
| 6 | **#29 商店素材与发布** | **中（偏机械）** | **中档模型；截图构图可弱模型 + 人工复核** | 流程性：重拍 3–5 张截图（脚本 `tests/e2e/store-shots*.mjs` 已有）、checklist 自查、版本号、CHANGELOG 双语、打 tag、#18 早间报告。必须在其它票全部完成后做。截图的视觉判断（大字说明、之前/之后对比）弱模型易出错，建议读图自评。 |

### 推荐执行顺序

`#34 → #23`（可并行，但二者都改 `ui/content-runtime.ts`，**分开提交**）→ `#24`（依赖 #34）→ `#25`（依赖 #34、#22；建议最后做 UI 类）→ `#36` → `#29`。

### 省积分的建议

- **#34 与 #23 先用强模型把半成品验收掉**：不要重做。见 §4，已有大量代码，核心工作是「跑验证 → 修失败项 → 逐条核对验收」，验证本身比重写便宜得多。
- #36、#29 的机械部分（改文案、版本号、CHANGELOG）交给弱模型，强模型只做最后的一致性核对。
- 每次只开一张票的子任务；子任务提示词里把「读哪些文件」写死，避免它重复探索（上一轮的提示词模板可参考 git 历史里各票的评论）。

## 4. 工作区里的未提交半成品（重要）

两个子任务被中途取消，留下**未验证**的改动（`git status` 可见 18 个文件）。**不要直接提交**，先验证。

### 属于 #23（遮罩）
- 新增：`core/mask-color.ts`（+test）、`ui/mask-color.ts`、`ui/mask-layer.ts`、`tests/follow.test.ts`、`tests/mask-layer.test.ts`、`tests/e2e/check-mask.mjs`
- 修改：`ui/follow.ts`（+149 行，事件驱动跟随）、`ui/content-runtime.ts`（遮罩部分）

### 属于 #34（向导）
- 新增：`ui/wizard/wizard-styles.ts`、`ui/wizard/wizard.css`、`tests/e2e/check-wizard.mjs`
- 修改：`ui/wizard/WizardApp.vue`（±1008 行，几乎重写）、`ui/wizard/pick-controller.ts`（+108）、`core/wizard-logic.ts`（+71）与其测试（+88）

### 共同
- `package.json`：`test:e2e` 末尾被追加了脚本（需核对不重复、不遗漏，应包含 `run-e2e.mjs`、`check-pages.mjs`，以及新增的 `check-mask.mjs`、`check-wizard.mjs`）
- `tests/e2e/run-e2e.mjs`：小改（8 行）

### 处理步骤
1. `git stash list` 看有无我留下的 autostash（`d44f52e` 曾 autostash 后已恢复，应已在工作区）。
2. `npm run compile && npm test && npm run build`，先看编译/单测是否通过。
3. `npm run test:e2e`（含新增脚本），记录失败项。
4. 按票逐条核对验收（见各票正文），**分两次提交**：先 #23 相关文件，再 #34 相关文件；`ui/content-runtime.ts` 若两票都改过，用 `git add -p` 分开。
5. 若半成品质量差无法修：`git stash push -u -m "wip-23-34"` 后按票重做（stash 是可逆的，不要 `git checkout .`/`reset --hard`/`clean`）。
6. 每票提交后在票里评论验证结果并 `gh issue close`。验证没过不得推送。

## 5. 各剩余票的要点与验收（摘自票正文，细节以 `gh issue view <n> --comments` 为准）

### #34 向导状态机（依赖 #32 #22，已满足）
- 序号牌随选择重新编号；预览缓存矩形，改方案/移出后其它标记不坍缩；幽灵标记改角标 + 工具条草稿清单，不盖内容、不拦截点击。
- Esc 状态机（预览阶段可用；有浮层只关浮层；退出确认框 Esc＝继续编辑；输入法组字不响应）；确认框用原生 `<dialog>`。
- 「只藏这一个」切换即刷新预览；「移出本次选择」同步移出；「继续选择」保留草稿调整。
- 选大/选小作用于最后选中的元素并标明；按指针位置命中、滚动后重新命中；工具条默认底部居中且可拖动。
- 保存等待预览真正撤销；向导期间站点被清空给提示；文案清爽话术（附录 appendix-ui §4）。
- 验收 E2E：A/B/C 取消 A 序号变 1/2；预览中改 A 方案后 B 仍可操作；预览阶段 Esc 关弹片、确认框 Esc 不退出；「只藏这一个」后同类恢复；「继续选择」后方案保留；滚动后点击选中指针下元素。
- 指南：`modern-web-guidance` 的 `dialog`、`popover`/`menu`、`accessibility`、`drag`；提交说明里写明遵循了哪些。

### #23 遮罩（依赖 #22，已满足）
- 节流 MutationObserver：新命中元素自动补遮罩、移除时撤掉；原样态不运行；排除自身宿主（`isOwnUiNode`）。
- 跟随定位事件驱动（scroll capture、resize、ResizeObserver、变更后跑若干帧），静止停帧。
- 颜色取最近不透明祖先背景（纯函数在 `core/mask-color.ts`，深色页面不刺眼）；遮罩拦截点击；预览与运行时同一套颜色逻辑。
- 验收 E2E：2 秒后插入的元素被遮住、滚动跟手（偏差 ≤1px）；深色页面颜色一致、遮罩下链接点不到；静止 2 秒 rAF ≤2（用 `evalInContentWorld`）；原样态不挂观察器。

### #24 编辑面板（依赖 #19 #22 #34）
- popup 加「编辑当前网站」按钮（普通按钮，**不违反「永不做」**）；重选元素：向导接收"替换哪条规则"，保存时同一次写入替换，取消则旧规则保留；面板监听存储、SPA 换页后更新；高级后门逐行校验并指出第几行；删除后约 5 秒可撤销；失效规则显示人话说明 +「去处理」按钮。
- 注意：#26 把 popup 失效提示改成了可见文字，「去处理」按钮留给本票或 #25。
- 验收 E2E：popup 打开面板；重选取消规则不变、保存则替换；面板打开时 popup 切开关，面板内改动不会把开关改回；高级后门两行第二行不命中→拒绝并提示第 2 行。

### #25 悬浮按钮与页内无障碍（依赖 #22 #33 #34）
- 拆主按钮（`aria-pressed`，可见短文字「清爽」/「原样」+ 图标，用 `assets/icon/mono.svg`）与「⋯」菜单按钮；菜单用 Popover，Esc/点外部关闭，贴边自动翻转。
- 拖动：专用把手、`setPointerCapture`、处理 `pointercancel`；位置按「贴边 + 比例」保存，窗口变化夹紧。
- 向导确认框改 `<dialog>` 模态；toast 用 live region；label 关联；全部换用 tokens，对比度达标。
- 验收 E2E（真实鼠标）：点菜单「编辑规则」打开面板且开关不变（**当前 E2E 里这条是 expectFail → #25，完成后必须转正**）；默认右下角菜单完整在视口内；Tab 聚焦、回车切换；测试页含 `z-index:2147483647` 浮层时向导对话框仍在最上；无新快捷键/无右键菜单入口。
- 指南：`menu`、`viewport-aware-dropdowns`、`drag`、`dialog`、`light-dismiss-a-dialog`、`persistent-toast-notifications`、`accessibility`。

### #36 文档话术与一致性
- README（中英对等、步骤按钮名与界面逐字一致）、CHANGELOG（Keep a Changelog，中英对应，去「补刀」）、package.json 描述已改过；去掉「伪装 / 摸鱼 / 泄露 / disguise / 页面面具」（用户可见文档里）。
- GLOSSARY：标题简介改清爽定位；每个术语加「界面用词」字段（当前管理页用词：清爽模式、收起项、网站、待授权、已收起 N 项）；规定「伪装」仅限代码与内部文档。design.md 同步 6 处不一致；AGENTS.md 目录表登记 `CHROMEWEBSTORE.md`、新增「真实网站截图不入库或先打码」。
- PRIVACY.md 按附录 appendix-store §5 全文重写；联系邮箱 `cherishfall@hotmail.com`；隐私表单：勾 Website content + Web history，三条 Limited Use 全勾，写明仅存本机。
- 新建根目录 `CHROMEWEBSTORE.md`（取代 `docs/store-submission.md`，旧文件删除）：名称/简短说明来自 manifest、详细描述、权限逐项理由、单一用途、审核员备注与测试步骤、隐私表单填法、版本历史、待刷新截图清单。
- 删除 `HANDOFF.md`（本文件，交接完成后）、`docs/dev/evidence/real-*.png` 等含第三方人物/商标的图片。**不改写 git 历史、不 force push。**
- 验收：文档内部链接全部有效；用户可见文档无禁用词（可写个 grep 脚本核对）。
- 文案原料在 `docs/dev/review/appendix-store.md` 第二部分（可直接取用）。

### #29 商店素材与 0.2.0 发布（依赖以上全部）
- 截图 1280×800 共 3–5 张：中性虚构站点；首图为「之前/之后」对比 + ≥28px 大字；一张带浏览器标签栏展示标题/图标；popup 为正常状态；管理页用像样的虚构域名；新界面 + 新图标。宣传图块 440×280 用新图标，无 emoji。
- 按 `chrome-extensions` skill 的 review-checklist 逐项自查，结论写入 `CHROMEWEBSTORE.md`；确认安装警告为空、zip 只含运行文件。
- 版本号改 **0.2.0**（`package.json`；`npm run notices` 若版本字符串影响则重生成）；CHANGELOG 双语；`git tag v0.2.0` 并 `git push origin v0.2.0`。
- **不要发 1.0.0、不要提交商店。**
- 最后在 #18 评论早间报告：完成的票与提交、验证方式、人工验收清单（§6）、未完成/blocked 的票。

## 6. 需要用户人工验收的项（写进 #18 早间报告）

1. 真实浏览器授权弹窗路径：popup「为当前网站开启清爽模式」「重新授权」、管理页「授权并启用」「一次授权全部」；允许后立即生效，拒绝后配置保留并提示。自动化无法点击授权弹窗（#21 只验证了"点击时同步发起请求"）。
2. 新站点向导点「取消」后，授权是否被收回（仅单测覆盖）。
3. 16px 图标在真实工具栏/标签栏上的观感（深色底上蓝框对比约 3.5:1，识别靠白色内容区；必要时加 1px 浅描边）。
4. 正式版 Chrome 标签栏里的并排效果：本轮在 Chrome for Testing 157 中看到新标签页**显示了图标**，与审查文档"新标签页不显示图标"不一致，可能是 CfT 差异。
5. 英文界面下默认标题 "Reading" 与 manifest 英文名称（仅单测 + CfT 脚本验证）。
6. 商店截图成品、审核员测试步骤实走一遍。
7. 读屏软件实测（WCAG 结论需要人工辅助技术测试，不要在文档里写"符合 WCAG"）。

## 7. 其他已知遗留（不阻塞，酌情处理）

- 0.1.0 旧数据里根路径前缀规则仍等于整站（无法判断用户意图，未迁移）。
- 新站点向导中途直接关标签页，授权会保留（无配置、不注册、无影响）。
- 同主机其他端口的页面在读配置的几毫秒内会整页透明（内容脚本无法同步读配置）。
- 扩展更新后，停在向导预览中的旧实例留下的预览样式，需刷新页面才清除。
- 按键隔离只拦冒泡阶段，站点在捕获阶段绑的快捷键仍会触发。
- B15「离开生效范围的规则 stale 永久挂着」未处理；B33 向导预览/正式 CSS 已统一但可再核对。
- 休眠标签页的自检收尾只有守卫侧单测，页面侧无 E2E。
- `run-e2e-real.mjs`（真实网站微信读书/得到/极客时间/墨问）本轮**没有执行**，只改了选择器与输出目录；发布前若积分允许，在专用测试配置、仅匿名页面上跑一次（AGENTS.md 要求）。
- CI：`b7b8d76` 之后各提交的运行结果未逐一确认，请 `gh run list -L 10` 检查；Dependabot 首次运行报 "missing response"，可能需要在仓库设置里启用。依赖升级 PR 需同时跑 `npm run notices`（CI 会校验）。
- `/tmp/pm-head-*`、`/tmp/pm-iso-*`、`/tmp/pm-sync-iso.sh` 是子代理遗留的临时文件，可手动清理；`/tmp/pm/` 下有我的辅助脚本（`close.sh` 用于关票并勾选验收项，可忽略，丢了也不影响）。

## 8. 环境与命令速查

```bash
# 完整验证（一票完成前必跑；涉及运行时/界面的票含 e2e）
npm run compile && npm test && npm run build && npm run zip && npm run check:package && npm run test:e2e

# 单独跑
node tests/e2e/check-pages.mjs      # 扩展页面质量
node tests/e2e/check-i18n.mjs       # 多语言（手动）
node tests/e2e/check-dark-mode.mjs  # 深浅色（手动）

# GitHub
export HTTPS_PROXY=http://127.0.0.1:7890
gh issue view <n> --comments
gh api repos/cherishfall/page-mask/issues/<n> --jq '.issue_dependencies_summary.blocked_by'   # 0 = 可开工
gh issue edit <n> --add-assignee @me ; gh issue close <n>
```

- E2E 浏览器：`@puppeteer/browsers` 下载 CfT 157 到 `.cache/chrome/`（已忽略）；国内网络可设 `CFT_BASE_URL=https://registry.npmmirror.com/-/binary/chrome-for-testing`，或 `CHROME_PATH` 指向 `/tmp/cft/` 里已有的 CfT。品牌版 Chrome 137+ 不能用 `--load-extension`。
- npm：日常 `npm ci` 用 `~/.npmrc` 的镜像即可（不改 lockfile）；**新增/升级依赖**必须 `--registry=https://registry.npmjs.org --save-exact`，提交前 `grep -c registry.npmmirror.com package-lock.json` 必须为 0。详见 AGENTS.md「本机网络环境」。
- E2E 运行后若 `docs/dev/evidence/` 被覆写（不应再发生），用 `git checkout -- docs/dev/evidence/` 还原，不要提交。
- 提交：Conventional Commits，正文中文，结尾 `Closes #<n>`；`git pull --rebase` 后 `git push`，直接推 master。禁止 force push / `reset --hard` / `clean -f`。
- 「永不做」清单：快捷键、全局总开关、预置规则、远程订阅、右键菜单、免保存临时隐藏。任何情况下不得违反。
- 用户可见文案：清爽话术，不出现「伪装 / 摸鱼 / 泄露 / disguise」（代码内部命名可保留）。
