# E2E 测试说明（#31）

## 怎么跑

```bash
npm run test:e2e            # = wxt build && node tests/e2e/run-e2e.mjs，约 45～60 秒（含 30 秒 SW 空闲等待）
```

首次运行会把固定版本的 Chrome for Testing（`CHROME_BUILD_ID`，见 `tests/e2e/lib/browser.mjs`）下载到 `.cache/chrome/`（已忽略），之后复用。

| 环境变量 | 作用 |
|---|---|
| `CHROME_PATH` | 直接指定浏览器，跳过下载 |
| `CFT_BASE_URL` | 下载源。国内用 `https://registry.npmmirror.com/-/binary/chrome-for-testing` |
| `CFT_CACHE_DIR` | 下载缓存目录，默认 `.cache/chrome` |
| `HEADFUL=1` | 有界面运行（默认新 headless） |
| `PM_E2E_DEBUG=1` | 打印所有 target（页面 / SW）的创建、变化、销毁 |

`test:e2e` 依次运行：

| 脚本 | 覆盖 | 用时 |
|---|---|---|
| `run-e2e.mjs` | 主流程（注入、开关、向导、编辑面板、SPA、生命周期、导入导出、授权） | 约 45 秒 |
| `check-pages.mjs` | 扩展页面质量（#26：switch 角色、编辑态、图标压缩、确认框、深色与对比度） | 约 3 秒 |
| `check-mask.mjs` | 方案C遮罩（#23：后加载元素、跟手、深色页面、不可点、静止停帧、原样态不观察） | 约 5 秒 |
| `check-wizard.mjs` | 向导状态机（#34：序号重编号、标记不坍缩、Esc 状态机、继续选择、滚动命中、工具条拖动） | 约 8 秒 |
| `check-editor.mjs` | 编辑面板（#24：popup 入口、重选替换、开关不被覆盖、逐行校验、删除撤销） | 约 10 秒 |
| `check-toggle.mjs` | 悬浮按钮与无障碍（#25：菜单不出屏/翻转/Esc/点外关闭、无右键菜单、Tab+回车、拖动贴边、三底色对比度、对话框在超高浮层之上） | 约 10 秒 |

截图写到 `test-results/e2e/`（已忽略）。其他脚本不进 `test:e2e`：`check-i18n.mjs`、`check-dark-mode.mjs`、`run-e2e-real.mjs`（真实网站，输出 `test-results/real/`）、`store-shots.mjs`（生成商店素材，直接写 `docs/store-assets/`，见 CHROMEWEBSTORE.md §8）。

## 工具函数（`tests/e2e/lib/`）

- `browser.mjs`：`resolveChrome()`、`launchWithExtension()`、`enableDeveloperMode()`
- `extension.mjs`：`launchExtension({ hostOrigins, extraPermissions })`（拷贝产物 + 预授予主机权限 + 控制页；`extraPermissions` 只加在测试拷贝里）、`waitForServiceWorkerIdle()`、`stopServiceWorker()`、`reloadExtension()`、`removePermission()`、`grantPermissions(ext, origins)`（不经弹窗授予，两次重载）、`openPopup(ext, page)`（以 page 为当前标签页打开 popup）、`permissionWarnings(control, manifest)`（安装警告）、`getProfile / setProfile / patchProfile`、`sendToBackground / sendToTab / tabIdOf`
- `extension.mjs` 另有 `evalInContentWorld(page, extOrigin, expr)`：在内容脚本的隔离环境里求值
- `shadow.mjs`：`clickInShadow(page, host, inner, { button })`（真实鼠标）、`waitForShadow`、`shadowText`。宿主是自定义元素，选择器直接写标签名（`pagemask-toggle`、`pagemask-editor`、`pagemask-wizard`、`pagemask-mask`）
- `harness.mjs`：`createReporter()`（`check`、`expectFail(name, issue, fn)`）、`startServer()`（随机端口）、`waitFor()`、`resultsDir()`

