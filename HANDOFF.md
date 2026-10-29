# HANDOFF · 0.4.0 进行中（3 / 10）

> 本文件只在批次进行中临时放根目录（见 `AGENTS.md`），批次收尾后删除。设计共识在 `docs/design.md`，术语在 `GLOSSARY.md`，过程记录在 `docs/dev/`。

## 现在到哪了

0.4.0 的 spec 是 [#48](https://github.com/cherishfall/page-mask/issues/48)，拆成十张子票 [#49–#58](https://github.com/cherishfall/page-mask/issues/48)，阻塞关系用 GitHub 原生依赖边（不是正文里写一句话）。

| # | 票 | 阻塞于 | 状态 |
|---|---|---|---|
| [#49](https://github.com/cherishfall/page-mask/issues/49) | 标题与图标不再和网站对抢 | — | ✅ `e28530f` |
| [#50](https://github.com/cherishfall/page-mask/issues/50) | 遮住可开可关 + 统一恢复按钮 | — | ✅ `c87afab` |
| [#55](https://github.com/cherishfall/page-mask/issues/55) | 插件设置独立成页 | — | ✅ `9e158ca` |
| [#51](https://github.com/cherishfall/page-mask/issues/51) | 向导三步骨架 + 第 1 步 | #49 ✅ | ⏭ 下一个 |
| [#52](https://github.com/cherishfall/page-mask/issues/52) | 点选这一步清单化 | #51 | 等待 |
| [#53](https://github.com/cherishfall/page-mask/issues/53) | 看效果收编范围、保存即完成 | #52 | 等待 |
| [#54](https://github.com/cherishfall/page-mask/issues/54) | 面板只留三件事 | #50 #55 | 等待 |
| [#56](https://github.com/cherishfall/page-mask/issues/56) | 站点设置与 ⋯ 菜单对齐 | #51 | 等待 |
| [#57](https://github.com/cherishfall/page-mask/issues/57) | 中英双语 | #51–#56 | 等待 |
| [#58](https://github.com/cherishfall/page-mask/issues/58) | 文档、引导、截图 | #57 | 等待 |

**建议顺序**：49 ✅ → 50 ✅ → 55 ✅ → 51 → 52 → 53 → 54 → 56 → 57 → 58。50 和 55 互不依赖，但同一台机器上并行跑会抢 git index，**串行做**。

## 换模型或换工具之后怎么接着跑

1. 读这份文件的进度表，再 `HTTPS_PROXY=http://127.0.0.1:7890 gh issue view <编号>` 取那张票的完整验收标准。
2. 一次只做一张票。做完：`npm run compile` + `npx vitest run`（全量约 495 项）必须全绿。
3. `git commit`（Conventional Commits，**不要 push**，推送由批次收尾统一做）。
4. 回来把本文件进度表的对应行改成 ✅ 并写上 commit，再进下一张。

## 实现时必须守的硬约束（容易踩回去）

1. **幕布恢复按钮常态不透明度 85%**，不是 50%——白色幕布上 50% 的图标只有 2:1 左右，达不到非文本对比 3:1 的可识别门槛，也是"用户找不到按钮"的直接原因。
2. **插件设置页注册成 options 时必须 `open_in_tab: true`**，否则 Chrome 会把它塞进约 400×600 的小窗，布局全崩。
3. **一次性幕布脚本必须应答两条消息**（查询是否遮着、命令撤掉）。现在它只会闷头铺幕布，谁问都不应，面板的「遮住 / 恢复」开关做出来也只能单向。
4. **术语**（以 `GLOSSARY.md` 为准，本批会更新）：删除这个网站的设置 / 收起的内容 / 标签页标题和图标 / 插件设置 / 界面语言。界面上**禁用**：清空、一键、屏蔽、拦截、配置、移除这个网站。
5. **面板点「遮住本页」后必然关闭**（Chrome 的 popup 一失焦就销毁），"再点一下恢复" = 重新点一次工具条图标。这是平台限制，不是 bug，别当缺陷去修。

## 本批推翻的旧共识（收尾改文档时同步）

- `docs/design.md`「幕布」一节写着「上面不放任何文字、图标、logo」——现在留一颗睁眼按钮，这条要改，`ADR-0007` 一并补。
- 管理页原来是「网站 / 设置」两个 tab，本批拆成两个独立页面，`design.md` 的「界面清单」要重画。
- 「一键清空」这个词整条从术语表移除，换成「删除这个网站的设置」。

## 跑测试的环境坑（这台机器）

- E2E 起不来 Chrome 时要加：`CHROME_ARGS="--no-sandbox --disable-gpu" npm run test:e2e`。
- `gh` 命令必须带 `HTTPS_PROXY=http://127.0.0.1:7890`；git 已配仓库级代理，不用前缀。
- 新增依赖必须用官方源装，见 `AGENTS.md` 的「本机网络环境」一节。

## 0.3.0 的历史（已发布，仅留索引）

9 张票 #39–#47 全部实现；release：https://github.com/cherishfall/page-mask/releases/tag/v0.3.0 。细节见 `docs/dev/DEVLOG.md` 与 git 历史。
