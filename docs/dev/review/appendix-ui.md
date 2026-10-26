# PageMask 前端 + 无障碍审查（UI 层，只读）

审查对象：`/Users/lifan/AiCodingProjects/page-mask`（WXT 0.21 + Vue 3 + TS，HEAD = da59f89，工作区仅多一个未跟踪的 CLAUDE.md）
范围：`ui/content-runtime.ts`、`ui/FloatingToggle.vue`、`ui/follow.ts`、`ui/wizard/*`、`ui/editor/EditorPanel.vue`、`core/wizard-logic.ts`、`core/naming.ts`、`entrypoints/{popup,management,onboarding}/*`，外加 `docs/store-assets/*.png`。
依据：chrome-extensions skill；modern-web-guidance 指南 `dialog`、`light-dismiss-a-dialog`、`menu`、`viewport-aware-dropdowns`、`switch`、`drag`、`dark-mode`、`color`、`accessibility`、`html`、`shadow-dom`、`styling-web-components`、`persistent-toast-notifications`；项目文档 `docs/design.md`（含「永不做」清单）、`GLOSSARY.md`、`docs/dev/REVIEW-2026-10-27.md`（下称「旧审查」）。
方法：通读代码、手工追踪代码路径；对比度用 WCAG 2.x 相对亮度公式算出（半透明色先和底色混合）；截图用肉眼检查。**没有跑浏览器**，凡是依赖运行时行为的结论都写了置信度，单独待实测的项列在第 6 节。

级别：**P0** 上架前必修（功能断掉、数据丢失、审核风险）｜**P1** 明显影响体验 / 无障碍 A 级问题｜**P2** 打磨项。

---

## 0. 结论速览

1. **页面内编辑面板实际上打不开（N1，P0）**。悬浮按钮菜单项点下去时，`pointerdown` 冒泡到胶囊根节点，先把菜单关掉，`pointerup` 时又发出 `toggle`。结果是点「编辑规则」会切换清爽/原样状态，而不是打开面板。E2E 是直接发 `openEditor` 消息绕过菜单的，所以没测出来。popup 和管理页都没有别的编辑入口，用户只剩「一键清空」能删规则。
2. **预览用的样式也存在 SW 内存 Map 里（N2，P0，旧审查 E1 的延伸）**。预览阶段停留超过约 30 秒，Service Worker 就会被回收，之后点「放弃」或保存都撤不掉预览样式。页面会一直藏着没保存的元素，这正好是「永不做」清单里的「免保存临时隐藏」。
3. **用户能看到的文案里还有「伪装 / 泄露」**（N3，P0）：popup 的不支持提示「…不支持伪装」、管理页的「…反而泄露」，而且**这两句都出现在商店截图 3、4 里**。
4. 向导里有一组环环相扣的状态机缺陷：序号牌编号错乱 / 重复（N6）、重排预览后幽灵标记坍缩成 0×0（N7）、幽灵标记盖住重排上来的内容（N8，截图 2 能直接看到）、预览阶段 Esc 完全失效、确认框上按 Esc 反而直接退出（N9）、「移出本次选择」没有真的移出（N11）、「继续选择」会清掉所有调整（N12）、选大/选小作用在错误的元素上（N13）、滚动后点击选中的是旧元素（N14）。
5. 无障碍：悬浮按钮、菜单、所有对话框都不是语义控件，没有焦点管理，提示没有 live region。主按钮 `#fff on #3575e0` 只有 **4.40:1**，没过 AA；胶囊文字在白底页面上只有 **2.03:1**；说明文字大量用 `#999`（2.85:1）。
6. 旧审查里有一条怀疑**不成立**：Vue 深层响应式**不会**把 DOM Element 包成代理，`selEls.value.includes(el)` 和以 el 为键的 Map 判等都没问题（见 §5）。

---

## 1. 功能缺陷

### N1｜P0｜悬浮按钮菜单项点击 = 切换开关，编辑面板实际不可达
- **位置**：`ui/FloatingToggle.vue:2`（根节点 `@pointerdown.prevent="onPointerDown"`）、`:4-7`（菜单 DOM 是根节点的子节点）、`:82-114`（`onPointerDown`：`menuOpen=false` → `onUp` 里没移动就 `emit('toggle')`）
- **证据**：点菜单项时，`pointerdown` 冒泡到根节点；`e.button===0`，于是把菜单关掉（Vue 下一个 microtask 就把菜单从 DOM 删掉），并在 window 上挂 `pointerup`。松手时 `moved=false`，于是 `emit('toggle')`。按下时的目标节点已经被删除，`click` 会派发到共同祖先，菜单项上的 `@click.stop="onMenuEdit"` 大概率收不到。`tests/e2e/run-e2e.mjs:331` 直接用 `chrome.tabs.sendMessage(id,{t:'openEditor'})` 打开面板，没有覆盖菜单路径。popup（`entrypoints/popup/App.vue`）里也没有发 `openEditor` 的入口。
- **影响**：design.md 里的「主编辑器」对真实用户来说打不开：换收起方案、改生效范围、删单条规则、高级后门全都用不了。每次尝试都会把页面切到原样态（标题、图标也一起恢复）。「按钮归位」同样失效。
- **修复建议**：胶囊拆成两个真 `<button>`：主按钮负责切换，旁边一个「⋯」按钮带 `popovertarget` 打开菜单。菜单用 `popover="auto"`，自带点外面关闭和 Esc 关闭（`menu`、`viewport-aware-dropdowns`）。拖动只从主按钮或专门的拖动把手开始，菜单内的事件不再经过拖动逻辑。popup 里再加一个「编辑当前网站的规则」按钮，发 `openEditor`（这不是右键菜单入口，不违反「永不做」）。E2E 改成真实点击菜单。
- **置信度**：toggle 被误触发：高；`onMenuEdit` 不触发：中高（和 Chrome 移除节点后 click 的派发目标有关，见 §6）。不管哪种情况，点菜单都**一定会**切换开关。

### N2｜P0｜预览样式只记在 SW 内存，长时间预览后「放弃」撤不掉 = 免保存临时隐藏
- **位置**：`entrypoints/background.ts:17`（`draftCssByTab = new Map`）、`:99-111`；`ui/wizard/WizardApp.vue:332-385`（`applyPreview` 发 `draftCss`）、`clearDraftCss`
- **证据**：每次撤掉预览样式都要用 Map 里记的旧文本去 `removeCSS`。预览阶段用户在读、在滚动，不会给后台发消息，SW 空闲约 30 秒就被回收，Map 跟着清空。之后「放弃」或保存时 `clearDraftCss` 找不到 prev，什么也不删。
- **影响**：被预览隐藏的元素会一直藏到刷新页面为止。点了放弃，页面还是变了样，等于「不保存也能临时隐藏」，违反 design.md「永不做」清单。保存路径上，正式规则和残留的预览样式叠在一起，如果用户在预览里换过方案，保存后看到的效果和规则也不一致。
- **修复建议**：和旧审查 T2 合并处理：预览样式文本存进 `chrome.storage.session`（以 tabId 为键），或者由内容脚本自己保存文本，撤销时把文本一起发过去。向导卸载时（`onBeforeUnmount`）必须 await 撤销成功；失败就提示「请刷新页面」。
- **置信度**：高（SW 生命周期是平台事实；这条路径和旧审查 E1 同构，但旧审查只提了正式样式）。

