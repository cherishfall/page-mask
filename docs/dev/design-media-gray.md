# 实现方案：图片和视频变灰 + 幕布静音（#131，0.8.0）

> 状态：**产品所有者已逐条确认（2026-11-07），方案定稿**。
> 取代 `docs/dev/design-116.md`（0.7.x 三开关方案）；决策记录见 ADR-0013（取代 ADR-0012）。
> 依据：issue#131、`docs/dev/research-media-hiding.md`（含本轮补充核实）、`docs/design.md`、`docs/design-ui.md`、`GLOSSARY.md`、AGENTS.md。

## 一、为什么重做（三句话）

0.7.x 的三个开关被产品所有者否决：三个平级开关是「设置」的语言、用户要的是「一点就生效」的动作；图片/视频拆开在封面图上互相打架；灰块全有全无（图片是内容主体时看点 100 下）。「静音网页」与 Chrome 原生平行、维护成本高（0.7.1 一半修复在伺候它），且用户真正要的是「幕布遮住时声音一起按住」。

平台核实（Chromium 源码级）：`chrome.contentSettings.sound` Chrome 141 起才有且 nodoc、`contentSettings` 权限带安装警告且存量用户升级被停用、扩展规则压过用户操作（右键解除失效）、重启不持久——「代理原生静音」否决。斜线喇叭只在「静音且最近出过声」时显示（Chrome 统一行为，写进说明防误会）。

## 二、做出来是什么样（用户视角）

一个按站点的开关，胶囊「媒体」钮、弹窗、站点设置页三处同名同物：

| 打开后 | 关掉后 |
|---|---|
| 图片与视频（含视频封面帧）变成**黑白**：位置不变、大小不变、链接还能点、截图里的字还能看清；整个页面从花花绿绿降到像一篇图文资料。≤32px 小图标与表情留原样。站点**自动播放**的视频被按住；**点击某个视频区域后，那一个视频放行正常播放**（画面保持黑白） | 图片视频恢复彩色；被按停的视频不替网站恢复播放（用户自己点播放） |

- **声音完全不参与**：不写 `muted`、不管 `<audio>`；音量交给播放器自己的按钮、Chrome 右键标签页「静音网站」。
- **幕布补全**：「遮住这一页」时**当前标签页的声音一起按住**，恢复时一并还原；只解除本扩展设的那份静音；生命周期与幕布一致（刷新/整页跳转/关标签页声音跟着幕布回来；未添加网站的弹窗幕布同样遮声）。
- 明示边界（写进界面说明与 README，不夸大）：**看起来变灰，不是不加载**，图片请求照发；背景图、iframe 内嵌播放器、`<canvas>`、内联 SVG 不变灰；灰度是降调不是伪装，再往上一级是幕布。

## 三、交互细则（实现必须遵守）

1. **开关语义**：`mediaGray` 只在清爽态生效（既有模型不变）。原样态下拨「媒体」钮 / 弹窗开关只改设置、页面不动（原样 = 什么都不应用，与 0.7.x 一致）。胶囊媒体钮用 `aria-pressed` + 选中态整钮填实（0.8.9 起：墨底反白，iOS 控制中心 / M3 filled icon button 同构）/ 透明底描边（关）两态，不依赖颜色单通道。
2. **点击放行判定**（视频自动播放压制的关键）：
   - 内容脚本在 document 捕获阶段记录「最近一次用户意图事件」：`pointerdown` 与键盘 `keydown`（Enter / 空格，保键盘可达性），记 `{target, time}`。
   - `play` 事件（捕获阶段）：目标视频若已被放行 → 不干预；否则若最近意图事件在 **10 秒内** 且 target 是该视频本身、在其内部、或在其 **三层祖先** 内 → 放行该视频（本次文档生命周期内永久放行）；否则 `pause()`。
   - 放行集合按文档记忆；开关关闭 / 文档销毁即清空。站点脚本抢播放仍是「每次 play 就地压一次」，与 0.7.x 同款，不包 prototype、不装轮询。
   - 启发式是真机调参项（见第七节）；不可靠时退到更严的「target 是视频本身或在其内部」。
3. **开关打开瞬间**：扫到的正在播放的视频一律 `pause()`（用户此刻要的是安静）；不放行任何视频。
4. **幕布静音生命周期**：
   - 遮住 → 内容脚本/弹窗发消息 → 后台 `tabs.update(sender.tab.id, {muted: true})`；目标标签页已被静音（任何 reason）就跳过。
   - 恢复 → 只写 `muted: false`，且前提 `mutedInfo.reason === 'extension' && extensionId === 本扩展`（用户手动静音、Chrome「静音网站」、其他扩展一律不碰）。
   - 刷新/整页跳转/关标签页 → 内容脚本 `pagehide` 发还原消息；内容脚本被杀的路径由后台 `tabs.onUpdated`（`changeInfo.status === 'loading'`）兜底还原。SPA 站内切换不发 loading、幕布还在 → 不还原。
   - 幕布的既有收尾路径（进向导、删除网站、扩展失效）撤幕布时连声音一起还。
5. **性能红线不变**：监听与 observer 只在开关打开期间存在；未开启的页面、未添加的网站零开销。

## 四、代码落点（逐处核对过）

