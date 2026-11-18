# 标题和图标：保留两套保存模型，统一「存了但看不到」的出口

日期：2026-11-18 · 状态：已采纳 · 相关：[ADR-0015](./0015-single-capsule-form.md)（胶囊单一形态）、[ADR-0016](./0016-capsule-drag-by-body.md)（胶囊拖动）、`docs/GLOSSARY.md`「标题和图标」、`docs/design-copy.md` 二、e/f

## 背景

「标题和图标」在三个地方出现：站点设置页的卡、弹窗里的一步、悬浮按钮「⋯」菜单里的一步。后两者复用同一个单步小表单，主按钮是「保存」，退出走一次「这次改动不保存」的确认（#81、#159）。站点设置页的同一张卡则是「停止输入自动保存」，卡内有「停止输入后自动保存」的脚注（#182）。

1.0.9 用户验收时把这类问题归为「不统一的交互行为」：同一个设置，从弹窗进去要按保存，从全部网站设置进去不用按；开关关着时，向导弹窗会问「保存后看不到效果，现在打开吗」，设置页却静默保存、只留一句「开关关着时，标题仍显示网站本来的标题」。用户改完标题，标签页没有变化，不知道是没存上、还是开关没开。

1.0.10 的另一处同源事故是向导退出提示：两条流程共用一句「标签页会变回原来的标题，页面也变回设置前的样子」，而「收起内容」只动页面、「标题和图标」只动标签页——句子把另一条流程的行为写进来了。

## 决定

1. **两套保存模型都保留**：向导是「编辑 → 保存 / 退出」，站点设置页是「停止输入自动保存」。不为了表面统一给设置页加保存按钮，也不把向导改成自动保存。
2. **统一的是「存了但看不到」的出口**：开关关着时，用户改过标题或图标之后，两处都必须当场给出同一句问题——「「按你的设置显示」还关着，现在打开吗？」——以及「先保持原样 / 现在打开」两个出口。
   - 向导：保存前用确认框问（#159 既有行为，不改）。
   - 站点设置页：用户改过标题或图标后，卡内出现一行页内提示与两个按钮；不弹窗、不阻挡继续编辑。「先保持原样」只是收起提示，不撤销已保存的标题/图标；「现在打开」调与页头开关同一条 `setSwitch` 通道，失败按既有 `toggleError` 显示。
3. **条件句同构**：标题与图标两个字段的常驻说明都写「开关关着时……」，因为那是用户最容易误会「我改了怎么没反应」的状态；不再一个写关着、一个写打开。
4. **流程专属文案分开写**：向导退出确认按流程拆成两条——「收起内容」只说页面回到上次保存的收起设置；「标题和图标」只说标签页回到上次保存的标题和图标。不再按「预览了几项」选句子。

## 界面与文案依据

| 决策点 | 参考了谁、哪条规则 | 为什么这样取舍 |
|---|---|---|
| 设置页保留自动保存 | [Apple HIG · Settings](https://developer.apple.com/design/human-interface-guidelines/settings) 的即时生效设置、[Chrome 设置](https://support.google.com/chrome/answer/95647) 的自动保存惯例；[Nielsen 4 一致性与标准](https://www.nngroup.com/articles/ten-usability-heuristics/) | 设置页是「浏览并调整」的上下文，边打边存减少一次保存动作；向导是带预览的聚焦任务，保存前还要决定「现在打开吗」，点保存是任务的一部分。两套模型各自成立 |
| 不在设置页加保存按钮 | 同上；GOV.UK [Button](https://design-system.service.gov.uk/components/button/) 的「不要让用户猜什么时候生效」 | 加保存按钮会把设置页变成表单，页面其他卡仍是即时生效，反而制造第二套不一致 |
| 用页内提示而不是弹窗 | [GOV.UK · Notification banner](https://design-system.service.gov.uk/components/notification-banner/) 的「不打断、就近说明」；[Carbon · Notification](https://carbondesignsystem.com/components/notification/usage/) 的 inline 用法 | 用户正在输入，弹窗会打断；一行提示贴着字段，符合「说明跟着对象走」 |
| 两个出口的文案 | [GOV.UK · Button](https://design-system.service.gov.uk/components/button/)「按钮文字写清楚点下去会发生什么」；`docs/design-copy.md` 二、a | 「先保持原样」与「现在打开」直接说结果；不复述「保存」，因为设置页已经自动保存 |
| 退出提示按流程拆分 | `docs/design-copy.md` 二、e；[Nielsen 2 贴近真实世界](https://www.nngroup.com/articles/ten-usability-heuristics/) | 提示只能描述这条流程真的会变的东西；套模板会让用户以为退出会撤销另一件事 |
| 条件句同构 | `docs/design-copy.md` 二、f；格式塔「相似」 | 同一张卡的两个同类字段，句式不同会让用户以为两者行为不同 |

## Considered Options

- **全部改成点保存**：否决。设置页每张卡都是即时生效，单独给标题/图标加保存按钮，会让用户在同一页遇到两种生效方式，且多一次点击。
- **全部改成自动保存**：否决。向导是带预览的聚焦任务，保存前要问「现在打开吗」，自动保存会让「退出不保存」的确认失去意义，也会让预留在退出时无法回滚。
- **保持两套但只靠脚注解释**：否决。这就是 1.0.9 的现状；脚注解释不了「我改了为什么没反应」，用户仍要靠猜。
- **在设置页也弹「保存后看不到效果」的确认框**：否决。用户没有执行保存动作，弹窗会打断输入；页内提示足够。
- **开关关着时干脆不让编辑标题/图标**：否决。用户可以先设置好，等需要时再打开；禁用会让「先配置、后启用」的路径消失。

## Consequences

- `messages.zh.ts` / `messages.en.ts` 新增 `management.savedOffNotice`、`savedOffStay`、`savedOffOpen`，删除 `wizard.exitBodySelected` / `exitBodyPlain`，新增 `wizard.exitBodyRules` / `exitBodyTitle`；中英同步。
- `entrypoints/management/views/SiteSettingsView.vue` 的标题/图标卡增加页内提示；`entrypoints/management/store.ts` 抽出 `setSwitch(profile, on)`，页头开关与提示里的「现在打开」共用。
- `ui/wizard/WizardApp.vue` 的 `exitBody` 改为按流程（`phase === 'title'`）选句子，不再按 `previewCount`。
- 新增 `tests/wizard-copy.test.ts`：两条退出提示不得提到另一条流程的对象；`tests/surfaces.test.ts` 或 `tests/copy-guidance.test.ts` 补 `management.savedOffNotice` 的守门。
- `docs/GLOSSARY.md`「标题和图标」补两种保存模型；`docs/design-copy.md` 增加二、e/f；`docs/design-surfaces.md` 在「标题和图标」行补设置页提示的跨界面约定。
- 发版：1.0.10，按「发版四件套」同步 `CHANGELOG.md`、在线更新日志、README、隐私页（本轮不涉及隐私内容变化，隐私页不动）。