### N3｜P0｜用户可见文案仍有「伪装 / 泄露」，且已进入商店截图
- **位置**：`core/origin.ts:32,35,38,41`（「浏览器内部页面不支持伪装」等 4 条，显示在 popup `App.vue:9`）；`entrypoints/management/App.vue:12`（「…空白会让 Chrome 显示网址反而泄露。」）；`docs/store-assets/screenshot-3-popup.png`（画面主体就是「浏览器内部页面不支持伪装」）；`screenshot-4-management.png`（能看到「反而泄露」）
- **影响**：审核员第一眼看到的截图就在暗示「隐瞒 / 防泄露」，和「清爽模式 / 专注阅读」的定位矛盾。截图 3 本身也只是一个出错状态，没有展示任何价值。
- **修复建议**：改成「这类页面（浏览器内部页 / 本地文件 / 应用商店）无法使用清爽模式」。管理页提示改成「不能留空：留空时 Chrome 会改为显示网址」。重拍截图 3（展示有规则的站点摘要），重拍截图 4。完整文案对照见 §4。
- **置信度**：高。

### N4｜P1｜编辑面板不监听 storage，持有过期副本，保存时会覆盖别处的修改
- **位置**：`ui/editor/EditorPanel.vue:107-110`（只在 `onMounted` 读一次）、`:112-115`（`persist` 整体写回）
- **证据**：面板打开期间，如果在 popup 或其他标签页切换了开关、体检回写了 `lastHealth`、或在管理页改了标题，面板下一次 `persist` 就会把这些改动整体覆盖回旧值（旧审查 S2/W5 已提到，这里确认）。`props.url` 也是打开那一刻的值，SPA 换页后「当前页面生效的规则」列表就过期了。
- **修复建议**：订阅 `storage.onChanged`，按 `profileKey(origin)` 刷新；写入走 `updateProfile(origin, fn)`（旧审查 T1）。运行时检测到路由变化时，给面板传新的 url（改成响应式 props，而不是在 `createApp` 时一次性传入）。
- **置信度**：高。

### N5｜P1｜「重选元素」先删旧规则（确认旧审查 W1）
- **位置**：`ui/content-runtime.ts:190-197`
- **证据 / 影响**：取消向导、预览阶段 SW 回收（N2）、或者 N1 的误触都会让旧规则永久丢失；删除时也没有撤销入口。
- **修复**：给向导传 `replaceRuleId`，保存成功时在同一次写入里替换旧规则。
- **置信度**：高。

### N6｜P1｜序号牌编号只在创建时写入，取消选中后编号错乱 / 重复
- **位置**：`ui/wizard/WizardApp.vue:254-282`（`renderBadges`；`:270` 的 `tag.textContent = String(i + 1)` 只在 `!box` 分支执行）
- **证据**：依次选 A、B、C，编号是 1、2、3。取消 A 后 B、C 仍显示 2、3；再选 D（索引 2）会显示「3」，和 C 重号。`pick.adjust()`（`pick-controller.ts:67`）用 delete + add 换元素，被换的元素挪到 Set 末尾，编号也跟着乱。进入预览后，幽灵标记的编号按 drafts 重新计算，和选择阶段看到的号对不上。
- **修复**：每次 render 都更新已有 tag 的文字；或者改成声明式渲染（`v-for` + `:style`），不要命令式地维护盒子。
- **置信度**：高。

### N7｜P1｜预览里改任何一项后，其它「彻底移除」项的幽灵标记坍缩为 0×0，再也点不到
- **位置**：`ui/wizard/WizardApp.vue:341`（`const r = d.el.getBoundingClientRect()`）；调用方 `setStrategy`、`removeDraft`
- **证据**：`applyPreview` 每次都会重新读**所有** remove 项的矩形，可此时上一轮预览样式（`display:none !important`）还生效着，`getBoundingClientRect()` 返回全 0。于是幽灵框落在 (0,0)、尺寸为 0，只剩序号圆片露在 (-10,-10)，基本在屏幕外。
- **影响**：只要换过一次方案或移出一项，其余被移除元素的标记就消失，无法再调整，只能「继续选择」重来（而那又会清空所有调整，见 N12）。
- **修复**：进入预览时缓存每项的初始矩形和滚动位置（`baseRect` 存到 draft 上，`markRaw`），之后的重绘只用缓存值。更好的做法是不依赖坐标快照，见 N8。
- **置信度**：高。

### N8｜P1｜幽灵标记用移除前的坐标，盖在重排上来的内容上并拦截点击
- **位置**：`ui/wizard/WizardApp.vue:341-357`；`ui/follow.ts:81-88`
- **证据**：`screenshot-2-wizard.png` 里，1 号虚线框正好框住了上移补位的「© 微信读书」页脚。框是 `pointer-events:auto`，页脚因此点不到，看起来也像是选中了页脚。跟随逻辑只算 `window.scrollX/Y` 的变化：元素如果在内部滚动容器里（微信读书阅读器就是这样）、或者在 sticky/fixed 祖先下，滚动时幽灵框会和实际位置错开。
- **修复**：幽灵标记改成「在被移除元素原来的位置插入一个占位提示」并不现实（不允许动页面 DOM），推荐在工具条里放一个**草稿清单**（编号 + 名称 + 方案下拉），幽灵框只用于提示：`pointer-events:none`、半透明，点击入口放在清单上。或者把幽灵框缩成一个小号码牌，锚定在移除位置的左上角，不覆盖整块区域。
- **置信度**：高（有截图佐证）。

### N9｜P1｜Esc 状态机：预览阶段完全失效；确认框上按 Esc 直接「退出不保存」
- **位置**：`ui/wizard/WizardApp.vue:170-186`（`onEsc`）、`:294+`（`enterPreview` 调了 `pick.stop()`）；`pick-controller.ts:46-51`（`stop` 移除了 keydown 监听）
- **证据**：①进入预览后键盘监听被移除，`onEsc` 里处理 `openIdx` / `saveOpen` 的两个分支永远走不到：弹片、保存框、退出确认在预览阶段都没法用 Esc 关。②选择阶段打开退出确认后，再按 Esc 会走 `confirmExit → emit('done')`，按惯例 Esc 应该等于「取消 / 继续编辑」，这里却变成了确认这个破坏性操作，连按两次 Esc 就丢掉全部选择。③监听在 window 捕获阶段，没检查 `e.isComposing`：以后预览阶段恢复 Esc 时，中文输入法按 Esc 取消候选词会被误判成关闭。
- **修复**：确认框、保存框改用原生 `<dialog>` + `showModal()`（`dialog` Rule 1、`light-dismiss-a-dialog`）：Esc 等于 cancel，焦点圈在框内，`autofocus` 放在「继续编辑」这个安全按钮上。弹片改用 `<dialog popover="auto">`（`dialog` Rule 2）。只有在没有任何浮层时，才由向导级别的 Esc 处理器调用 `requestExit()`，并且检查 `isComposing`。
- **置信度**：高。