`expectFail`：已知缺陷的回归用例。失败时打印「预期失败 → #NN」不计失败；意外通过计为失败，负责的票修好后把它改成普通用例。

## 实测得到的坑（CfT 157 + puppeteer-core 25）

1. `chrome.runtime.reload()` 后未打包扩展被禁用（`DISABLE_UNSUPPORTED_DEVELOPER_EXTENSION`），除非打开开发者模式。预写 `Preferences` 无效，只能在 `chrome://extensions` 页面调 `chrome.developerPrivate.updateProfileConfiguration({ inDeveloperMode: true })`。
2. 写在 manifest `host_permissions` 里的来源是必需权限，`permissions.remove` 报 "You cannot remove required permissions"。做法：先以必需权限安装（等于已授权），再把它从拷贝的 manifest 删掉并重载一次，权限保留下来、变成"可选权限、运行时已授予"，与真实用户一致，之后可撤销。
3. puppeteer 25 的 `enableExtensions: [dir]` 内部没有等待安装完成（`Promise.all([array])`），改为 `enableExtensions: true` + `browser.installExtension(dir)`。
4. puppeteer 对 SW 默认静默分离，只要不调 `target.worker()`，SW 就能按 30 秒规则自然回收（实测 30.2 秒）。但 `browser.targets()` 对静默分离的 SW 不会及时移除，判断 SW 是否在运行要用浏览器级 CDP `Target.getTargets`。
5. CDP `ServiceWorker.stopAllWorkers`（在扩展页面的会话里发）能立即停掉扩展 SW，之后页面消息照常唤醒新实例；可作为快速版本，关键回归仍用自然回收。
6. 打开的扩展页面（控制页）不会阻止 SW 空闲回收。
7. 重载后必须等旧扩展页面真正关闭再打开新页面，否则新页面可能在卸载前加载、随后失效，`evaluate` 一直挂起。
8. 权限弹窗（`permissions.request`）无法自动化。`chrome.developerPrivate.addHostPermission` 对"可选主机权限"不生效（调用成功但 `permissions.getAll` 里没有）。授予只能用 manifest 法：写进拷贝 manifest 的 `host_permissions` 重载一次，再删掉重载一次（`grantPermissions`）。用例里点「重新授权 / 一次授权全部」时先把页面里的 `chrome.permissions.request` 换成记录参数的替身，只断言请求内容；弹窗本身人工验收。
9. `chrome.action.openPopup()` 能在 headless 下打开真实 popup（`target.asPage()`），但**不授予 activeTab**，popup 里 `tab.url` 为空。测试拷贝加 `tabs` 权限（`extraPermissions: ['tabs']`）代替用户点图标时的 activeTab。
10. 后台标签页不跑动画帧，puppeteer 的 `click()` 会一直等元素稳定直到协议超时。点击扩展页面（管理页）前先 `bringToFront()`，断言另一个页面前再切回来。
11. 扩展重载后，已打开网页里的旧内容脚本失联（`chrome.runtime.id` 变为 undefined），它注入的用户样式表仍然生效。重新注入的新脚本落在**另一个**隔离环境，看不到旧实例的 `window.__pagemask`（#22 实测，纠正 #21 时的说法）。接管方式见 ADR-0006。
12. `scripting.insertCSS` 同一文本注入两次要 `removeCSS` 两次才会消失（按次数计）。
13. 内容脚本隔离环境里的东西（`window.__pagemask`、Navigation API）用 `evalInContentWorld(page, extOrigin, expr)` 查：CDP `Runtime.enable` 列出执行环境，取 `origin` 为扩展、`auxData.type === 'isolated'` 的那个求值。

## 当前预期失败

无（#25 的「点菜单打开编辑面板」已转正，见 `check-toggle.mjs` 与 `run-e2e.mjs` 的悬浮按钮菜单段）。

## 站点生命周期（#21）

