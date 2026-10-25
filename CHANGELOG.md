# 更新日志 / Changelog

## 0.1.0 - 2026-10-26

首个功能完整版本 / First functional release.

### 中文

- 站点名单制：仅用户主动添加的网站生效，未配置站点零注入、零影响
- 点选向导：悬停高亮、连续多选、选大/选小层级调整、整页防呆提示、Esc 二次确认
- 三种收起方案：彻底移除 / 原地留白 / 遮罩覆盖（预览期可随时切换，幽灵标记原位提示）
- 隐藏规则：多候选选择器（语义属性优先，过滤 CSS-in-JS 机器类名），生效范围零输入（整站/仅这类/排除这类）
- 标题与图标伪装：默认「新建标签页」+ 中性图标，SPA 动态改写自动补刀压制
- 每站点开关：悬浮胶囊按钮（可拖动、记住位置），同站多标签页联动，状态按站点记忆
- 页面内编辑面板：当前页面规则列表、换方案/改范围即时生效、删除、重选、高级选择器后门（保存前必须现场命中）
- 管理页：全站点总览、伪装标题/图标设置、体检红点、一键清空（二次确认）、导出/导入（合并或整体替换）
- 失效体检：仅伪装态采集，人话提醒
- 首次安装 3 步图文引导
- 隐私：完全本地存储，无网络行为，权限最小化（可选主机权限按站点授权）

### English

- Allowlist model: only user-added sites are affected; zero injection elsewhere
- Pick wizard: hover highlight, multi-select, bigger/smaller level adjustment, whole-page guard, Esc double-confirm
- Three hiding strategies: remove / blank-in-place / overlay sticker, switchable live during preview with ghost markers
- Hide rules: multi-candidate selectors (semantic attributes first, CSS-in-JS machine classes filtered), zero-typing scope (whole site / only these pages / except these pages)
- Title & favicon disguise with automatic re-suppression on SPA rewrites
- Per-site switch via draggable floating capsule; all tabs of a site switch together; state remembered per site
- On-page editor panel: per-page rule list, live strategy/scope changes, delete, re-pick, advanced raw-selector backdoor (must match live before saving)
- Management page: all-sites overview, title/icon settings, health dots, one-click reset with confirmation, export/import (merge or replace)
- Rule health check: collected only in disguised state, plain-language notices
- First-run 3-step onboarding guide
- Privacy: fully local storage, no network activity, minimal permissions (per-site optional host permissions)