### N10｜P1｜勾选「只藏点选的这个」不刷新预览（确认旧审查 W3）
- **位置**：`ui/wizard/WizardApp.vue:73`、`:423-427`
- **补充**：v-model 的 change 监听先于 `@change` 注册，`onlyThis` 的值是对的，只是没调用 `applyPreview()`。
- **置信度**：高。

### N11｜P1｜「移出本次选择」没有从选择集中移除
- **位置**：`ui/wizard/WizardApp.vue:429-437`（只 `drafts.splice`，没动 `pick.selection`）
- **证据**：移出到 0 项时会自动 `backToPick()` → `renderBadges()` 用 `selEls` 重画，被移出的元素全部带着序号牌回来；手动「继续选择」再「预览」时它们也会重新出现。
- **修复**：PickController 增加 `remove(el)` 方法，`removeDraft` 时同步调用。
- **置信度**：高。

### N12｜P1｜「继续选择」清空所有草稿调整（元素名、方案、只藏这个）
- **位置**：`ui/wizard/WizardApp.vue:314-325`（`drafts.value = []`），再次预览时 `enterPreview` 全部重置为 remove
- **影响**：多选、预览、发现漏了一个、回去补选，前面所有调整全部作废。
- **修复**：drafts 用 `Map<Element, Draft>` 保存，回到预览时只给新增元素建草稿。
- **置信度**：高。

### N13｜P1｜「选大一点 / 选小一点」作用于鼠标最后划过的元素，而不是用户想调整的那个
- **位置**：`pick-controller.ts:58-71`（基于 `hoverEl`）；工具条固定在页面顶部居中（`WizardApp.vue:481-495`）
- **证据**：鼠标从目标元素移到顶部工具条的路上，会经过其它页面元素，`pointermove` 随之更新 `hoverEl`。点到按钮时，`hoverEl` 已经是工具条正下方的某个元素了。
- **修复**：调整对象改成「最后一个选中的元素」（同时显示是哪一个），或者在当前选中元素的序号牌旁边放一组 ↑/↓ 小按钮。
- **置信度**：高。

### N14｜P1｜滚轮滚动 / 触屏点击后选中的是旧的悬停元素
- **位置**：`pick-controller.ts:95`（`const target = this.hoverEl ?? this.elementUnderPoint(...)`）
- **证据**：滚轮滚动不会触发 `pointermove`，`hoverEl` 还是滚动前的元素；触屏没有悬停，`hoverEl` 是上一次点的位置。高亮框也会继续跟着旧元素跑。
- **修复**：`pointerdown` 一律用 `elementUnderPoint(e.clientX, e.clientY)`；监听 `scroll`（capture）并重新命中测试。
- **置信度**：高。

### N15｜P1｜工具条盖住页面顶部区域，恰好是最常要藏的「顶部导航栏」
- **位置**：`WizardApp.vue:481-495`；截图 2 中工具条压在站点导航上
- **影响**：工具条下面的元素（`pointer-events:auto`）没法悬停或点选。
- **修复**：工具条可拖动（`drag` 指南：专门的拖动把手、`setPointerCapture`、键盘方向键移动），或者鼠标靠近时自动躲到底部；也可以默认放在底部居中。
- **置信度**：高。

### N16｜P1｜拖动：没有 pointer capture / pointercancel，触屏残留监听，之后点页面任意处都会切换开关
- **位置**：`FloatingToggle.vue:82-114`（只监听 window 上的 `pointermove/pointerup`，没有 `touch-action:none`、`pointercancel`、`setPointerCapture`）
- **证据**：触屏拖动时浏览器开始平移页面，派发 `pointercancel` 而不是 `pointerup`，window 上的 `pointerup` 监听一直留着。之后用户在页面**任何位置**点击（比如点一个链接），`onUp` 都会执行并 `emit('toggle')`。鼠标在窗口外松开时同理。触屏长按触发 `contextmenu` 打开菜单，松手时又会 toggle。
- **修复**：按 `drag` 指南：拖动把手设 `touch-action:none`；`pointerdown` 时 `setPointerCapture(e.pointerId)`，监听挂在把手上；`lostpointercapture` / `pointercancel` 时清理状态。
- **置信度**：高（触屏场景）；鼠标场景：中。

### N17｜P1｜按钮位置存的是视口坐标，窗口变小后跑出屏幕，且唯一的归位入口在按钮自己身上
- **位置**：`FloatingToggle.vue:26-35`（直接用存下来的 left/top）、`:99-100`（只在拖动时按写死的 40×28 夹紧）；`content-runtime.ts:93-98`
- **影响**：外接显示器拔掉、窗口缩小之后，按钮在屏幕外，「按钮归位」也随之看不见（而且 N1 本来就让它点不了）。
- **修复**：存成「贴哪条边 + 偏移比例」，挂载时和 `resize` 时都按实际 `getBoundingClientRect()` 夹紧；popup 里放一个「悬浮按钮归位」。
- **置信度**：高。

### N18｜P1｜菜单固定向下弹且向右延伸，出屏；没有点外面关闭、没有 Esc（确认并细化旧审查 U2）
- **位置**：`FloatingToggle.vue:58-67`（`top:'120%', left:0, minWidth:96px`）
- **细化**：按钮默认在右下角（right:16px，宽约 36px），菜单从按钮左边缘向右延伸 96px，**下方和右方都会出屏**。
- **修复**：Popover API + `showPopover({source})` 隐式锚点；`position-area` 加 `position-try-fallbacks: flip-block, flip-inline`，用 `@supports` 门控并配脚本兜底（`viewport-aware-dropdowns`、`menu`）。注意宿主是 `pointer-events:none`，会被继承，popover 上要显式写 `pointer-events:auto`。
- **置信度**：高。

### N19｜P1｜管理页：`storage.onChanged` 一触发就整页重载，正在输入的标题被冲掉
- **位置**：`entrypoints/management/App.vue:94-103`（任何 local 变化都会 `reload()`）、`:31`（`v-model` 直接改 profile 对象，`@change` 时才保存）
- **证据**：用户在标题框里打字但还没失焦时，任何一个标签页的体检回写、SPA 换页触发的 `applyAll → runHealthCheck`、或者其它标签页切换开关，都会让 `profiles.value` 被整体替换，输入框回到旧值。
- **修复**：编辑状态和存储状态分开（输入框绑本地 draft，只在 `change` 时提交）；`reload` 时跳过当前获得焦点的字段，或者按 key 合并、只替换有变化的站点；体检字段的变化不触发重载。
- **置信度**：高。