| 位置 | 改什么 |
|---|---|
| `core/types.ts` | 删 `hideImages`/`hideVideos`/`mutePage`，加 `mediaGray?: true`（显式 true 才落库） |
| `core/validate.ts` | 白名单换字段；**旧数据迁移**：`hideImages \|\| hideVideos → mediaGray`，`mutePage` 丢弃（导入 0.7.x 导出文件同路径） |
| `core/media.ts` | `MediaFlags` 收敛为单开关；`buildMediaCss` 输出 `img:not([data-pm-media-keep]), video { filter: grayscale(1) !important }`（删灰块的 brightness/invert/background）；`MEDIA_FLAG_KEYS` → `['mediaGray']` |
| `core/apply-key.ts` | 键清单换 `mediaGray`（不加就不即时生效，硬约束） |
| `ui/media-controller.ts` | 大幅缩身：删 `originalMuted`/`touchedVideos`/`restoreVideos` 全套；视频从「pause+muted+拦 play」改为「拦 play + 意图放行」；新增 pointerdown/keydown 意图记录与放行集合 |
| `core/css-builder.ts` / `core/background-engine.ts` | 媒体块并入管线不变；`buildDisguiseCss` 的 media 参数换成单开关 |
| `core/background-engine.ts` | 删 `syncMute`/`releaseMute`/`shouldMute`/地址变化对账/`permissions.onRemoved` 静音收尾；新增 `curtainMute` 消息（content/popup → 后台，`sender.tab.id` 定位）；`onUpdated` 只留幕布静音兜底（status loading → 回查 `mutedInfo` → 单向解除） |
| `ui/curtain-controller.ts` / 一次性幕布脚本 | 遮住/恢复/`pagehide` 时发 `curtainMute` 消息；撤幕布的既有收尾路径连声音一起还 |
| `ui/FloatingToggle.vue` | 加「媒体」钮（全功能 + mini，`aria-pressed`、实心/描边两态）；删菜单媒体分组；`MEDIA_FLAG_KEYS` 引用收敛 |
| `ui/popup/PopupBody.vue` | 三行组 → 一行开关 + 一句说明（说明跟着开关走，不进操作栏） |
| 管理页站点设置 | 卡「图片、视频和声音」→「图片和视频」：一行开关 + 说明；删声音相关文案 |
| `core/i18n/messages.{zh,en}.ts` | 新键 `media.gray*`；删三个旧键（键集合单测同步） |
| `tests/` | 单测：迁移、CSS 文本、放行判定（模拟意图事件序列）、幕布静音归属；E2E `check-media.mjs` 重写：灰度计算值、自动播放压制、点击放行、原样还原、幕布静音/还原/兜底 |

**权限**：无新增（`contentSettings` 路线否决的最大红利）；`wxt.config.ts` 权限集不动。

## 五、数据迁移

- 存储/导入路径统一走 `sanitizeProfile`：读到 `hideImages`/`hideVideos`/`mutePage` → 映射 `mediaGray`（前者任一为 true 即 true）、删旧字段。
- 不需要版本号分支：字段白名单 + 映射天然幂等；导出文件从 0.8.0 起只含 `mediaGray`。
- 「静音网页」设置**不迁移**（功能删除，CHANGELOG 写明）。

## 六、拆票与验收

| # | 内容 | 验收 |
|---|---|---|
| 1 | 方案定稿：spec + GLOSSARY + ADR-0013（取代 0012）+ design.md | `npm run check:docs` 通过；本提交 |
| 2 | 数据与行为：types/validate/apply-key、media.ts 灰度、media-controller 放行、后台删静音 + 幕布静音、curtain 接线 | compile + 单测全绿（迁移、CSS、放行判定、静音归属） |
| 3 | 三处界面 + i18n + 文档与发版：胶囊媒体钮（全功能+mini）、弹窗、站点设置、菜单退场、GLOSSARY/design.md 收尾、README/CHANGELOG/CHROMEWEBSTORE/PRIVACY 同类审计、真机验证、发版 0.8.0 | 门禁全绿（含 E2E 重写项）；「界面整屏审查」五条；真机清单（下节） |

**门禁**：`npm run compile`、`npx vitest run`、E2E（`CHROME_ARGS="--no-sandbox --disable-gpu"`）、文档票加 `check:docs` / `check:package`。

## 七、真机验证清单（提交商店前）

- 微博 / X 匿名页 + 专用配置：明暗底色的灰度观感；封面帧灰度；小图标与表情留原样。
- X 自动播放压制（刷新信息流后无自动播动）；点击视频放行且灰度保持；放行后播放流畅（compositor 滤镜性能）。
- 「点击放行」启发式两侧站点都验：点击封面/播放钮（微博）、点击播放器（X）；键盘 Enter/空格放行。
- 幕布：遮住即哑、恢复有声；用户右键静音过的标签页幕布不碰；幕布期间整页跳转声音回来；斜线小喇叭只在出过声后出现。
- 中英两语言的字长与换行。

## 八、风险清单

1. 放行启发式（三层祖先 + 10 秒）在 X 的播放器结构上可能偏松/偏紧——真机调参，退路见第三节第 2 条。
2. 灰度播放的性能：`filter` 走合成器，理论无碍，真机确认。
3. `tabs.onUpdated` 兜底会在每次导航唤醒后台——与 0.7.x 同量级（原对账也在用），不做额外唤醒。
4. 幕布静音与「遮住按钮」拖动/恢复的时序：恢复消息必须晚于幕布撤除的渲染，避免「画面回来了声音还哑一拍」——E2E 盯断言顺序。
5. 深色站点上灰度后的对比度：图片亮度不变、只去色，理论无碍，真机确认。
