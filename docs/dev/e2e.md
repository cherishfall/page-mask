# E2E 测试说明（#31）

## 怎么跑

```bash
npm run test:e2e            # = wxt build && node tests/e2e/run-e2e.mjs，约 50 秒（含 30 秒 SW 空闲等待）
```

首次运行会把固定版本的 Chrome for Testing（`CHROME_BUILD_ID`，见 `tests/e2e/lib/browser.mjs`）下载到 `.cache/chrome/`（已忽略），之后复用。

| 环境变量 | 作用 |
|---|---|
| `CHROME_PATH` | 直接指定浏览器，跳过下载 |
| `CFT_BASE_URL` | 下载源。国内用 `https://registry.npmmirror.com/-/binary/chrome-for-testing` |
| `CFT_CACHE_DIR` | 下载缓存目录，默认 `.cache/chrome` |
| `HEADFUL=1` | 有界面运行（默认新 headless） |
| `PM_E2E_DEBUG=1` | 打印所有 target（页面 / SW）的创建、变化、销毁 |

截图写到 `test-results/e2e/`（已忽略）。其他脚本不进 `test:e2e`：`check-dark-mode.mjs`、`store-shots*.mjs`（输出 `test-results/store-shots/`，正式素材由 #29 重做）、`run-e2e-real.mjs`（真实网站，输出 `test-results/real/`）。

## 工具函数（`tests/e2e/lib/`）

- `browser.mjs`：`resolveChrome()`、`launchWithExtension()`、`enableDeveloperMode()`
- `extension.mjs`：`launchExtension({ hostOrigins })`（拷贝产物 + 预授予主机权限 + 控制页）、`waitForServiceWorkerIdle()`、`stopServiceWorker()`、`reloadExtension()`、`removePermission()`、`getProfile / setProfile / patchProfile`、`sendToBackground / sendToTab / tabIdOf`
- `shadow.mjs`：`clickInShadow(page, host, inner, { button })`（真实鼠标）、`waitForShadow`、`shadowText`
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

## 当前预期失败

| 用例 | 票 |
|---|---|
| 悬浮按钮右键菜单「编辑规则」打开编辑面板 | #25 |
| SW 被 CDP 停止后切回原样，被藏元素重新可见 | #20 |
| SW 自然空闲回收后切回原样，被藏元素重新可见 | #20 |
| `runtime.reload()` 后已配置站点仍然生效 | #21 |