### N20｜P1｜「整体替换」导入没有任何确认，一选文件就把现有配置全部删掉
- **位置**：`management/App.vue:53-56,172-184`
- **影响**：违反「反向操作完备」和高风险操作要二次确认的原则；而且单选框排在导入按钮**后面**，操作顺序也反了。
- **修复**：模式选择放到「导入」按钮之前；选择替换时弹 `<dialog>` 确认，列出将删除的站点数和规则数。
- **置信度**：高。

### N21｜P2｜幽灵标记 setTimeout 竞态：已经删掉的盒子被重新登记，rAF 空转到向导结束
- **位置**：`WizardApp.vue:357`
- **证据**：`setTimeout(0)` 执行之前如果又调用了 `applyPreview` 或 `backToPick`（例如连点方案按钮、自动化测试），`clearMarkers` 已经 `drop(box)` 了，回调还会 `trackGhost` 一个已经脱离 DOM 的 box。follower 的 Map 不为空，rAF 循环一直空转到卸载。`baseScroll` 记录的是回调执行那一刻的滚动位置，而不是取矩形的那一刻。
- **修复**：不用 setTimeout，同步登记并缓存矩形（顺带解决 N7）；或者在回调里检查 `box.isConnected`。
- **置信度**：中（概率低，但确实存在）。

### N22｜P2｜`doSave` 缺少容错和先后顺序保证
- **位置**：`WizardApp.vue:450-476`
- **证据**：①`await clearDraftCss()`：函数返回 void，await 什么也不等，预览样式撤销和正式样式注入之间可能闪一下，也可能顺序反过来。②`(await storage.getProfile(origin))!`：保存期间站点刚好在管理页被清空，这里就会抛异常，向导卡住，没有任何提示。③`putProfile` 失败（例如超大图标导致配额不足）同样没有反馈。④新站点保存时直接改 `switchState`，和并发的写入会互相覆盖（S2）。
- **修复**：`clearDraftCss` 返回 Promise；配置为空时提示「该站点配置已被清空」并退出；保存失败时用 toast 告知。
- **置信度**：高。

### N23｜P2｜内容脚本的 onMessage 从不回应，popup 判断不了是否真的打开了向导
- **位置**：`content-runtime.ts:333-336`；`popup/App.vue:84-101`
- **证据**：监听器既不调用 `sendResponse`，也不返回 Promise；`openWizard` 遇到 `!profile || wizardActive` 时静默 return。popup 只能靠「没抛异常」来猜结果（会不会抛，取决于 Chrome 对「无响应」的处理，见 §6），可能白白重试 10 次（2 秒），也可能以为成功了实际却什么都没发生。
- **修复**：返回 `Promise<{ok, reason}>`，popup 按结果提示。配合旧审查 W6 去掉 sleep 重试。
- **置信度**：中。

### N24｜P2｜popup：授权被拒、正在处理中都没有反馈；按钮能重复点
- **位置**：`popup/App.vue:76-77`（`if (!granted) return;`）、`:69-104`（整个过程最长约 2 秒，按钮没有 disabled，也没有加载状态）
- **修复**：被拒时显示「需要允许访问此网站才能开启清爽模式」；处理期间 `aria-busy`、按钮禁用并显示「正在打开…」。
- **置信度**：高。

### N25｜P2｜方案 C 遮罩：颜色写死浅灰；点击会穿透；盒子在 light DOM 里，会被页面 CSS 影响
- **位置**：`content-runtime.ts:106-118,145-152`（`#f4f4f4`、宿主 `pointerEvents:none` 被子元素继承）；预览用 `WizardApp.vue:377` 的 `#f2f2f2`（和运行时不一致）
- **证据 / 影响**：①深色页面上（例如微信读书的深色阅读模式）一块 `#f4f4f4` 和背景对比 15:1，比原元素还显眼。②`pointer-events:none` 被继承，遮罩下的链接、广告仍然能点，悬停效果照常触发。③遮罩盒子是普通 div，没有 shadow root：页面的 `div{…!important}`、`*{filter/transition}` 都会作用到它上面，页面脚本也能直接找到。④预览色和保存后的颜色不同，违背「预览即所得」。
- **修复**：颜色取被遮元素最近一个不透明祖先的 `getComputedStyle().backgroundColor`；盒子 `pointer-events:auto`（等同于方案 B 的不可点）；放进 shadow root；预览和运行时共用一个常量。
- **置信度**：高。

### N26｜P2｜悬浮按钮每次 storage 变化都卸载重建（确认 C4），拖动中途会丢状态
- **位置**：`content-runtime.ts:46-72`
- **补充**：拖动中途其它标签页写了体检结果，组件就被卸载；之后的 `emit` 在已卸载实例上是空操作，位置不会保存，window 监听也残留着（叠加 N16）。
- **置信度**：中高。

### N27｜P2｜输入框里的按键冒泡到页面，触发站点快捷键
- **位置**：向导弹片里的 `<input>`（`WizardApp.vue:54`）、编辑面板的 `<textarea>`（`EditorPanel.vue:61`）
- **证据**：shadow DOM 里的 keydown/keypress/keyup 是 composed 事件，会冒泡到 document。阅读类站点通常把空格、方向键、j/k 绑成翻页，用户输入元素名时页面可能跟着翻页或跳转。
- **修复**：在 shadow 宿主上拦截这些事件并 `stopPropagation`，或者用 WXT `createShadowRootUi({ isolateEvents: true })`。
- **置信度**：中（取决于站点，见 §6）。