- `runtime.reload()` 后新开已配置站点仍是清爽态（onInstalled 对账补注册；原 #21 预期失败已转正）
- `permissions.remove` 后：新开页面不注入、配置保留；popup 显示「重新授权」，点击发起本站权限请求；`grantPermissions` 授予后新开页面恢复，popup 不再显示「重新授权」
- 导出 → 管理页一键清空（已打开页面不刷新即还原标题、图标、样式、悬浮按钮，配置与授权都已收回）→ 导入：两个站点「待授权」、授权前不生效、「一次授权全部」一次请求两个站点；授予后两个站点新开页面生效
- 安装警告：`chrome.management.getPermissionWarningsByManifest(产物 manifest)` 为空数组

人工验收：popup「重新授权」与管理页「授权并启用 / 一次授权全部」点击后的浏览器授权弹窗（选「允许」后站点立即恢复；选「拒绝」配置保留、提示可再试）。

## 注入引擎回归（#20）

- SW 被 CDP 停止 / 自然空闲回收后切回原样，被藏元素重新可见（原 #20 两条预期失败，已转正）
- 向导预览中 SW 被 CDP 停止，点「放弃」后预览样式撤掉（自然回收由上一条覆盖，省 30 秒）
- A 页清爽态 → 同源跳 B → 后退 → 切原样，A 页无残留；以及 A 在 bfcache 期间存储切到原样、后退后按新状态同步。用例断言 bfcache 确实生效（A 页里记录的 `pageshow.persisted`；CfT 157 新 headless 下实测生效）。注意 bfcache 恢复不触发 `load`，`page.goBack()` 的等待条件不可靠，用例只等地址回到 A
- 刷新已配置站点的首帧：主世界 `evaluateOnNewDocument` 钩子在目标元素进入 DOM 后逐个动画帧（rAF 在该帧绘制前执行）用 `checkVisibility({ opacityProperty, visibilityProperty })` 采样 20 帧，断言目标元素每帧都不可见、内容可见的每一帧标题都已替换。只靠用户样式表时这条 3 次全失败（首帧约 5ms），见 ADR-0005

## 生命周期与界面隔离（#22）

- 敌意页面（夹具 `/hostile.html`，`HOSTILE_CSS` 见 `fixtures.mjs`：`html>div`、`div:empty`、`*{line-height:3;direction:rtl;color:red}`、`body~*{display:none;opacity:0}` 全部 `!important`）：悬浮按钮可见且命中测试落在宿主上、编辑面板与向导工具条可见；按钮、面板标题、关闭按钮的 line-height / direction / color / 字体与普通页面完全一致；shadow 根容器 `lang=zh-CN`
- 编辑面板输入框里打字：输入框收到、页面 `document` 的 keydown 监听一次都没触发；焦点在向导按钮上按 Esc 照常退出向导
- SPA：pushState 往返 3 次 + 一次后退，每次 600ms 内按新地址重评估生效范围；隔离环境里有 Navigation API（WXT 不会退回 1 秒轮询；源码里没有 `setInterval` 由 `tests/no-polling.test.ts` 守门）；清爽期间 pushState + 改标题后切回原样，标题为最新页标题
- 扩展重载后已打开页面：旧按钮被撤下、只剩新实例的一个，`window.__pagemask` 指向活着的新实例；页面改标题后 1 秒内 head 变化少于 10 次且标题被压回（没有两个守卫互相改）；用新按钮切回原样，标题为页面最新写入值，旧实例注入的隐藏样式也被撤掉
- 同一页面被重复注入（enableSite 对已有运行时的页面再 executeScript）：只剩一个按钮、新实例活着，切回原样时隐藏样式撤干净
- 一键清空后宿主保护样式也被撤掉（页面自造一个 `pagemask-mask` 探针，不再被设成 fixed）

没有自动化的：扩展更新后**没有**被重新注入的旧页面（例如休眠标签页）靠旧实例自检失联收尾——标题守卫补刀时、页面重新可见时、点悬浮按钮时；由单测覆盖守卫一侧，页面一侧人工验收。