### N28｜P2｜其它小问题
- `backToPick` 往 `document.documentElement.style.cursor` 写值（`WizardApp.vue:316`），卸载时置成 `''`，会覆盖页面自己设的行内 cursor。拾取层已经有 `crosshair` 了，这行没必要。
- 「选小一点」直接取 `firstElementChild`（`wizard-logic.ts:24-25`），可能选到 `<script>`、`<style>`、0 尺寸或隐藏的节点。建议跳过不可见的节点，取第一个可见的子元素。
- `ariaLabelledby` 只支持单个 id（`naming.ts:54-60`），`aria-labelledby="a b"` 会失败。
- 拾取层盖住整个视口，页面**内部**滚动容器在选择阶段滚不动（滚轮落在拾取层上，只会串联到文档滚动）。建议把 `wheel` 事件转发给 `elementUnderPoint` 所在的可滚动祖先。
- 拾取只能用指针，键盘用户无法选元素（WCAG 2.1.1）。v1 可以接受，但需要在 README 的局限里写明。
- 宿主 id `pagemask-*-host` 是固定值，页面脚本能借此探测到扩展。考虑到定位，这是隐私层面的小问题，可以用随机后缀加自定义元素名。
- 管理页导出（`management/App.vue:161-170`）：detached `<a>` 调 `click()` 在 Chrome 里能下载，立刻 `revokeObjectURL` 一般也没问题，**风险被高估了**。稳妥起见可以 `setTimeout(() => URL.revokeObjectURL(url), 0)`，或者改用 `showSaveFilePicker`（扩展页面里可用）。
- 管理页标题框只在 `change` 时保存，打完字直接关掉标签页会丢；全局默认标题清空后，存的是「新建标签页」，但输入框里还显示空白（`:121-124`），两者不一致。
- 上传图标后没有把 `input.value` 清空，再选同一个文件不会触发 change；不限大小（S5）。
- 导入失败时直接显示 `err.message`（例如 JSON.parse 的英文报错），非技术用户看不懂。建议统一成「文件内容不是有效的 PageMask 配置」。
- onboarding 的 `window.close()`（`onboarding/App.vue:46-48`）：页面是 `tabs.create` 打开的、只有一条历史记录，Chrome 允许脚本关闭，**风险被高估了**。更稳的做法是 `chrome.tabs.getCurrent()` + `tabs.remove`。
- popup `manage()` 里 `tabs.create` 没有 await 就 `window.close()`，Chrome 实际可行，风险低，建议 await。
- popup 的 storage 监听没有移除：popup 关闭时整个文档一起销毁，**不算泄漏**（refute）。

---

## 2. 无障碍

| # | 级别 | 位置 | 问题 | 修复（指南） | 置信度 |
|---|---|---|---|---|---|
| N29 | P1 | `FloatingToggle.vue:2-7` | 胶囊是 `<div>`：无法聚焦，没有 role 和名称，状态只靠 ●/○ 和 `title` 表达；菜单项也是 div，键盘无法操作（确认 U1）。另外 `pointerdown.prevent` 也阻止了聚焦 | `<button aria-pressed>` 或 `role="switch" aria-checked`，可见文字「清爽」/「原样」；菜单用 popover + `<button>`（`menu`、`html`） | 高 |
| N30 | P1 | `WizardApp.vue:38-108`、`management/App.vue:62-76` | 确认框、保存框是 div 遮罩：没有 role / 名称，不抢焦点，Tab 能跑到页面后面，焦点不会还给触发按钮（确认 U3） | `<dialog>`+`showModal()`、`aria-labelledby`、破坏性操作把 `autofocus` 放在安全按钮上（`dialog`、`light-dismiss-a-dialog`）。在 shadow 里同样能进 top layer，还能顺带解决和页面 z-index 抢层的问题 | 高 |
| N31 | P1 | `EditorPanel.vue:2-5` | 编辑面板没有 `role`/名称；打开时焦点不移进面板；没有 Esc；关闭按钮只有「✕」，读屏会念成「乘号」 | `<dialog popover="manual" aria-labelledby>`（`dialog` Rule 2：页面仍可操作的面板）；关闭按钮加 `aria-label="关闭编辑面板"`；打开时把焦点放到标题或第一张卡片 | 高 |
| N32 | P1 | `WizardApp.vue:35`、`management/App.vue:58` | 防呆提示、导入结果没有 live region，读屏用户收不到 | toast 用 `role="status"`（或者 `popover="manual"` 容器里放一个 `aria-live="polite"` 区域，`persistent-toast-notifications`）；导入结果用 `role="status"` | 高 |
| N33 | P2 | `WizardApp.vue:53,57,71,88`；`EditorPanel.vue:22,37,61`；`management/App.vue:10,30,34,37` | `<label>` 没有和控件关联（没有 for 也没有包住控件）；「收起方案 / 生效范围」是按钮组，却没用 `fieldset/legend` 或 `role="group" aria-labelledby`；文件输入框的可访问名称只有「选择文件」（确认 U5） | 用 `for/id` 或包裹关联；分段按钮加 `aria-pressed`，或者改成原生 radio 组（`accessibility`、`html`） | 高 |
| N34 | P2 | `WizardApp.vue:90-95`、`management/App.vue:55-56` | radio 没有 `name`：v-model 能保证选中值一致，但浏览器不把它们当成一组，方向键不能切换，每个 radio 各占一个 Tab 停留点，读屏也不报「第 x 项，共 y 项」 | 加 `name`，外层用 `fieldset`+`legend` | 高 |
| N35 | P2 | shadow 内全部 UI | 没有 `lang`：在英文页面上，读屏会用英文语音念中文界面 | shadow 内根容器加 `lang="zh-CN"`（`html`） | 高 |
| N36 | P2 | `popup/App.vue:3-5,14-16` | 没有 `<h1>`/`<main>`；红点 ● 会被读成「黑色圆点」；开关按钮的文字是状态而不是动作，读屏只念「清爽中，按钮」（确认 U4） | `role="switch" aria-checked`，或者 `<input type=checkbox switch>`（Chrome 不支持 `switch` 属性，需要按指南条件加载 polyfill，`switch`）；装饰性的 ● 加 `aria-hidden="true"`，旁边放可读文字 | 高 |
| N37 | P2 | `onboarding/App.vue:7-34` | 步骤状态只靠透明度和颜色表达；圆点 `<i>` 没有语义；「下一步」只改高亮，3 步内容其实一直全部可见 | 当前步骤加 `aria-current="step"`，圆点 `aria-hidden`；要么做成真正的分步（一次只显示一步，配图片），要么去掉翻页按钮 | 高 |
| N38 | P2 | 全部 | focus-visible：扩展页面和 shadow 里的按钮都没有去掉 outline，默认焦点环还在，这一点**合格**；但胶囊、菜单、标记框本来就没法获得焦点（N29）。另外动效只有 onboarding 一个 0.2s 的 opacity 过渡，目前没有违反 reduced-motion；以后加动效时要包在 `@media (prefers-reduced-motion: no-preference)` 里 | — | 高 |
| N39 | P2 | 管理页、popup | `title` 提示（失效规则清单）键盘和触屏都看不到 | 改成可展开的文字或 `<details>`，并附上 design.md 要求的「去处理」按钮（目前**缺失**，设计偏差） | 高 |

### 对比度实测（WCAG AA：正文 4.5:1、大字 / 图标 / 控件边界 3:1）

| 颜色组合（位置） | 比值 | 结论 |
|---|---|---|
| `#fff` on `#3575e0`（所有主按钮、选中的分段按钮、popup 开关「清爽中」） | **4.40** | ✗ 12–13px 文字不达标。改用 `#2563eb`（5.17）或 `#1d5fd1`（5.82） |
| `#3575e0` on `#fff`（管理页「清爽中」状态文字） | 4.40 | ✗ |
| `#999` on `#fff`（编辑面板说明、范围提示、summary；管理页 `.hint`） | **2.85** | ✗ |
| `#999` on `#f6f7f9`（onboarding `.tip`） | 2.66 | ✗ |
| `#888` on `#fff`（popup `.meta`、管理页 `.state` / `.empty`、关闭 ✕） | 3.54 | ✗（文字） |
| `#777` on `#fff`（编辑面板空状态） / `#777` on `#f6f7f9`（管理页、onboarding `.sub`） | 4.48 / 4.18 | ✗（差一点） |
| `#e5484d` on `#fff`（「● 可能失效」11–12px） | 3.91 | ✗ 改成 `#dc2626`（4.83）或 `#b91c1c`（6.47） |
| `#fff` on `#e07b2d`（序号牌 12px 粗体）；`#e07b2d` 描边 vs 白页 | 2.98 / 2.98 | ✗ 改成 `#c2410c`（5.18） |
| `#fff` on `#888`（幽灵标记序号） | 3.54 | ✗ |
| `#fff` on `#3aa655`（onboarding 已完成步骤） | 3.10 | ✗ 改成 `#15803d`（5.02） |
| onboarding 未激活步骤：正文 `#555` × opacity .55 | **2.57** | ✗（标题 3.67 也 ✗） |
| `#e8e8e8` on 胶囊 `rgba(90,90,90,.55)`：白底页面 | **2.03** | ✗ |
| 同上：黑底页面 / `#808080` 灰页 / `#3575e0` 蓝页 | 10.54 / 4.34 / 4.72 | 黑底 ✓；灰页、蓝页 ✗ |
| 胶囊本体 vs 页面背景（控件边界 3:1）：白底 / 黑底 / 灰页 | 2.49 / 1.63 / 1.35 | ✗ 全部不达标 |
| `#aaa` on 工具条 `rgba(28,28,30,.95)` | 6.39 | ✓（**这项担心不成立**，只是 11px 字太小） |
| 工具条按钮 `#3a3a3c` vs 工具条底色；按钮边框 `#555` | 1.31 / 1.99 | ✗ 按钮边界几乎看不见 |
| 输入框边框 `#ccc` vs `#fff`；popup 关态开关边框 `#d0d0d0` | 1.61 / 1.54 | ✗（1.4.11 非文字对比度） |
| `#fff` on `#d33`（确认清空）；`#c33` on `#fff`（危险按钮文字） | 4.57 / 5.14 | ✓ |
| 遮罩 `#f4f4f4` vs 白页 / 深色页 | 1.10 / 15.16 | 白页上过于隐蔽（符合预期），深色页上非常刺眼（N25） |

胶囊「低调不显眼」是设计诉求，和 1.4.11 有冲突。建议的折中：静止时降低存在感，但按钮本体保证 3:1（用 `#4b5563` 实底 + 1px 白描边，深浅底上都能看清），配可读文字；鼠标悬停或获得焦点时完全不透明。

---

## 3. Shadow DOM 隔离与页内性能

### N40｜P1｜宿主是普通 `<div>`，没有任何保护，页面 CSS 能直接干掉整套 UI（细化旧审查 C3）
- **位置**：`content-runtime.ts:51-56`（悬浮按钮宿主**连行内样式都没有**）、`:106-118`、`:170-181`、`:216-227`
- **证据**：宿主作为 `<html>` 的直接子 `div` 挂在 light DOM 里，会被这些规则命中：`html > div{display:none!important}`、`body ~ *{display:none}`、`div:empty{display:none}`（宿主只有 shadow、没有 light 子节点，`:empty` **能匹配**）、`*{filter/transform/transition}`、`div{position:relative!important}`。行内样式没写 `!important`，打不过作者样式表里的 `!important`。宿主上的 `transform/filter` 还会让里面的 `position:fixed` 改成相对宿主定位。
- **继承属性泄漏**：`line-height`（工具条没设）、`letter-spacing`、`text-transform`、`font-weight/style`、`word-break`、`direction`、`writing-mode`、`visibility`、`cursor`、`text-shadow`、`-webkit-text-fill-color` 都会从 `<html>` 继承进 shadow（`styling-web-components`：继承属性会穿过边界）。另外 `<button>/<input>` 不继承字体，向导、编辑面板里的按钮用的是平台默认字体，和周围文字不一致（同一指南「表单控件不继承排版」）。
- **修复（按优先级）**：①宿主改成自定义元素名（例如 `<pagemask-ui>`），页面的 `div` 选择器就匹配不到；②宿主样式走项目已有的 `insertCSS origin:'USER'` 通道，注入 `pagemask-ui{all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;display:block!important}`（用户层 `!important` 优先于一切作者样式）；③shadow 内根容器写 `all:initial; font: 13px/1.5 system-ui, "PingFang SC", sans-serif; color:…`，按钮写 `font:inherit`；④或者直接采用 WXT `createShadowRootUi`（自定义元素宿主、内部样式重置、`isolateEvents`、卸载清理，旧审查 T4 已推荐）。注意 `:host{all:initial}` 的优先级**低于**页面上命中宿主的规则，所以只能管 shadow 内部，宿主本身仍然要靠 ① 或 ②。
- **置信度**：高（机制）；具体哪些站点会命中：需要实测。

### N41｜P2｜样式全部写成内联对象，三处重复且不一致
- **证据**：主色 `#3575e0` 在 5 个文件里硬编码；圆角混用 6/8/10/12/14/999；字号有 11/12/13/14/15/20/22 共 7 档；浅灰 `#f4f4f4`/`#f2f2f2`/`#f5f5f5`/`#fafafa`/`#f6f7f9` 混用；危险色 `#8f2d2d`/`#c33`/`#d33`/`#e5484d` 四种。
- **修复**：一份 tokens（CSS 自定义属性），扩展页面用 `:root`，shadow 用 `adoptedStyleSheets` 共享一份 `CSSStyleSheet`（`shadow-dom`「把样式表加载进 shadow root」）。
- **置信度**：高。

### N42｜P2｜性能
- 内容脚本 119 KB（`.output/chrome-mv3/content-scripts/content.js`），包含 Vue 运行时和选择器库，每个已配置站点的每个页面都要加载。常驻的只有悬浮按钮，向导、编辑面板很少用。可以把胶囊改成原生 Web Component（约 2 KB），Vue 只在打开向导或面板时动态加载。动态加载需要把 chunk 声明成 `web_accessible_resources`（只对已授权站点开放，并会带来 N28 提到的可探测性），这是取舍，不强制。
- 每个 shadow root 一个 Vue app（最多 3 个），本身开销可以接受；问题在频繁卸载重建（N26）。
- `ElementFollower` 每帧对所有被跟随元素调用 `getBoundingClientRect`（确认 C6），向导的 hoverBox 也让循环一直跑。改成 `scroll`(capture) / `resize` / `ResizeObserver` / `IntersectionObserver` 触发、跑几帧就停。
- 每秒轮询路由（确认 C2）。
- 被跟踪的 DOM 元素建议用 `markRaw` 或 `shallowRef`，避免 Vue 对外层数组 / 对象做不必要的深层追踪（不是 bug，见 §5）。

---

## 4. 中文文案审查（清晰度 · 术语一致性 · 商店风险）

**商店风险**（P0 项已在 N3 列出）：

| 位置 | 现文案 | 问题 | 建议 |
|---|---|---|---|
| `core/origin.ts:32-41`（popup 显示） | 浏览器内部页面不支持伪装 / 本地文件页面不支持伪装 / Chrome 应用商店页面不支持伪装 / 此类页面不支持伪装 | 「伪装」，P0，已进截图 3 | 「浏览器内部页面无法使用清爽模式」等；兜底「这个页面无法使用清爽模式」 |
| `management/App.vue:12` | 不能为空白——空白会让 Chrome 显示网址反而泄露。 | 「泄露」，P0，已进截图 4 | 「不能留空：留空时 Chrome 会改为显示网址。」 |
| `onboarding/App.vue:3` | 欢迎使用 PageMask 🎭 | 🎭 面具或戏剧面具，暗示伪装 | 去掉，或换成 ✨ / 📖 |
| `onboarding/App.vue:25` | 标签页标题和图标也会换成低调的样子 | 「低调」暗示隐藏行迹 | 「标签页也可以换成更简洁的标题和图标（可在管理页设置）」 |
| `onboarding/App.vue:11` | 比如微信读书、得到、极客时间 | 在界面里点名第三方品牌，有商标观感问题（和 A3 同类） | 「比如你常用的阅读、学习类网站」 |
| `WizardApp.vue:14` | 遮罩类问题只在滚动时暴露 | 「暴露」带负面联想，而且说法偏技术 | 「滚动一下页面，确认遮罩能跟住元素」 |
| `management/App.vue:4,30,34` | 自定义各站点的标签页标题/图标 | 功能本身没问题，但需要一个正面的说法 | 分区标题「标签页显示」，说明「让标签栏更简洁，减少分心」 |

**清晰度 / 一致性**：

| 位置 | 现文案 | 问题 | 建议 |
|---|---|---|---|
| `core/naming.ts:51` | `div 元素` / `img 元素` | 非技术用户看不懂；多条规则同名，在编辑面板里没法区分 | 标签映射成中文（img→图片、a→链接、ul/ol→列表、section→区块、iframe→嵌入内容、svg→图标、input→输入框）；再加上位置描述（design.md 要求的「顶部 / 右侧 / 底部 + 大小」）和子树文字前几个字 |
| `core/health.ts:31` + `core/scope.ts:27-31` | 「…最近在整站没找到目标」「…最近在仅 xx 开头的页面没找到」 | 句子不通顺 | `scopeText` 为整站时用「本网站」；其余情况用「xx 这类页面」 |
| `core/origin.ts:59-61` | `weread.qq.com 上 /web/reader/ 开头的页面` | 路径对非技术用户偏技术；design.md 要求「人话 + 网址示例」，现在没有示例 | 「阅读页这一类（例如 weread.qq.com/web/reader/…）」；至少在界面上附一个当前网址作例子 |
| 向导 / 编辑 / scope.ts | 「仅限：」「排除：」/「仅这类页面」「排除这类页面」/「仅 X」「除 X 外」 | 同一个概念有三种说法 | 统一成「整个网站 / 只在这类页面 / 除了这类页面」 |
| popup `:24`、编辑面板 `:72`、工具条 `:8` | 「＋ 添加要去掉的元素」「＋ 添加元素」「点选要藏起来的东西」 | 三种叫法 | 统一用「＋ 收起更多内容」；工具条写「点选要收起的内容」 |
| 菜单 `FloatingToggle.vue:5`、面板标题 | 编辑规则 | design.md 写的是「编辑伪装」，用户层改成「规则」也行，但「规则」偏技术 | 「调整收起的内容」 |
| popup / 管理页 | 清爽中 / 原样；切回原样 / 开启清爽 | 状态和动作的说法混在一起 | 开关标签「清爽模式」+ 开 / 关；动作按钮「关闭清爽模式 / 开启清爽模式」 |
| `management/App.vue:36` | 未设置（中性默认） | 「中性默认」意思不明 | 「未设置（显示浏览器默认图标）」 |
| `management/App.vue:50` | 导入默认合并（同源规则并集） | 「同源」「并集」是行话 | 「合并：同一网站的规则会合在一起；整体替换：先删掉现有全部配置」 |
| `WizardApp.vue:11` | 悬停高亮 → 点击选中（可连选，再点取消）；选到内层文字时用下方按钮调整；Esc 退出 | 一行塞了 4 件事，11px | 拆成两行，次要说明折叠起来；「Esc 退出」和实际行为不一致（预览阶段无效，N9） |
| `WizardApp.vue:28` / `:24` | 放弃 / 取消 | 同一个动作两个词 | 统一用「退出」 |
| `EditorPanel.vue:60` | 高级：选择器原文 | 在高级区里可以接受 | 加一句提示「每行一个，保存前会在当前页面检查能否找到元素」 |
| GLOSSARY.md | 只有内部术语（伪装态 / 原样态 / 伪装标题…） | 用户层改叫「清爽模式」以后，GLOSSARY 没有记录对外的叫法，各处只能靠自己发挥 | 每个术语加一个「界面用词」字段：伪装→清爽模式；伪装态→清爽模式开启；原样态→原样 / 清爽模式关闭；伪装标题→标签页标题；隐藏规则→收起项（界面）。GLOSSARY 里「老板键」「上班期间」之类的描述也会随仓库公开，建议一起去掉 |

---

## 5. 对已知问题（旧审查 REVIEW-2026-10-27）的确认 / 修正

- **确认**：C1、C2、C3（并细化成 N40：悬浮按钮宿主连行内样式都没有；`:empty` 能匹配；`:host{all:initial}` 不足以保护宿主）、C4、C6、W1、W3、W4（`EditorPanel.vue:144` 把多行文本整体拿去 `querySelectorAll`）、W5、W6、U1（升级：比「不可聚焦」更严重，菜单本身用不了，N1）、U2（细化：还会向右出屏）、U3、U4、U5、U6、U7（`popup/App.vue:41` 在 tab 没有 url 时 reason 为 `''`）。
- **扩展**：E1 同样作用于**预览样式**（N2），而且触发概率更高。
- **不成立 / 被高估**：
  - 「Vue 深层响应式把 DOM Element 包成代理，导致 `selEls.value.includes(el)` 和 Map 判等失败」：**不成立**。Vue 3 的 `reactive` 只代理 Object/Array/Map/Set/WeakMap/WeakSet（`getTargetType` 遇到 `HTMLDivElement` 之类返回 INVALID），从响应式数组或对象里取出的 Element 就是原始对象；数组的 `includes` 还专门做了 raw 判等处理。`badgeBoxes` 是普通 Map，不是响应式的。结论：没有功能 bug，只是建议用 `markRaw` / `shallowRef` 省掉不必要的追踪。
  - 「popup 监听器泄漏」：不成立（popup 关闭时整个文档一起销毁）。
  - 「导出 a 未挂载 + 立即 revoke」「onboarding window.close」：Chrome 下基本可行，属于 P2 防御性改进，不是 bug。
  - 「工具条 `#aaa` 对比度不足」：6.39:1，达标；问题在 11px 字太小。

---

## 6. 无法在本次只读审查中验证的项

1. Chrome 在 `pointerdown` 目标节点被删除后，`click` 派发给哪个节点（决定 N1 里 `onMenuEdit` 是否偶尔还能触发；toggle 被误触发是确定的）。
2. MV3 promise 形式的 `tabs.sendMessage`，在对方监听器不回应时是 reject 还是 resolve(undefined)（决定 N23 popup 重试的实际表现）。
3. 在 macOS 上从 popup 调 `permissions.request` 时，popup 是否会因为权限框弹出而失焦关闭，导致后续代码不执行。
4. 微信读书、得到、极客时间、墨问这些站点是否有命中 `html>div`、`div:empty` 或全局 `*` 规则的 CSS（N40），以及是否给按键绑了快捷键（N27）。
5. SW 实际被回收的时间点，以及预览期间有没有别的事件让它保持存活（N2 的触发概率）。
6. WCAG 合规的最终结论需要用读屏软件（VoiceOver / NVDA）和键盘做人工测试，并请专家复核；上面的对比度只是公式算出来的。

---

## 7. 视觉设计质量总结与方向

**现状**：截图 1 里，胶囊在白底页面上就是一个看不清含义的灰色小块，没有任何文字。截图 2 的工具条是 iOS 风格的深色玻璃，和扩展页面的浅色卡片风格不一致；按钮边界几乎看不见，11px 的说明文字很难读。popup 是 280px 的白卡片，信息层级弱，而且截图 3 只展示了一个出错状态。管理页的原生「选择文件」控件很突兀，单选框和按钮挤在同一行。宣传图里的图标、商店图标、界面主色三者不统一（A2）。整体看是「能用的工程原型」，还没有形成设计系统。

**建议方向：「安静的纸面」**：中性暖灰 + 一个克制的蓝，浅色和深色两套都支持（`dark-mode`：`color-scheme: light dark` + `light-dark()`），页内 UI 跟随系统明暗。

- **色板（tokens）**
  - `--pm-accent: light-dark(#2563eb, #93b4ff)`（白字在 #2563eb 上 5.17:1；#93b4ff 在深底 #1f2329 上 7.68:1）；悬停用 `#1d4ed8`
  - `--pm-fg: light-dark(#1f2329, #e5e7eb)`；`--pm-fg-muted: light-dark(#6b7280, #9aa0a6)`（白底 4.83、#f6f7f9 底 4.51、深底 5.98）
  - `--pm-bg: light-dark(#ffffff, #1f2329)`；`--pm-bg-subtle: light-dark(#f6f7f9, #2a2e35)`；`--pm-border: light-dark(#d1d5db, #3f444c)`；输入框和控件边界用 `#8a8f98`（3.25:1，满足 1.4.11）
  - 危险 `#b91c1c`（6.47）；警告 / 失效 `#c2410c`（序号牌也用它，5.18）；成功 `#15803d`（5.02）
  - 页内浮层统一用 `--pm-bg` 实底卡片 + 阴影 `0 8px 24px rgb(0 0 0 / .12), 0 0 0 1px rgb(0 0 0 / .06)`，不再混用深色玻璃
  - 加上 `@media (forced-colors: active)` 兜底（`color`）：边框改用 `CanvasText`，选中态改用 `Highlight`
- **字号阶梯**（`system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`，行高 1.5）：12（辅助说明，最小值，**不再用 11px**）/ 13（正文、控件）/ 15（卡片标题，600）/ 20（页面标题，600）。数字用 `font-variant-numeric: tabular-nums`。
- **间距**：4 的倍数：4 / 8 / 12 / 16 / 24 / 32。卡片内边距 16，组件间距 12，页面边距 24。
- **圆角**：控件 8，卡片 / 浮层 12，胶囊 999。不再出现 6 / 10 / 14。
- **组件风格**
  - **悬浮按钮**：实底药丸 `#4b5563`（白字 7.56:1）+ 1px `rgb(255 255 255 / .6)` 描边，深浅页面上都能看清；左边一个 12px 图标（窗口 + 折叠条，和新商店图标统一，旧审查 A2 方案 A），右边短文字「清爽」/「原样」；旁边一个独立的「⋯」菜单按钮。静止时 `opacity:.72`，`:hover` / `:focus-visible` 时变成 1。菜单用 popover，锚定在按钮上，碰到边缘自动翻转。
  - **向导**：底部居中的浅色浮动工具条（可拖动、可折叠），左侧是步骤指示「① 点选 → ② 预览 → ③ 保存」，中间是「已选 N 项」清单入口，右侧是主要按钮。序号牌统一用 `#c2410c`，选中框 2px 实线，悬停框用 accent 色 2px 虚线并带一个元素名小标签（补上 design.md「轮廓 + 简要说明」）。幽灵标记缩成角标，不再盖住内容区域。
  - **对话框**：原生 `<dialog>`，`::backdrop { background: rgb(0 0 0 / .32) }`，标题 15/600，按钮右对齐，破坏性操作的主按钮用危险色，`autofocus` 放在「取消」上。
  - **开关**：popup 和管理页都用 `role="switch"` 的按钮，或者 checkbox + 条件加载 polyfill（`switch`），旁边写清楚「清爽模式」。
  - **文件选择**：隐藏原生 input，用 `<label for>` 包成次要按钮；上传后显示 20px 预览和文件名。
  - **popup**：顶部是站点名 + 开关一行；中间是「N 项已收起 · M 项可能失效（去处理）」；底部主按钮「收起更多内容」+ 次要按钮「调整收起的内容」「管理全部网站」。宽 320，间距 12。
  - **onboarding**：改成三张真实截图配说明，加一步「把 PageMask 固定到工具栏」（新装扩展默认藏在拼图菜单里，现在第 2 步「点右上角图标」对新用户其实找不到，这是 P1 级别的引导缺口），完成后跳到一个示例说明页，而不是直接关掉。
- **商店素材**：截图统一用这套 tokens 重拍。首图做成「之前 / 之后」左右对比 + 一句文案（「点一下，收起页面上的干扰」）；popup 截图展示正常状态，不要用出错状态。
