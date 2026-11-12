<template>
  <div ref="rootEl">
    <!-- 页内覆盖层：捕获层 / 悬停框 / 序号牌 / 预览标记（代码命令式管理，跟随元素位置；本模板只提供容器） -->
    <div ref="overlayLayer" data-testid="pm-wizard-overlay"></div>

    <!-- 工具条：默认底部居中，可拖动（N15） -->
    <section
      ref="toolbarEl"
      id="pm-wiz-body"
      class="pm-wiz-toolbar"
      :class="{ moved: !!tbPos, wide: phase === 'pick' || phase === 'preview', collapsed }"
      :style="tbPos ? { left: `${tbPos.left}px`, top: `${tbPos.top}px` } : undefined"
      aria-labelledby="pm-wiz-title"
      data-testid="pm-wizard-toolbar"
    >
      <!-- 同类导航的读屏播报：常驻节点（live region 必须先于内容存在，随插随毁不播报——
           0.8.12 准则审查）；行内那份是视觉文字，不带 aria-live，免得双重播报 -->
      <p class="pm-wiz-sr" aria-live="polite" data-testid="pm-wiz-same-nav-live">{{ sameNavLiveText }}</p>
      <!-- 整条标题栏可拖（#119）：桌面客户端的惯例——按在标题文字、进度或空白处都能挪；
           按钮（退出设置，以及将来的其它控件）按 NO_DRAG_SELECTOR 排除。把手只保留键盘路径。 -->
      <div
        class="pm-wiz-head"
        :class="{ dragging }"
        @pointerdown="onHeadDown"
        @pointermove="onHeadMove"
        @pointerup="endDrag"
        @pointercancel="endDrag"
        @lostpointercapture="endDrag"
        @dragstart.prevent
      >
        <button
          type="button"
          class="pm-wiz-handle"
          :aria-label="t.wizard.dragAria"
          :title="t.wizard.dragTitle"
          data-testid="pm-wiz-drag"
          @keydown="onHandleKey"
        >
          <GripIcon />
        </button>
        <div class="pm-wiz-headtext">
          <h2 id="pm-wiz-title" class="pm-wiz-title" data-testid="pm-wiz-heading">{{ t.wizard.heading[phase] }}</h2>
          <!-- 进度只在两步的「收起内容」里显示；「标题和图标」是单步小表单，没有步数可言 -->
          <p v-if="progressTotal > 1" class="pm-wiz-progress" data-testid="pm-wiz-progress">{{ progressText }}</p>
        </div>
        <!-- 收起 / 展开（0.8.15，#150）：轻操作文字按钮，排在退出设置左边。
             折叠只切 collapsed（CSS 隐藏 section 的非标题栏直接子内容），不丢草稿、不退出向导、
             不重置 tbPos；overlayLayer 是 section 的兄弟节点，号码牌 / 悬停高亮不受影响。
             它是 button，已被 NO_DRAG_SELECTOR 的 button:not(.pm-wiz-handle) 排除，不会触发拖动 -->
        <button
          type="button"
          class="pm-wiz-collapse"
          :aria-expanded="!collapsed"
          :aria-controls="'pm-wiz-body'"
          :aria-label="collapsed ? t.wizard.expandAria : t.wizard.collapseAria"
          data-testid="pm-wiz-collapse"
          @click="collapsed = !collapsed"
        >
          {{ collapsed ? t.wizard.expand : t.wizard.collapse }}
        </button>
        <button
          type="button"
          class="pm-btn small"
          :aria-label="t.wizard.exit"
          data-testid="pm-wiz-exit"
          @click="requestExit(true)"
        >
          {{ t.wizard.exit }}
        </button>
      </div>

      <!-- 标题和图标：单步小表单（#81）。
           表单与页面 ⋯ 菜单的小面板是同一个组件（ui/title-icon/TitleIconFields.vue），不写第二份 -->
      <template v-if="phase === 'title'">
        <div class="pm-wiz-step1">
          <TitleIconFields
            v-model:title="titleInput"
            v-model:icon="iconData"
            id-prefix="pm-wiz"
            :title-hint="t.wizard.titleHint(initialTitle)"
          />
          <!-- 回退出口（#99）：保存过才出现。不是删除，所以不用危险色，也不进底栏 -->
          <div v-if="props.titleIconSet" class="pm-wiz-reset" data-testid="pm-wiz-title-reset-row">
            <button
              type="button"
              class="pm-wiz-link plain"
              data-testid="pm-wiz-title-reset"
              :disabled="saving"
              @click="resetTitleIcon"
            >
              {{ t.common.resetTitleIcon }}
            </button>
            <p class="pm-wiz-reset-hint">{{ t.common.resetTitleIconHint }}</p>
          </div>
        </div>
      </template>

      <template v-else-if="phase === 'pick'">
        <div class="pm-wiz-pick">
          <!-- 说明：一行一件事，不再堆成一整段 -->
          <ul class="pm-wiz-lead" data-testid="pm-wiz-pick-lead">
            <li v-for="line in t.wizard.pickLead" :key="line">{{ line }}</li>
          </ul>

          <!-- 分组一：调整选中项（浅底 + 小标题；组内标明现在调的是第几项） -->
          <div class="pm-wiz-group" role="group" aria-labelledby="pm-wiz-adjust-title" data-testid="pm-wiz-group-adjust">
            <h3 id="pm-wiz-adjust-title" class="pm-wiz-group-title">{{ t.wizard.adjustGroup }}</h3>
            <!-- h3 与清单组标题同级（0.8.12 准则审查：p/h3 混用让读屏标题导航漏掉这一组） -->
            <p class="pm-wiz-group-note" data-testid="pm-wiz-adjust-target">
              <template v-if="lastSel">
                {{ t.wizard.adjustNow }}<strong>{{ t.wizard.adjustTarget(lastSelIndex + 1, lastSelName) }}</strong>
              </template>
              <template v-else>{{ t.wizard.adjustPickFirst }}</template>
            </p>
            <div class="pm-wiz-group-row">
              <button
                type="button"
                class="pm-btn small"
                data-testid="pm-wiz-bigger"
                :disabled="!lastSel"
                @click="adjust('bigger')"
              >
                {{ t.wizard.bigger }}
              </button>
              <button
                type="button"
                class="pm-btn small"
                data-testid="pm-wiz-smaller"
                :disabled="!lastSel"
                @click="adjust('smaller')"
              >
                {{ t.wizard.smaller }}
              </button>
            </div>
          </div>

          <!-- 分组二：已选清单，一行一项、一行一个删除；右上角「全部取消选择」只是文字链接 -->
          <section
            ref="listEl"
            class="pm-wiz-group"
            aria-labelledby="pm-wiz-list-title"
            tabindex="-1"
            data-testid="pm-wiz-group-list"
          >
            <div class="pm-wiz-group-head">
              <h3 id="pm-wiz-list-title" class="pm-wiz-group-title" data-testid="pm-wiz-list-title">
                {{ t.wizard.listTitle(selectionRows.length) }}
              </h3>
              <button
                v-if="selectionRows.length > 0"
                type="button"
                class="pm-wiz-link"
                data-testid="pm-wiz-clear-all"
                @click="clearSelection"
              >
                {{ t.wizard.clearAll }}
              </button>
            </div>
            <ol v-if="selectionRows.length > 0" class="pm-wiz-rows" data-testid="pm-wiz-selected">
              <li
                v-for="row in pickRows"
                :key="rowKey(row.el)"
                :data-testid="`pm-sel-${row.seq}`"
                @click="onPickRowClick(row, $event)"
              >
                <span class="pm-wiz-num" aria-hidden="true">{{ row.seq }}</span>
                <span class="pm-wiz-row-name" :data-testid="`pm-sel-name-${row.seq}`">{{ row.name }}</span>
                <button
                  type="button"
                  class="pm-btn ghost pm-icon-btn"
                  :aria-label="t.wizard.deleteOne(row.seq, row.name)"
                  :data-testid="`pm-sel-${row.seq}-remove`"
                  @click="removeSelected(row)"
                >
                  <span aria-hidden="true">✕</span>
                </button>
                <!-- 「页面上另外 N 个一样的也一起收起」住在这一项自己的行内（#82）：
                     勾上当场把这一组亮出来（一次一组），点行回到这一组的标记。
                     没有第二个一样的就整块不出现，与原来在「调整」里的条件一致 -->
                <label
                  v-if="row.sameHits > 1"
                  class="pm-wiz-same-row"
                  :data-testid="`pm-sel-${row.seq}-same-group`"
                  @click.stop
                >
                  <input
                    type="checkbox"
                    :checked="sameGroupOn(row)"
                    :data-testid="`pm-sel-${row.seq}-same-toggle`"
                    @change="onPickSameToggle(row, $event)"
                  />
                  <span>{{ t.wizard.sameGroupToggle(row.sameHits - 1) }}</span>
                </label>
                <!-- 同类逐个查看（0.8.11，#140）：勾上后导航行出现，位置文字 + 上一个/下一个
                     （wrap 循环）；当前成员由实线强调框标出（与整组的虚线描边区分），滚到视口中央。
                     信息流懒加载补内容后计数随 #88 的重算一起刷新 -->
                <div
                  v-if="row.el === sameFocusEl && sameNavCount > 0"
                  class="pm-wiz-same-nav"
                  :data-testid="`pm-sel-${row.seq}-same-nav`"
                >
                  <span class="pm-wiz-same-pos" :data-testid="`pm-sel-${row.seq}-same-pos`">
                    {{ t.wizard.sameNavPosition(sameNavIndex + 1, sameNavCount) }}
                  </span>
                  <button
                    type="button"
                    class="pm-btn ghost small"
                    :data-testid="`pm-sel-${row.seq}-same-prev`"
                    :aria-label="t.wizard.sameNavPrevAria"
                    @click="sameNavStep(-1)"
                  >
                    {{ t.wizard.sameNavPrev }}
                  </button>
                  <button
                    type="button"
                    class="pm-btn ghost small"
                    :data-testid="`pm-sel-${row.seq}-same-next`"
                    :aria-label="t.wizard.sameNavNextAria"
                    @click="sameNavStep(1)"
                  >
                    {{ t.wizard.sameNavNext }}
                  </button>
                </div>
              </li>
            </ol>
            <p v-else class="pm-wiz-group-note" data-testid="pm-wiz-list-empty">{{ t.wizard.listEmpty }}</p>
          </section>

          <!-- 回退出口（#160）：与「标题和图标」底部那颗对称。按这个网站已保存的**总数**出现，
               不是按本页用得上的条数——否则在规则都作用于别的页面时入口会莫名消失 -->
          <div v-if="props.savedRuleCount > 0" class="pm-wiz-reset" data-testid="pm-wiz-rules-reset-row">
            <button
              type="button"
              class="pm-wiz-link plain"
              data-testid="pm-wiz-rules-reset"
              :disabled="saving"
              @click="askRulesReset"
            >
              {{ t.common.resetSiteContent }}
            </button>
            <p class="pm-wiz-reset-hint">{{ t.common.resetSiteContentHint }}</p>
          </div>
        </div>
      </template>

      <template v-else>
        <!-- #161：这一屏怎么操作（改名字、调范围）是「完成操作必需」，常驻但压成一句短句；
             只有前几次才需要看的细节才进 ⓘ。 -->
        <p class="pm-wiz-sub">{{ t.wizard.previewHint }}</p>
        <!-- 清单带总数（0.9.1 二轮目检）：行多时最后一行藏在滚动区里，没有总数容易漏掉——
             与选内容步骤的「已选的 N 项」同一惯例 -->
        <h3 v-if="drafts.length > 0" id="pm-wiz-drafts-title" class="pm-wiz-group-title" data-testid="pm-wiz-drafts-title">
          {{ t.wizard.draftsLabel(drafts.length) }}
        </h3>
        <ol v-if="drafts.length > 0" class="pm-wiz-drafts" aria-labelledby="pm-wiz-drafts-title" data-testid="pm-wiz-drafts">
          <li v-for="(d, i) in drafts" :key="d.key" :data-testid="`pm-draft-${i + 1}`">
            <!-- 默认行：序号、名称、调整、删除（审查第 8 条：收起方式等控件折进「调整」，不摊在行上） -->
            <div class="pm-wiz-draft-head" :data-testid="`pm-draft-${i + 1}-head`">
              <span class="pm-wiz-num" aria-hidden="true">{{ i + 1 }}</span>
              <input
                v-model="d.name"
                class="pm-wiz-name"
                type="text"
                :placeholder="d.autoName"
                :aria-label="t.wizard.nameLabel(i + 1)"
                :data-testid="`pm-draft-name-${i + 1}`"
              />
              <button
                type="button"
                class="pm-btn ghost small pm-wiz-adjust"
                :aria-expanded="!!d.expanded"
                :data-testid="`pm-draft-${i + 1}-adjust`"
                @click="d.expanded = !d.expanded"
              >
                {{ t.wizard.adjust }}
              </button>
              <!-- #88：预览里组员已真实收起、看不到牌子——勾了同类的行给一个检查入口，
                   跳回点选阶段亮出这一组（成员牌子与实时计数都在那儿） -->
              <button
                v-if="!onlyOneOf(d) && d.el"
                type="button"
                class="pm-btn ghost small"
                :data-testid="`pm-draft-${i + 1}-inspect-same`"
                @click="inspectSameGroup(d)"
              >
                {{ t.wizard.inspectSame }}
              </button>
              <button
                type="button"
                class="pm-btn ghost pm-icon-btn"
                :aria-label="t.wizard.deleteOne(i + 1, draftName(d))"
                :data-testid="`pm-draft-${i + 1}-remove`"
                @click="removeDraft(d)"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
            <!-- 一句话摘要：收起方式 · 范围；失效项换成「可能失效 · 在页面上找不到了」。
                 展开时藏掉——展开后收起方式与范围就在眼前，摘要再说一遍就是重复（#76） -->
            <p v-if="!d.expanded" class="pm-wiz-draft-summary" :data-testid="`pm-draft-${i + 1}-summary`">{{ draftSummary(d) }}</p>

            <!-- 失效项：摘要下面给一句看得见的说明 + 修复入口（不能只靠角标） -->
            <p v-if="!d.el" class="pm-wiz-draft-stale" :data-testid="`pm-draft-${i + 1}-stale`">
              <span>{{ staleText(d) }}</span>
              <button type="button" class="pm-btn small" :data-testid="`pm-draft-${i + 1}-stale-fix`" @click="reselectDraft(d)">
                {{ t.wizard.reselect }}
              </button>
            </p>

            <!-- 展开「调整」之后才出现的控件：收起方式、范围、重新选、高级选择器、同类 -->
            <div v-if="d.expanded" class="pm-wiz-draft-body" :data-testid="`pm-draft-${i + 1}-body`">
              <fieldset class="pm-wiz-field">
                <legend class="pm-wiz-field-title">{{ t.wizard.methodLegend }}</legend>
                <!-- 三个收起方式：底层是原生单选组（同一 name = 一组，方向键可切换，读屏报「3 选 1」），视觉上做成连体分段 -->
                <div class="pm-wiz-seg">
                  <label v-for="s in STRATEGY_ORDER" :key="s" class="pm-wiz-seg-opt">
                    <input
                      type="radio"
                      :name="`pm-strategy-${i + 1}`"
                      :value="s"
                      :checked="d.strategy === s"
                      :data-testid="`pm-draft-${i + 1}-strategy-${s}`"
                      @change="setStrategy(d, s)"
                    />
                    <span>{{ t.common.strategy[s] }}</span>
                  </label>
                </div>
                <p class="pm-wiz-draft-hint" :data-testid="`pm-draft-${i + 1}-hint`">{{ t.common.strategyHint[d.strategy] }}</p>
              </fieldset>

              <fieldset class="pm-wiz-field" :data-testid="`pm-draft-${i + 1}-scope`">
                <legend class="pm-wiz-field-title">{{ t.wizard.rowScopeLegend }}</legend>
                <!-- 与「收起方式」同构的原生单选分段（#142）：同一 name = 一组、方向键可切、
                     读屏统一报「N 选 1」——同屏不再有两种互斥语义（此前是 aria-pressed 按钮组） -->
                <div class="pm-wiz-seg">
                  <label class="pm-wiz-seg-opt">
                    <input
                      type="radio"
                      :name="`pm-scope-${i + 1}`"
                      value="all"
                      :checked="draftScopeType(d) === 'all'"
                      :data-testid="`pm-draft-${i + 1}-scope-all`"
                      @change="setDraftScope(d, 'all')"
                    />
                    <span>{{ t.wizard.rowScopeAll }}</span>
                  </label>
                  <template v-if="sitePattern">
                    <label class="pm-wiz-seg-opt">
                      <input
                        type="radio"
                        :name="`pm-scope-${i + 1}`"
                        value="include"
                        :checked="draftScopeType(d) === 'include'"
                        :data-testid="`pm-draft-${i + 1}-scope-include`"
                        @change="setDraftScope(d, 'include')"
                      />
                      <span>{{ t.wizard.rowScopeInclude }}</span>
                    </label>
                    <label class="pm-wiz-seg-opt">
                      <input
                        type="radio"
                        :name="`pm-scope-${i + 1}`"
                        value="exclude"
                        :checked="draftScopeType(d) === 'exclude'"
                        :data-testid="`pm-draft-${i + 1}-scope-exclude`"
                        @change="setDraftScope(d, 'exclude')"
                      />
                      <span>{{ t.wizard.rowScopeExclude }}</span>
                    </label>
                  </template>
                </div>
                <p v-if="!sitePattern && scopeHint" class="pm-wiz-hint">{{ scopeHint }}</p>
                <p v-else-if="draftScopeType(d) !== 'all'" class="pm-wiz-hint" :data-testid="`pm-draft-${i + 1}-scope-value`">
                  {{ scopeHumanLabel(draftScope(d)) }}
                </p>
              </fieldset>

              <details class="pm-wiz-advanced" :data-testid="`pm-draft-${i + 1}-advanced`">
                <summary>{{ t.wizard.advancedSummary }}</summary>
                <p class="pm-wiz-hint">{{ t.wizard.advancedHint }}</p>
                <textarea
                  v-model="d.selectorText"
                  class="pm-wiz-textarea"
                  rows="2"
                  spellcheck="false"
                  :aria-label="t.wizard.selectorAria(draftName(d))"
                  :data-testid="`pm-draft-${i + 1}-selector`"
                ></textarea>
                <p v-if="d.selectorError" class="pm-wiz-error" role="alert" :data-testid="`pm-draft-${i + 1}-selector-error`">
                  {{ d.selectorError }}
                </p>
                <button type="button" class="pm-btn small" :data-testid="`pm-draft-${i + 1}-selector-save`" @click="saveSelectors(d)">
                  {{ t.wizard.saveSelectors }}
                </button>
              </details>

              <!-- 勾选框不再住在「调整」里（#82）：搬进了选内容清单的行内，
                   看效果的行摘要上直接写「连一样的共 N 个」 -->
            </div>
          </li>
        </ol>
        <p v-else class="pm-wiz-group-note" data-testid="pm-wiz-drafts-empty">{{ t.wizard.draftsEmpty }}</p>

      </template>

      <!-- 底栏：只放按钮（一行一件事，说明文字不塞进操作栏）。
           左边是退路（看效果这一步的「上一步」），右边是前进；只有一个按钮时靠右 -->
      <div class="pm-wiz-footer">
        <button
          v-if="phase === 'preview'"
          type="button"
          class="pm-btn small"
          data-testid="pm-wiz-back"
          @click="goBack"
        >
          {{ t.wizard.backToPick }}
        </button>
        <button
          v-if="phase === 'pick'"
          type="button"
          class="pm-btn small primary"
          data-testid="pm-wiz-preview"
          :disabled="previewCount === 0"
          @click="goNext"
        >
          {{ t.wizard.nextToPreview(previewCount) }}
        </button>
        <button
          v-else-if="phase === 'title'"
          type="button"
          class="pm-btn small primary"
          data-testid="pm-wiz-save"
          :disabled="saving"
          @click="saveTitleOnly"
        >
          {{ saving ? t.wizard.saving : t.wizard.save }}
        </button>
        <button
          v-else
          type="button"
          class="pm-btn small primary"
          data-testid="pm-wiz-save"
          :disabled="saving || drafts.length === 0"
          @click="doSave"
        >
          {{ saving ? t.wizard.saving : t.wizard.save }}
        </button>
      </div>
    </section>

    <!-- 提示（读屏按 polite 状态消息播报；容器常驻，内容出现时才播报） -->
    <div class="pm-wiz-status" role="status">
      <span v-if="warnText" class="pm-wiz-toast" data-testid="pm-wizard-warn">{{ warnText }}</span>
      <span v-if="infoText" class="pm-wiz-toast info" data-testid="pm-wizard-info">{{ infoText }}</span>
    </div>

    <!-- 退出确认：模态；Esc = 继续设置，焦点默认在「继续设置」。
         两个都是次按钮档：继续设置是默认档，退出只是红字红边（放弃本次未保存的改动，还没到不可撤销那一步） -->
    <dialog
      ref="exitDlg"
      class="pm-wiz-dialog"
      aria-labelledby="pm-exit-title"
      data-testid="pm-wizard-exit-confirm"
      @close="onExitClose"
    >
      <form method="dialog">
        <h2 id="pm-exit-title">{{ t.wizard.exitTitle }}</h2>
        <p>{{ exitBody }}</p>
        <div class="pm-wiz-actions">
          <button value="cancel" class="pm-btn" autofocus data-testid="pm-wiz-exit-no">{{ t.wizard.exitStay }}</button>
          <!-- 退出不是破坏性动作（草稿丢了可以重选，已保存的设置不动）：不用危险档（#175 视觉审查，
               GOV.UK「危险色只给严重且不可撤销」） -->
          <button value="exit" class="pm-btn" data-testid="pm-wiz-exit-yes">{{ t.wizard.exitConfirm }}</button>
        </div>
      </form>
    </dialog>

    <!-- 无法保存的说明（例如向导期间这个网站的设置被清空了，N22） -->
    <dialog
      ref="noticeDlg"
      class="pm-wiz-dialog"
      aria-labelledby="pm-notice-title"
      data-testid="pm-wizard-notice"
      @close="finish(false)"
    >
      <form method="dialog">
        <h2 id="pm-notice-title">{{ t.wizard.notSavedTitle }}</h2>
        <p>{{ noticeText }}</p>
        <div class="pm-wiz-actions">
          <button value="ok" class="pm-btn primary" autofocus data-testid="pm-wiz-notice-ok">{{ t.wizard.noticeOk }}</button>
        </div>
      </form>
    </dialog>
    <!-- 保存前的选择（#159）：已有站点处在原样态时，保存后页面看不到效果。
         复用同一套 pm-wiz-dialog；默认焦点放在「先保持原样」，Esc / 点外面 = 回向导、不保存 -->
    <dialog
      ref="openDlg"
      class="pm-wiz-dialog"
      aria-labelledby="pm-open-title"
      data-testid="pm-wizard-open-confirm"
      @cancel="onOpenCancel"
      @close="onOpenClose"
      @click="onOpenDialogClick"
    >
      <form method="dialog">
        <h2 id="pm-open-title">{{ t.wizard.openTitle }}</h2>
        <p>{{ t.wizard.openBody }}</p>
        <div class="pm-wiz-actions">
          <button value="stay" class="pm-btn" autofocus data-testid="pm-wiz-open-stay">{{ t.wizard.openStay }}</button>
          <button value="open" class="pm-btn primary" data-testid="pm-wiz-open-yes">{{ t.wizard.openConfirm }}</button>
        </div>
      </form>
    </dialog>

    <!-- 恢复网站原来的内容（#160）：破坏性动作走二次确认；确认按钮红字红边（实心红只留给删站点）。
         默认焦点在「取消」；Esc = 取消，回向导继续设置 -->
    <dialog
      ref="rulesResetDlg"
      class="pm-wiz-dialog"
      aria-labelledby="pm-rules-reset-title"
      data-testid="pm-wizard-rules-reset-dialog"
      @close="onRulesResetClose"
    >
      <form method="dialog">
        <h2 id="pm-rules-reset-title">{{ t.common.resetSiteContentTitle }}</h2>
        <p>{{ t.common.resetSiteContentImpact(props.savedRuleCount) }}</p>
        <div class="pm-wiz-actions">
          <button value="cancel" class="pm-btn" autofocus data-testid="pm-wizard-rules-reset-cancel">
            {{ t.common.cancel }}
          </button>
          <button value="confirm" class="pm-btn danger" data-testid="pm-wizard-rules-reset-confirm">
            {{ t.common.resetSiteContentConfirm }}
          </button>
        </div>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { browser } from 'wxt/browser';
import { BUTTON_KEY_STEP } from '@/core/button-pos';
import { describeElement } from '@/core/naming';
import { generateCandidates, selectorHitsElement } from '@/core/selectors';
import { deriveScopePattern, scopeUnavailableHint } from '@/core/origin';
import { siteKey } from '@/core/site-key';
import { scopeHumanLabel } from '@/core/scope';
import { isSafeSelector } from '@/core/validate';
import { newRuleId, type HideRule, type Scope, type SiteProfile, type StrategyId, type TabIcon } from '@/core/types';
import { createPageMaskStorage } from '@/core/storage';
import { buildPreviewCss, buildSameGroupOutlineCss, STRATEGY_ORDER } from '@/core/css-builder';
import { applyMaskAppearance } from '../mask-color';
import { isOwnUiNode } from '@/core/host-shield';
import { countCandidateHits } from '@/core/health';
import type { CssAck } from '@/core/messages';
import {
  badgePlacement,
  clampToViewport,
  draftHitCounts,
  hiddenItemsResetPatch,
  mergeEditDrafts,
  mergeSavedRules,
  saveAsksToOpen,
  savedSwitchState,
  selectionRows as buildSelectionRows,
  titleFromInput,
  titleIconResetPatch,
  titleOnlyPatch,
  unsavableDraftWarning,
  wizardEscAction,
  wizardInitialPhase,
  wizardNextPhase,
  wizardPrevPhase,
  wizardStep,
  type DraftItem,
  type DraftRuleInput,
  type MarkerRect,
  type SaveSwitchContext,
  type ScopeChoice,
  type SelectionRow,
  type WizardMode,
  type WizardPhase,
} from '@/core/wizard-logic';
import { t } from '@/ui/i18n';
import { PickController } from './pick-controller';
import { adoptWizardStyles } from './wizard-styles';
import TitleIconFields from '../title-icon/TitleIconFields.vue';
import GripIcon from '../GripIcon.vue';
import { ElementFollower } from '../follow';

/** 草稿：DraftItem + 当前候选选择器、自动命名、「只这一个 / 同类一起」的两个命中数 */
type Draft = DraftItem & {
  /** 行内稳定 key：el 可能为 null，不能再用元素当 key */
  key: number;
  candidates: string[];
  /** 自动命名结果，清空名称时作为输入框的占位提示，保存时也回落到它 */
  autoName: string;
  /** 当前这组候选在页面上命中的元素数（当前设置实际会收起几个） */
  hits: number;
  /** 「同类一起」那组候选的命中数（行内的 N，实时算）；也是「同类一起」能不能选的依据 */
  sameHits: number;
  /** 对应的旧规则 id：保存时原地更新它（保留 id 与体检记录），不是新增一条 */
  sourceRuleId?: string | null;
  /** 这条草稿自己的生效范围；从旧规则带进来的原样保留，新选的用底部三选一算 */
  scope?: Scope | null;
  /** 「调整」是否展开（只是界面状态，不落库） */
  expanded?: boolean;
  /** 高级：选择器原文的输入框内容与逐行校验的报错（本地草稿） */
  selectorText?: string;
  selectorError?: string;
};

/** 行内草稿的 key 计数器（元素可能为 null，不能用元素本身当 key） */
let draftKeySeq = 0;

/** 方向键每次移动工具条的距离（#171 起与胶囊、幕布恢复钮共用一份步长） */
const KEY_STEP = BUTTON_KEY_STEP;
/** 拖到边上时与视口边缘保持的距离（#123，与 CSS 里窄屏留的 16 一致） */
const TOOLBAR_INSET = 16;
const ARROW_DIRS: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

const props = defineProps<{
  mode: WizardMode;
  url: string;
  /** 这个页面上用得上的旧规则（#69）：进入点选时按原顺序铺成草稿起点；站点还没有配置时为空 */
  initialRules?: HideRule[];
  /** 这个网站是否已有配置：没有时保存即建站（0 条规则 + 清爽态） */
  hasProfile: boolean;
  /** 这个网站保存过「标题和图标」（#98）：只有保存过才显示「恢复原来的标题和图标」（#99） */
  titleIconSet: boolean;
  /**
   * 这个网站已保存的收起项**总数**（含只作用于别的页面的，即 profile.hideRules.length）。
   * 不能用 initialRules.length——那是「这个页面上用得上的」：规则都作用于别的页面时，
   * 入口会在这类页面上该有的时候消失，不该有的时候（别的页面的规则在本页命中）又出现。
   */
  savedRuleCount: number;
  /** 标题输入框的默认值（全局默认 > 界面语言默认，永不为空白） */
  initialTitle: string;
  /** 站点现有的图标（新站点默认「网站原来的图标」） */
  initialIcon: TabIcon;
  /** 站点现在的开关状态：「标题和图标」保存时保持原状（新站点不传语义由 hasProfile 决定） */
  initialState: SiteProfile['switchState'];
  /** 把标题 / 图标实时压到当前标签页上（退出时由内容脚本运行时还原） */
  previewDisguise: (title: string, icon: TabIcon) => void;
  /** 设置本文档的预览样式（null = 清除）；由内容脚本运行时按文档记录注入状态（core/doc-styles.ts） */
  setDraft: (css: string | null) => Promise<CssAck>;
}>();
const emit = defineEmits<{ done: [saved: boolean, notice?: string] }>();

/** 打开时停在哪一步：「标题和图标」是单步表单，「收起内容」从选内容开始（#81） */
const phase = ref<WizardPhase>(wizardInitialPhase(props.mode));
/** 打开这一刻属于这个页面的规则 id：保存时只有这些可以被删除（#69） */
const initialIds = (props.initialRules ?? []).map((r) => r.id);
/** 点了「重新选这一项」之后，下一次点页面就替换这一条（不新增） */
let pendingReplace: Draft | null = null;
const titleInput = ref(props.initialTitle);
const iconData = ref<TabIcon>(props.initialIcon);
/** 选择集（有序，顺序 = 序号）；元素本身不做响应式代理 */
const selEls = shallowRef<Element[]>([]);
const lastSel = shallowRef<Element | null>(null);
const warnText = ref('');
/** 中性的一句轻提示（例如「这一项已经在列表里」），2 秒后自己消失 */
const infoText = ref('');
const noticeText = ref('');
const drafts = ref<Draft[]>([]);
/** 这一步底部「在哪些页面收起」的选择；整批规则共用一份范围（默认整个网站） */
const tbPos = ref<{ left: number; top: number } | null>(null);
const dragging = ref(false);
/** 工具条是否收起（0.8.15，#150）：只切 section 的 collapsed class，由 CSS 隐藏
    非标题栏直接子内容；不碰草稿 / phase / tbPos / 号码牌，收起后页面完全可点 */
const collapsed = ref(false);

const rootEl = ref<HTMLElement | null>(null);
const overlayLayer = ref<HTMLElement | null>(null);
const toolbarEl = ref<HTMLElement | null>(null);
/** 已选清单本身（删到 0 项时把焦点放在这里，不丢回页面） */
const listEl = ref<HTMLElement | null>(null);
const exitDlg = ref<HTMLDialogElement | null>(null);
const noticeDlg = ref<HTMLDialogElement | null>(null);
const openDlg = ref<HTMLDialogElement | null>(null);
const rulesResetDlg = ref<HTMLDialogElement | null>(null);

const follower = new ElementFollower();
let pick: PickController;
let pickLayer: HTMLElement | null = null;
let warnTimer: ReturnType<typeof setTimeout> | null = null;
let infoTimer: ReturnType<typeof setTimeout> | null = null;
let hoverBox: HTMLElement | null = null;
/** 当前页内标记（序号牌 / 预览标记），每次重画全部换新 */
let markerBoxes: HTMLElement[] = [];
/**
 * 进入预览那一刻每项的页面坐标（视口矩形 + 当时的滚动位置）。彻底移除后元素没有矩形，
 * 它的标记一直用这份缓存，改别的项、删掉别的项都不会让它坍缩（N7）
 */
const baseRects = new WeakMap<Element, { left: number; top: number; width: number; height: number }>();
/** 正在保存：按钮当场变灰并把文字换成进行时（「正在保存…」），不另写原因 */
const saving = ref(false);
let finished = false;

const sitePattern = computed(() => deriveScopePattern(props.url));
const scopeHint = computed(() => scopeUnavailableHint(props.url));
const lastSelIndex = computed(() => (lastSel.value ? selEls.value.indexOf(lastSel.value) : -1));
const lastSelName = computed(() => (lastSel.value ? describeElement(lastSel.value) : ''));
/** 第 2 步的已选清单：序号与页面上的号码牌同源（core/wizard-logic.ts selectionRows） */
const selectionRows = computed<SelectionRow<Element>[]>(() => buildSelectionRows(selEls.value, describeElement));

/** 选内容清单的一行：序号行 + 它对应的草稿（旧项才有）+「同类一起」那组的命中数（勾选框出现与否的依据） */
interface PickRow extends SelectionRow<Element> {
  draft: Draft | null;
  sameHits: number;
}

const pickRows = computed<PickRow[]>(() =>
  selectionRows.value.map((row) => {
    const draft = drafts.value.find((d) => d.el === row.el) ?? null;
    // 新选的还没有草稿：当场量一遍「同类一起」会命中几个（行内的 N）
    const sameHits = draft
      ? draft.sameHits
      : countCandidateHits(document, generateCandidates(row.el, { onlyThis: false }));
    return { ...row, draft, sameHits };
  }),
);

/**
 * 「勾谁看谁」的焦点（#82）：页面上一次只亮这一行的组。勾选即聚焦，点已勾选的行把焦点挪过去；
 * 焦点只是看哪个组的标记，不改任何设置。空 = 现在没有亮着的组
 */
const sameFocusEl = shallowRef<Element | null>(null);
/** 懒加载重算（#88）：页面变更后去抖重算草稿计数；句柄随向导卸载一起撤 */
let draftObserver: MutationObserver | null = null;
let draftTimer: ReturnType<typeof setTimeout> | null = null;
/** body 还没解析出来时等 DOM 就绪再挂观察的监听（#186）：卸载时要摘掉，别让它在收尾后再 observe */
let onDomReadyForDraft: (() => void) | null = null;
/**
 * 本次点选里、还没有草稿的元素勾没勾「一起收起」：进看效果建草稿时用（newDraft）。
 * 元素被取消选择时清掉——再点回来按默认值当新的一项，不记住上一次的勾
 */
const sameWanted = new Map<Element, boolean>();

/** 清单行的稳定 key：跟着元素走，删掉中间一行时不会把 DOM 内容挪到别的元素名下 */
const rowKeys = new WeakMap<Element, number>();
let rowKeySeq = 0;
function rowKey(el: Element): number {
  let key = rowKeys.get(el);
  if (key === undefined) rowKeys.set(el, (key = ++rowKeySeq));
  return key;
}

/** 「第 N 步 / 共 M 步」里的两个数（1 起）；「标题和图标」是单步，界面不显示进度 */
const progressTotal = computed(() => wizardStep(props.mode, phase.value).total);
const progressText = computed(() => {
  const { index, total } = wizardStep(props.mode, phase.value);
  return t.value.wizard.progress(index, total);
});
const exitBody = computed(() => {
  // 按钮点进来时可能什么都没有改（#123）：如实说明为什么要问这一次
  if (!isDirty()) return t.value.wizard.exitBodyNoChanges;
  // 「收起内容」草稿里有多少项就提示多少；「标题和图标」没有清单，只说标题与图标不保存
  return previewCount.value > 0 ? t.value.wizard.exitBodySelected(previewCount.value) : t.value.wizard.exitBodyPlain;
});

/**
 * 「下一步：看效果（N）」里的 N：旧规则带来的草稿本来就要进看效果，
 * 不能只数本次新点选的元素（否则一进来是 0，按钮还会被禁用）。
 */
const previewCount = computed(() => {
  const picked = new Set(selEls.value);
  const covered = new Set<Element>();
  let n = 0;
  for (const d of drafts.value) {
    // 旧规则带来的草稿一定会进看效果；本次新选的只有在选择集里才留下（取消了的不算）
    if (!d.sourceRuleId && !(d.el && picked.has(d.el))) continue;
    n++;
    if (d.el) covered.add(d.el);
  }
  for (const el of selEls.value) if (!covered.has(el)) n++;
  return n;
});

// 第 1 步的实时预览：改标题 / 换图标时立刻压到标签页上（不点保存也能看到）
watch([titleInput, iconData], () => {
  if (phase.value === 'title') pushTitlePreview();
});

onMounted(() => {
  const root = rootEl.value?.getRootNode();
  if (root instanceof ShadowRoot) adoptWizardStyles(root);
  // 全屏透明捕获层：拾取期接管全部指针事件（见 pick-controller 注释）
  pickLayer = document.createElement('div');
  pickLayer.dataset.testid = 'pm-pick-layer';
  overlayLayer.value?.appendChild(pickLayer);
  pick = new PickController({
    // 插件自己的界面（向导宿主、以及别的宿主）都不算页面元素
    isOwnNode: (n) => isOwnUiNode(n),
    onHoverChange: updateHoverBox,
    onSelectionChange: onSelectionChange,
    onWarnTooBig: () => showWarn(t.value.wizard.warnTooBig),
    onWarnNested: (kind) => showWarn(kind === 'shadow' ? t.value.wizard.warnNestedShadow : t.value.wizard.warnNestedIframe),
  });
  pick.attach(pickLayer);
  // 一打开就用旧规则铺草稿起点（#69 / #81 无首次模式）：没有配置时是空清单，同一条路
  initEditDrafts();
  // 打开时不是点选阶段（「标题和图标」是单步表单）：捕获层不接管指针，光标也不改
  if (phase.value !== 'pick') {
    pickLayer.style.display = 'none';
    pick.stop();
    document.documentElement.style.cursor = '';
    // 标题和图标：一打开就把默认标题 / 图标压到当前标签页（之后每次改动即时更新，退出时运行时还原）
    pushTitlePreview();
  } else {
    document.documentElement.style.cursor = 'crosshair';
  }
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('resize', reclampToolbar);
  // 懒加载信息流（#88）：页面随滚动补内容，同类的命中数与组员标记要跟着重算。
  // MutationObserver 事件驱动，不做轮询；去抖 300ms 免得被高频变更拖着跑
  draftObserver = new MutationObserver(() => {
    if (draftTimer) clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      drafts.value.forEach(refreshDraftCounts);
      if (phase.value === 'pick') {
        refreshSameNav(); // 信息流补内容：导航计数与强调框跟着重算（#140）
        renderMarkers();
      }
    }, 300);
  });
  // document_start 注入后 body 可能还没解析出来（#186）：等 DOM 就绪再挂观察。
  // 还没挂上时收不到变更通知没有影响——打开向导的时刻页面本来就还没有新内容
  if (document.body) {
    draftObserver.observe(document.body, { childList: true, subtree: true });
  } else {
    onDomReadyForDraft = () => draftObserver?.observe(document.body!, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', onDomReadyForDraft, { once: true });
  }
});

onBeforeUnmount(() => {
  document.documentElement.style.cursor = '';
  window.removeEventListener('keydown', onKeyDown, true);
  window.removeEventListener('resize', reclampToolbar);
  draftObserver?.disconnect();
  if (onDomReadyForDraft) document.removeEventListener('DOMContentLoaded', onDomReadyForDraft);
  if (draftTimer) clearTimeout(draftTimer);
  pick?.stop();
  follower.stop();
  // 兜底：任何退出路径都撤掉预览样式（不允许免保存临时隐藏）
  void props.setDraft(null);
  if (warnTimer) clearTimeout(warnTimer);
  if (infoTimer) clearTimeout(infoTimer);
});

function showWarn(text: string) {
  warnText.value = text;
  if (warnTimer) clearTimeout(warnTimer);
  warnTimer = setTimeout(() => (warnText.value = ''), 4000);
}

/** 中性轻提示（不是错误）：说一句刚发生了什么，2 秒后消失 */
function showInfo(text: string) {
  infoText.value = text;
  if (infoTimer) clearTimeout(infoTimer);
  infoTimer = setTimeout(() => (infoText.value = ''), 2000);
}

// ---------- 键盘：向导级 Esc（N9） ----------

/** 是否有浮层打开（确认框）：有就让浮层自己按原生行为处理 Esc */
function overlayOpen(): boolean {
  return (
    !!exitDlg.value?.open || !!noticeDlg.value?.open || !!openDlg.value?.open || !!rulesResetDlg.value?.open
  );
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || e.isComposing || e.keyCode === 229) return;
  // 向导打开期间 Esc 归向导：不让页面自己的 Esc 快捷键同时触发
  e.stopPropagation();
  if (wizardEscAction(e, { overlayOpen: overlayOpen() }) === 'requestExit') {
    e.preventDefault();
    requestExit();
  }
  // 有浮层时不 preventDefault：浏览器把这次 Esc 当作关闭请求，关掉最上面的浮层
}

// ---------- 退出 ----------

/**
 * 请求退出（#123）：
 * - 点「退出设置」按钮一律先问一次——这颗按钮挨着可拖动的标题栏，误触一次就白干；
 * - Esc 只在真有未保存的东西时才问（Esc 是有意按的，没必要每次都拦）。
 */
function requestExit(always = false) {
  if (!always && !isDirty()) {
    void finish(false);
    return;
  }
  exitDlg.value?.showModal();
}

/** 编辑已有规则：打开那一刻的草稿快照，用来判断「有没有改过」（没改过就直接退出，不弹确认框） */
let baselineDrafts: string | null = null;

/** 草稿的可比较快照：名称、候选、方式、同类、范围、来源规则 id（不含界面展开状态） */
function draftSignature(): string {
  return JSON.stringify(
    drafts.value.map((d) => [
      d.sourceRuleId ?? null,
      draftName(d),
      d.candidates,
      d.strategy,
      d.onlyThis,
      d.scope ?? null,
    ]),
  );
}

/**
 * 图标三态是否相同（#121）：对象引用每次读取都可能不同，必须按 kind + id 比值，
 * 否则每次打开向导都会被判成「改过」。
 */
function sameIcon(a: TabIcon, b: TabIcon): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind !== 'preset' || (b.kind === 'preset' && a.id === b.id);
}

/** 有没有还没保存的东西：标题表单看标题 / 图标是否动过，「收起内容」看草稿或选择有没有变 */
function isDirty(): boolean {
  if (phase.value === 'title') {
    return titleInput.value.trim() !== props.initialTitle.trim() || !sameIcon(iconData.value, props.initialIcon);
  }
  if (baselineDrafts !== null && draftSignature() !== baselineDrafts) return true;
  // 还没进过看效果的新选（草稿未建）：选择集里有旧草稿之外的元素就是改过
  return selEls.value.some((el) => !drafts.value.some((d) => d.el === el));
}

function onExitClose() {
  const dlg = exitDlg.value;
  if (!dlg) return;
  const choice = dlg.returnValue;
  dlg.returnValue = ''; // Esc 不设置返回值，必须清掉上一次的
  if (choice === 'exit') void finish(false);
}

/**
 * 结束向导：先等预览样式真正撤掉，再通知运行时（运行时随后恢复正式样式）。
 * `notice` 是保存后给用户的轻提示（例如 0 条规则时说明只有标签页名字变了），由运行时在关掉向导后显示。
 */
async function finish(saved: boolean, notice?: string) {
  if (finished) return;
  finished = true;
  if (!saved) {
    const res = await props.setDraft(null);
    if (!res.ok) console.warn('[PageMask] preview clear failed', res.error);
  }
  emit('done', saved, notice);
}

// ---------- 两步流程的骨架（#81） ----------

/** 右下角前进：选内容 → 看效果（「标题和图标」没有下一步；看效果的右下角直接是「保存」） */
function goNext() {
  const next = wizardNextPhase(props.mode, phase.value);
  if (next === 'pick') enterPick();
  else if (next === 'preview') void enterPreview();
}

/** 左下角回退：看效果 → 选内容（选内容没有上一步；「标题和图标」是单步表单） */
function goBack() {
  const prev = wizardPrevPhase(props.mode, phase.value);
  if (prev === 'pick') void backToPick();
}

/** 点选阶段的页内状态：十字光标 + 全屏捕获层 + 已有序号牌 */
function enterPickUI() {
  document.documentElement.style.cursor = 'crosshair';
  if (pickLayer) {
    pickLayer.style.display = '';
    pick.attach(pickLayer);
  }
  renderMarkers();
}

function enterPick() {
  phase.value = 'pick';
  enterPickUI();
}

/** 把标题 / 图标实时压到当前标签页（标题表单专用；退出时由内容脚本运行时还原） */
function pushTitlePreview() {
  props.previewDisguise(titleFromInput(titleInput.value, props.initialTitle), iconData.value);
}

// ---------- 草稿起点（#69 / #81 无首次模式） ----------

/** 依次用候选选择器找页面上第一个命中的元素（不算插件自己的界面） */
function firstElementFor(selectors: readonly string[]): Element | null {
  for (const sel of selectors) {
    let found: NodeListOf<Element>;
    try {
      found = document.querySelectorAll(sel);
    } catch {
      continue;
    }
    for (const el of found) if (!isOwnUiNode(el)) return el;
  }
  return null;
}

function sameSelectors(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((s, i) => s === b[i]);
}

/**
 * 打开这一刻用旧规则铺草稿：字段原样搬过来，候选选择器不重新生成（不悄悄改掉用户的选择）。
 * 「只这一个 / 同类一起」按候选与两种生成结果比对；都对不上时保留规则里存的那个值。
 */
function initialDrafts(): Draft[] {
  const out: Draft[] = [];
  for (const rule of props.initialRules ?? []) {
    const el = firstElementFor(rule.candidates);
    const candidates = [...rule.candidates];
    const autoName = rule.elementName;
    const hits = countCandidateHits(document, candidates);
    let sameHits = hits;
    let onlyThis = rule.onlyThis;
    if (el) {
      sameHits = countCandidateHits(document, generateCandidates(el, { onlyThis: false }));
      if (sameSelectors(candidates, generateCandidates(el, { onlyThis: true }))) onlyThis = true;
      else if (sameSelectors(candidates, generateCandidates(el, { onlyThis: false }))) onlyThis = false;
    }
    out.push({
      key: ++draftKeySeq,
      el: el ? markRaw(el) : null,
      name: rule.elementName,
      autoName,
      strategy: rule.strategy,
      onlyThis,
      candidates,
      hits,
      sameHits,
      sourceRuleId: rule.id,
      scope: rule.scope,
      expanded: false,
      selectorText: candidates.join('\n'),
    });
  }
  return out;
}

/** 进入看效果前量一遍每项在页面上的位置（彻底移除的元素之后没有矩形，靠这份缓存跟着页面滚） */
function captureBaseRects() {
  for (const d of drafts.value) {
    if (!d.el) continue;
    // 这一组里所有会被收起的元素都量一遍：彻底移除之后它们没有矩形，靠这份缓存标位置。
    // 「一起收」会带上的那些也要量——默认只收这一个（#76）时它们不在候选里，等勾选框一勾、
    // 预览把元素移除，就再也量不到了，虚线框会失去定位依据
    const els = new Set<Element>(matchedElements(d));
    for (const sel of generateCandidates(d.el, { onlyThis: false })) {
      let list: NodeListOf<Element>;
      try {
        list = document.querySelectorAll(sel);
      } catch {
        continue;
      }
      for (const el of list) {
        if (!isOwnUiNode(el)) els.add(el);
      }
    }
    for (const el of els) {
      const r = el.getBoundingClientRect();
      baseRects.set(el, { left: r.left + window.scrollX, top: r.top + window.scrollY, width: r.width, height: r.height });
    }
  }
}

/**
 * 打开时用旧规则铺草稿起点（#81 无首次模式）：站点还没有配置时是空清单，同一条路。
 * 已收起的项（草稿里找得到元素的）直接进选择集：统一编号、进同一份清单（#81）。
 */
function initEditDrafts() {
  drafts.value = initialDrafts();
  baselineDrafts = draftSignature();
  captureBaseRects();
  for (const d of drafts.value) if (d.el) pick.add(d.el);
  if (phase.value === 'pick') renderMarkers();
}

/**
 * 选择集变化（toggle、调整层级、删行、初始铺底都汇到这里）：
 * - 点击**带标记的组员**（勾了同类的行亮出来的那组）= 取消那条规则：整行从清单去掉、整组解标记，
 *   等同行上的 ✕（#82 交接铁律：点击语义永远跟着看得见的标记走）；
 * - 取消一项 = 从这次的清单里去掉，它的草稿一并去掉（#81：点已收起的项等同清单里点它的 ✕）；
 *   再点回来时按默认值当新的一项（默认收起方式、同类默认只收一个）。
 * - 失效行的「重新选」：下一次加进来的元素替换那条草稿——一个手势只许一个意思。
 */
function onSelectionChange(els: Element[]) {
  const prev = selEls.value;
  if (els.length > prev.length) {
    const added = els.find((e) => !prev.includes(e));
    if (added && isMarkedGroupMember(added)) {
      cancelFocusedRow(els, added);
      void pushPageCss(); // 整组解标记：大组的描边样式一并撤掉
      return;
    }
  }
  if (pendingReplace) {
    const added = els.length > prev.length ? els.find((e) => !prev.includes(e)) : null;
    if (added) {
      const target = pendingReplace;
      pendingReplace = null;
      replaceDraftElement(target, added);
      // 重选的元素留在选择集里（统一编号）：草稿已带着它，不会被当成新的一项
      selEls.value = els;
      lastSel.value = pick.last;
      renderMarkers();
      void pushPageCss(); // 重选可能换了这一项的候选：亮着的组跟着换
      return;
    }
  }
  if (els.length < prev.length) {
    const gone = new Set(prev.filter((e) => !els.includes(e)));
    drafts.value = drafts.value.filter((d) => !(d.el && gone.has(d.el)));
    let focusCleared = false;
    for (const el of gone) {
      // 被取消的项不再记住「勾了同类」；亮着的组跟着收回
      sameWanted.delete(el);
      if (sameFocusEl.value === el) {
        sameFocusEl.value = null;
        focusCleared = true;
      }
    }
    selEls.value = els;
    lastSel.value = pick.last;
    renderMarkers();
    if (focusCleared) void pushPageCss();
    return;
  }
  selEls.value = els;
  lastSel.value = pick.last;
  renderMarkers();
}

/** 重算这一条的两个数（hits / sameHits） */
function refreshDraftCounts(d: Draft) {
  const [counts] = draftHitCounts(
    [d],
    (el) => generateCandidates(el, { onlyThis: false }),
    (selectors) => countCandidateHits(document, selectors),
  );
  if (!counts) return;
  d.hits = counts.hits;
  d.sameHits = counts.sameHits;
}

/**
 * 换掉一条草稿的元素之后：旧位置如果还在本次选择集里、又没有别的草稿用它，就先移出去。
 * 否则回到看效果时会被当成「新点选的元素」再补一条重复规则。
 */
function dropOldSelection(old: Element | null, d: Draft, next: Element) {
  if (!old || old === next) return;
  if (drafts.value.some((x) => x !== d && x.el === old)) return;
  pick.remove(old);
}

/** 用重新选到的地方替换这一条：旧规则 id 不变，保存时仍是更新同一条（不新增重复规则） */
function replaceDraftElement(d: Draft, el: Element) {
  const old = d.el;
  d.el = markRaw(el);
  d.candidates = generateCandidates(el, { onlyThis: d.onlyThis });
  d.selectorText = d.candidates.join('\n');
  d.selectorError = '';
  // 名字是自动起的就跟着换；用户改过的名字保留
  const autoName = describeElement(el);
  if (d.name.trim() === d.autoName.trim()) d.name = autoName;
  d.autoName = autoName;
  refreshDraftCounts(d);
  dropOldSelection(old, d, el);
}

/** 行内「重新选这一项」：下一处点到的就是这一条的新位置（失效项也走这里） */
function reselectDraft(d: Draft) {
  pendingReplace = d;
  if (phase.value !== 'pick') void backToPick();
  showInfo(t.value.wizard.reselectHint);
}

/** 这一条要用的范围：旧规则带来的原样保留，没有才用底部三选一（#69） */
function draftScope(d: Draft): Scope {
  // 底部整批的范围控件已删（#76）：新选的没有自带范围时就是整个网站，要改在行内「调整」里改
  return d.scope ?? { type: 'all' };
}

function draftScopeType(d: Draft): ScopeChoice {
  return draftScope(d).type;
}

/** 默认行上的一句话摘要：收起方式 · 范围；勾了同类的行再报一次具体的个数（#82）；失效项换一句（#69、审查第 8 条） */
function draftSummary(d: Draft): string {
  if (!d.el) return t.value.wizard.staleSummary;
  const base = `${t.value.common.strategy[d.strategy]} · ${scopeHumanLabel(draftScope(d))}`;
  return onlyOneOf(d) ? base : `${base} · ${t.value.wizard.sameGroupSummary(d.hits)}`;
}

/** 失效说明：为什么这条可能没用了 + 它在哪些页面收起 */
function staleText(d: Draft): string {
  return t.value.wizard.staleWhy(draftName(d), scopeHumanLabel(draftScope(d)));
}

function setDraftScope(d: Draft, type: ScopeChoice) {
  const pattern = sitePattern.value;
  d.scope = type === 'all' || !pattern ? { type: 'all' } : { type, patterns: [{ ...pattern }] };
  void applyPreview();
}

/**
 * 高级：选择器原文（从旧编辑面板原样搬来）——每行一个合法选择器，且保存前每行都要在当前页面命中；
 * 逐行检查并指出第几行。成功后同步这条草稿的候选、元素与两个命中数。
 */
function saveSelectors(d: Draft) {
  const text = (d.selectorText ?? '').trim();
  if (!text) {
    d.selectorError = t.value.wizard.errorEmpty;
    return;
  }
  const lines = text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const [i, line] of lines.entries()) {
    if (!isSafeSelector(line)) {
      d.selectorError = t.value.wizard.errorInvalid(i + 1);
      return;
    }
    if (selectorHitsElement(line) < 1) {
      d.selectorError = t.value.wizard.errorNoHit(i + 1);
      return;
    }
  }
  d.selectorError = '';
  d.candidates = lines;
  d.selectorText = lines.join('\n');
  const old = d.el;
  const found = firstElementFor(lines);
  d.el = found ? markRaw(found) : null;
  refreshDraftCounts(d);
  if (found) dropOldSelection(old, d, found);
  void recaptureAndPreview();
}

/**
 * 「恢复网站原来的标题和图标」（#99）：写回「没设置过」的状态，关掉向导并给一句提示。
 * 不碰收起规则与开关状态——它只撤销标题 / 图标这一项定制。
 */
async function resetTitleIcon() {
  if (saving.value || finished) return;
  saving.value = true;
  try {
    const storage = createPageMaskStorage(browser.storage.local);
    const site = siteKey(props.url)!;
    let saved;
    try {
      saved = await storage.updateProfile(site, (p) => {
        Object.assign(p, titleIconResetPatch());
      });
    } catch (e) {
      showWarn(t.value.wizard.warnSaveFailedTitleOnly(e instanceof Error ? e.message : String(e)));
      return;
    }
    if (!saved) {
      noticeText.value = t.value.wizard.noticeGone;
      noticeDlg.value?.showModal();
      return;
    }
    await finish(true, t.value.wizard.titleResetNotice);
  } finally {
    saving.value = false;
  }
}

/** 打开复位确认框：连点两次不重复 showModal（对已打开的 dialog 再调会抛错） */
function askRulesReset() {
  if (saving.value || finished) return;
  const dlg = rulesResetDlg.value;
  if (dlg && !dlg.open) dlg.showModal();
}

/** 确认框关了：只有点「恢复内容」才真正写；Esc / 点外面 = 回向导继续设置 */
function onRulesResetClose() {
  const dlg = rulesResetDlg.value;
  if (!dlg) return;
  const confirmed = dlg.returnValue === 'confirm';
  dlg.returnValue = ''; // Esc 不设置返回值，必须清掉上一次的
  if (confirmed) void resetHiddenItems();
}

/**
 * 「恢复网站原来的内容」（#160）：只把 hideRules 置空，标题 / 图标 / 开关 / 灰度一概不动。
 * 先撤掉选内容阶段注入的「同类描边」草稿样式——finish(true) 只负责结束向导，不会替我们清，
 * 留着的话页面上会有一圈描边悬在那儿。
 */
async function resetHiddenItems() {
  if (saving.value || finished) return;
  saving.value = true;
  try {
    const cleared = await props.setDraft(null);
    if (!cleared.ok) {
      showWarn(t.value.wizard.warnNotCleared);
      return;
    }
    const storage = createPageMaskStorage(browser.storage.local);
    const site = siteKey(props.url)!;
    let saved;
    try {
      saved = await storage.updateProfile(site, (p) => {
        Object.assign(p, hiddenItemsResetPatch());
      });
    } catch (e) {
      showWarn(t.value.wizard.warnSaveFailed(e instanceof Error ? e.message : String(e)));
      return;
    }
    if (!saved) {
      noticeText.value = t.value.wizard.noticeGoneRules;
      noticeDlg.value?.showModal();
      return;
    }
    await finish(true, t.value.wizard.rulesResetNotice);
  } finally {
    saving.value = false;
  }
}

/**
 * 「标题和图标」的保存（#81）：写标题 / 图标 / 开关，不碰已有的收起规则，向导直接关闭。
 * 站点还没有配置时，这份配置在这里第一次写入（0 条规则 + 清爽态）。
 * 已有站点处在原样态时，先问一次「现在打开」（#159）；两条路都完成保存。
 */
async function saveTitleOnly() {
  if (saving.value || saveBusy || finished) return;
  saveBusy = true;
  try {
    const ctx = await latestSwitchContext();
    const choice = await askOpenIfNeeded(ctx);
    if (choice === 'cancel') return; // 回向导：不保存、不开开关，预览还在
    await persistTitleOnly(ctx, choice === 'open');
  } finally {
    saveBusy = false;
  }
}

/** 真正写入「标题和图标」：先撤预览，再按用户的选择写开关，最后关向导 */
async function persistTitleOnly(ctx: SaveSwitchContext, openNow: boolean) {
  saving.value = true;
  try {
    const cleared = await props.setDraft(null);
    if (!cleared.ok) {
      showWarn(t.value.wizard.warnNotCleared);
      return;
    }
    const storage = createPageMaskStorage(browser.storage.local);
    const site = siteKey(props.url)!;
    // 清爽态不弹框、也不改开关；原样态按选择——「先保持原样」保持原值，「现在打开」写清爽态。
    // 新站点保存即建站，走 titleOnlyPatch 的默认清爽态（#81）
    const switchState = savedSwitchState(ctx, openNow) ?? ctx.state;
    const patch = titleOnlyPatch({
      title: titleInput.value,
      icon: iconData.value,
      fallbackTitle: props.initialTitle,
      keepState: ctx.exists ? switchState : undefined,
    });
    let saved;
    try {
      // 只改标题 / 图标 / 开关：不碰已有的收起规则（新站点本来就没有规则）
      saved = await storage.updateProfile(
        site,
        (p) => {
          Object.assign(p, patch);
        },
        { create: !props.hasProfile },
      );
    } catch (e) {
      showWarn(t.value.wizard.warnSaveFailedTitleOnly(e instanceof Error ? e.message : String(e)));
      return;
    }
    if (!saved) {
      noticeText.value = t.value.wizard.noticeGone;
      noticeDlg.value?.showModal();
      return;
    }
    // 0 条规则：清爽态保存后给一句轻提示，说明生效的是标签页名字（#53）。
    // 原样态选了「先保持原样」时标题根本没换，这句话是假的，不发（#159）
    await finish(
      true,
      switchState === 'disguised'
        ? t.value.wizard.zeroRuleNotice(titleFromInput(titleInput.value, props.initialTitle))
        : undefined,
    );
  } finally {
    saving.value = false;
  }
}

// ---------- 选择阶段 ----------

/**
 * 「选大一点 / 选小一点」：对旧项照常可用（旧项在草稿里，就是当前选择的一部分，#81）。
 * 换了元素的草稿跟着换（候选、名字、两个数都重算）；被去掉的那一项由 onSelectionChange
 * 统一按取消处理（草稿一并去掉）。
 */
function adjust(dir: 'bigger' | 'smaller') {
  const el = pick.last;
  if (!el) return;
  const selBefore = selEls.value;
  const d = drafts.value.find((x) => x.el === el) ?? null;
  pick.adjust(dir);
  const next = pick.last;
  if (!d || !next || next === el) return; // 新项还没有草稿；或这一项被去掉 / 没换成
  if (selBefore.includes(next)) return; // 选大成已选中的另一项：这一项已按取消处理
  replaceDraftElement(d, next);
}

/**
 * 清单里删掉这一项：只删这一项（选择集、号码牌、清单三处同步重排），焦点交给下一行。
 * 删到 0 项时焦点落在清单上——按钮都被移除了，不能让焦点掉回页面。
 */
async function removeSelected(row: SelectionRow<Element>) {
  pick.remove(row.el); // 选择集变化会经 onSelectionChange 同步号码牌与清单
  await nextTick();
  const left = selEls.value.length;
  if (left === 0) {
    listEl.value?.focus();
    return;
  }
  const nextSeq = Math.min(row.seq, left);
  toolbarEl.value?.querySelector<HTMLElement>(`[data-testid="pm-sel-${nextSeq}-remove"]`)?.focus();
}

/** 清单右上角「全部取消选择」：去掉全部已选，仍留在点选模式（不想一个个点掉时的出口） */
async function clearSelection() {
  pick.clear(); // 选择集变化会经 onSelectionChange 同步序号牌与工具条
  await nextTick();
  listEl.value?.focus();
}

// ---------- 页内标记 ----------

function makeBox(...classes: string[]): HTMLElement {
  const el = document.createElement('div');
  el.className = ['pm-wiz-box', ...classes].join(' ');
  overlayLayer.value?.appendChild(el);
  return el;
}

function updateHoverBox(el: Element | null) {
  if (hoverBox && (!el || phase.value !== 'pick')) {
    follower.drop(hoverBox);
    hoverBox = null;
  }
  if (!el || phase.value !== 'pick') return;
  if (!hoverBox) hoverBox = makeBox('pm-wiz-hover');
  follower.trackLive(el, hoverBox);
}

function clearMarkers() {
  for (const box of markerBoxes) follower.drop(box);
  markerBoxes = [];
}

function addBadge(box: HTMLElement, seq: number | string, onClick?: () => void) {
  const tag = document.createElement(onClick ? 'button' : 'span');
  tag.className = 'pm-wiz-badge';
  tag.textContent = String(seq);
  if (onClick) {
    const btn = tag as HTMLButtonElement;
    btn.type = 'button';
    btn.tabIndex = -1; // 鼠标捷径：跳转到清单里对应的行；键盘入口是清单本身，不在这里
    btn.setAttribute('aria-label', t.value.wizard.badgeJump(Number(seq)));
    btn.dataset.testid = `pm-marker-${seq}`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
  } else {
    tag.setAttribute('aria-hidden', 'true');
    // 文字号牌（同类导航的位置）用固定 testid：数字号牌的「pm-badge-<seq>」前缀
    // 被多个 E2E 用前缀选择器统计，本地化文案（第 1 / 2 个）会污染计数（0.8.12 审查）
    tag.dataset.testid = typeof seq === 'number' ? `pm-badge-${seq}` : 'pm-badge-same-pos';
  }
  box.appendChild(tag);
}

/** 号码牌的固定尺寸：定位要先知道尺寸，才能算在元素外面放不放得下 */
const BADGE_SIZE = { width: 24, height: 24 };
/** 「盖住」预览 / 量位置时，一条规则的同类组最多数到多少个成员（防刷屏封顶，超出部分不画） */
const MATCHED_LIMIT = 30;

/**
 * 号码牌自己一个盒子（#52）：位置由 badgePlacement 算在元素边界外侧，不再压在元素自己的文字上。
 * 元素贴着视口顶边时号码牌翻到元素下方；实在没有空间才回到内侧，并改用半透明底。
 * 密行（元素比牌子还矮）改为跨在左上角（#82 标记语言）：浮在上方会落在上一行里，
 * 读起来像上一行的编号；跨角则归属一眼确定。
 */
function badgePlace(box: HTMLElement, size = BADGE_SIZE) {
  return (rect: MarkerRect): MarkerRect => {
    const placed = badgePlacement(rect, size, { width: window.innerWidth, height: window.innerHeight });
    box.classList.toggle('inside', placed.side === 'inside');
    box.classList.toggle('corner', placed.side === 'corner');
    return { left: placed.left, top: placed.top, width: size.width, height: size.height };
  };
}

/**
 * 一个标记 = 元素上的框 + 框外面的号码牌。框跟元素严丝合缝（waitBoxOn 用它核对），
 * 号码牌单独跟同一个元素但位置外移。
 */
function addMarker(opts: {
  seq: number;
  kind: 'selected' | 'blank' | 'mask' | 'ghost' | 'same-current';
  el?: Element;
  /** 彻底移除的元素没有矩形，用它进入预览时缓存的页面坐标 */
  ghost?: MarkerRect;
  jump?: () => void;
  /** 只有这一项自己带号码牌；同组里的其它元素只画框（同一个数字重复出现反而更乱） */
  badge?: boolean;
  /** 号码牌的文字（0.8.11，#140）：同类导航的位置文字「第 i / N 个」，缺省用序号 */
  badgeText?: string;
  testid?: string;
}): HTMLElement {
  const box = makeBox(`pm-wiz-${opts.kind}`);
  box.dataset.testid = opts.testid ?? `pm-box-${opts.seq}`;
  // 遮罩外观与运行时同一套（mask-color.ts 的 N25 声明坐实）：底色按祖先链算、圆角跟随，
  // 不再硬编码 #f4f4f4（0.8.12 准则审查：深色/彩色页面上预览颜色 ≠ 保存所得）
  if (opts.kind === 'mask' && opts.el) applyMaskAppearance(box, opts.el);
  markerBoxes.push(box);
  if (opts.badge === false) {
    if (opts.ghost) follower.trackGhost(opts.ghost, box);
    else if (opts.el) follower.trackLive(opts.el, box);
    return box;
  }
  const badgeBox = makeBox('pm-wiz-badge-box');
  addBadge(badgeBox, opts.badgeText ?? opts.seq, opts.jump);
  markerBoxes.push(badgeBox);
  const place = badgePlace(badgeBox);
  if (opts.ghost) {
    follower.trackGhost(opts.ghost, box);
    follower.trackGhost(opts.ghost, badgeBox, place);
  } else if (opts.el) {
    follower.trackLive(opts.el, box);
    follower.trackLive(opts.el, badgeBox, place);
  }
  return box;
}

/** 一条草稿实际会在页面上收起的元素（按候选逐个查、去重，这一项自己排最前）；只用于画标记，封顶防刷屏 */
function matchedElements(d: Draft): Element[] {
  if (!d.el) return [];
  const out: Element[] = [d.el];
  const seen = new Set<Element>([d.el]);
  for (const sel of d.candidates) {
    let list: NodeListOf<Element>;
    try {
      list = document.querySelectorAll(sel);
    } catch {
      continue;
    }
    for (const el of list) {
      if (seen.has(el) || isOwnUiNode(el)) continue;
      seen.add(el);
      out.push(el);
      if (out.length > MATCHED_LIMIT) return out;
    }
  }
  return out;
}

/** 按当前阶段整体重画标记：编号每次都按最新顺序重新计算（N6）；全部同步完成，没有延时登记（N21） */
function renderMarkers() {
  clearMarkers();
  if (phase.value === 'pick') {
    // 序号与清单同源：selectionRows 的第几行就是号码牌上的数字（删掉一项后一起重排）。
    // 已收起的项也在选择集里（#81）：与新选的统一编号，点它就是取消。
    // 勾了同类后成员在亮出的组里：只挂号牌不画橙框（0.8.11 目检改判）——
    // 组关系归虚线描边、当前成员归实线强调框，三种框叠在一颗元素上读不出组
    for (const row of pickRows.value) {
      const inFocusedGroup = row.el === sameFocusEl.value || isMarkedGroupMember(row.el);
      const box = addMarker({ seq: row.seq, kind: inFocusedGroup ? 'ghost' : 'selected', el: row.el });
      if (row.el === lastSel.value) box.classList.add('current');
    }
    // 勾了同类的行：整组用一条描边样式规则亮出来（pushPageCss 注入，#100 起小组与大组同一形态）；
    // 当前正在查看的成员另加实线强调框 + 位置号牌（0.8.11 目检 E3：只靠框位置读不出
    // 「现在看的是哪一个」，号牌写「第 i / N 个」把两边绑死）。
    // 当前成员同时是已选行（有自己的序号牌）时不叠位置号牌：两块牌同位会重叠（0.8.12 审查）。
    // 看效果阶段不亮组——整组已真实收起，所见即答案（#82）
    if (sameFocusEl.value && sameNavMembers.value.length > 0) {
      const cur = sameNavMembers.value[sameNavIndex.value];
      if (cur) {
        const isSelRow = pickRows.value.some((r) => r.el === cur);
        addMarker({
          seq: 0,
          kind: 'same-current',
          el: cur,
          ...(isSelRow ? { badge: false as const } : { badgeText: t.value.wizard.sameNavPosition(sameNavIndex.value + 1, sameNavCount.value) }),
          testid: 'pm-box-same-current',
        });
      }
    }
    return;
  }
  drafts.value.forEach((d, i) => {
    if (!d.el) return; // 失效项不画标记：页面上没有它，行里另有说明与「重新选」
    const jump = () => flashRow(i + 1);
    if (d.strategy === 'remove') {
      // 彻底移除：元素已没有矩形，用进入预览时缓存的页面坐标 + 滚动差值跟随，只显示号码牌（N7、N8）
      const base = baseRects.get(d.el);
      if (!base) return;
      addMarker({
        seq: i + 1,
        kind: 'ghost',
        jump,
        ghost: {
          left: base.left - window.scrollX,
          top: base.top - window.scrollY,
          width: base.width,
          height: base.height,
        },
      });
    } else if (d.strategy === 'blank') {
      addMarker({ seq: i + 1, kind: 'blank', el: d.el, jump });
    } else {
      // 方案 C 遮罩：覆盖盒本身就是预览。保存后遮的是这一组里的全部元素，预览也必须盖住全部，
      // 否则用户以为只盖了一个、保存后却多出好几个（#70）
      for (const el of matchedElements(d)) {
        addMarker(el === d.el ? { seq: i + 1, kind: 'mask', el, jump } : { seq: i + 1, kind: 'mask', el, badge: false });
      }
    }
    // 勾了同类也不再加组标记（#82）：整组已经真实收起，「盖住」也盖整组，「消失」成员走上面的幽灵标记
  });
}

/**
 * 点页面上的号码牌 = 滚到清单里对应的行并高亮一下（原来打开弹片，弹片已删）。
 * 动效只在用户没有要求减少动态时加；高亮由 animationend 撤掉，定时器兜底。
 */
function flashRowByTestid(testid: string) {
  const row = toolbarEl.value?.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
  if (!row) return;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  row.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  row.classList.add('flash');
  let timer: ReturnType<typeof setTimeout> | null = null;
  const clear = () => {
    row.classList.remove('flash');
    if (timer) clearTimeout(timer);
    timer = null;
  };
  row.addEventListener('animationend', clear, { once: true });
  timer = setTimeout(clear, reduced ? 1500 : 2000);
}

/** 看效果阶段的号码牌：跳到草稿清单里对应的行 */
function flashRow(index: number) {
  flashRowByTestid(`pm-draft-${index}`);
}

// ---------- 预览 ----------

function newDraft(el: Element): Draft {
  // 默认只收这一个（#76）：预览必须等于保存结果——默认连页面上一样的都收，
  // 用户看到的只是眼前这一个消失，保存后却多没了几个屏幕外的。要一起收就去勾那道框。
  // 勾过「一起收起」的新选项按勾选时的选择建草稿；记录用掉即清（再点回来时按默认值，不记住上一次）
  const onlyThis = sameWanted.get(el) !== true;
  sameWanted.delete(el);
  const candidates = generateCandidates(el, { onlyThis });
  const hits = countCandidateHits(document, candidates);
  const autoName = describeElement(el);
  return {
    key: ++draftKeySeq,
    el: markRaw(el),
    name: autoName,
    autoName,
    strategy: 'remove',
    onlyThis,
    candidates,
    hits,
    sameHits: hits,
    expanded: false,
    selectorText: candidates.join('\n'),
  };
}

async function enterPreview() {
  if (previewCount.value === 0) return;
  phase.value = 'preview';
  document.documentElement.style.cursor = '';
  pick.stop();
  if (pickLayer) pickLayer.style.display = 'none';
  updateHoverBox(null);
  pendingReplace = null;

  // 旧规则带来的草稿全部保留，本次新点选的追加在后面（#69 / #81）。
  // 站点还没有配置时草稿是空的，效果就是给全部新选的建草稿——同一条路
  drafts.value = mergeEditDrafts(
    drafts.value,
    selEls.value,
    (d) => d.sourceRuleId,
    (d) => d.el,
    newDraft,
  );
  // 失效的草稿再看一眼页面（页面加载晚了 / 从别处改回来）：能找回元素就找回
  for (const d of drafts.value) {
    if (d.el) continue;
    const found = firstElementFor(d.candidates);
    if (found) d.el = markRaw(found);
  }
  // 页面可能变过（滚动加载、懒渲染）：两个数都按当前 DOM 重算——「同类一起（N）」的 N 与当前选项无关，
  // 所以切到「只这一个」的行也要重算同类那组（#53）
  const counts = draftHitCounts(
    drafts.value,
    (el) => generateCandidates(el, { onlyThis: false }),
    (selectors) => countCandidateHits(document, selectors),
  );
  drafts.value.forEach((d, i) => {
    d.hits = counts[i]!.hits;
    d.sameHits = counts[i]!.sameHits;
  });

  // 先确认没有预览样式（选择阶段本就没有），再量每项的位置，最后才应用预览
  await props.setDraft(null);
  captureBaseRects();
  await applyPreview();
  const warn = unsavableDraftWarning(drafts.value);
  if (warn) showWarn(warn);
}

async function backToPick() {
  phase.value = 'pick';
  clearMarkers();
  // 草稿不清空：回到预览时沿用（N12）。勾了同类的组在选内容阶段要重新亮出来，走 pushPageCss
  await pushPageCss();
  if (phase.value !== 'pick') return;
  enterPickUI();
}

/**
 * 当前该注入页面的整份样式（走同一条预览通道，#82）：
 * - 看效果阶段：预览样式（预览所见 = 保存所得）；
 * - 选内容阶段：勾了同类的行整片描边（小组与大组同一形态，#100）——一条样式规则，
 *   滚动新加载的元素自动带上，不为成员逐个建 DOM。
 * 两个阶段互斥，任何时刻都只注其中一份。
 */
async function pushPageCss() {
  const outline =
    phase.value === 'pick' ? buildSameGroupOutlineCss([...focusedGroupCandidates()]) : null;
  const preview = phase.value === 'preview' ? buildPreviewCss(drafts.value) : null;
  const css = outline || preview ? [preview, outline].filter((s): s is string => !!s).join('\n') : null;
  await setDraftCss(css);
}

/** 重画标记并应用预览样式（与正式样式同一个生成函数 core/css-builder，预览所见 = 保存所得） */
async function applyPreview() {
  renderMarkers();
  await pushPageCss();
}

/** 改了选择器之后元素可能换了：先撤预览、重新量一遍位置，再应用预览（否则移除项没有矩形可跟） */
async function recaptureAndPreview() {
  await props.setDraft(null);
  captureBaseRects();
  await applyPreview();
}

async function setDraftCss(css: string | null): Promise<boolean> {
  const res = await props.setDraft(css);
  if (!res.ok) showWarn(css ? t.value.wizard.warnPreviewFailed : t.value.wizard.warnPreviewClearFailed);
  return res.ok;
}

// ---------- 行内编辑 ----------

function setStrategy(d: Draft, s: StrategyId) {
  if (d.strategy === s) return;
  d.strategy = s;
  void applyPreview();
}

/**
 * 行内那对选项当前选中的是哪个：切到「只这一个」，或者同类本来就只有 1 个（两边是同一件事）。
 * 只是显示口径——同类只有 1 个时不必改写已生效的候选选择器。
 */
function onlyOneOf(d: Draft): boolean {
  return d.onlyThis || d.sameHits <= 1;
}

/** 删除按钮的读屏名字：改名后跟着变，清空名称时用自动命名（与保存时落库的名字一致） */
function draftName(d: Draft): string {
  return d.name.trim() || d.autoName;
}

/**
 * 选内容行内那道「页面上另外 N 个一样的也一起收起」（#82）：勾上 = 连页面上一样的也一起收，
 * 当场把这一组亮出来（勾谁看谁，一次一组）；取消 = 只收这一个，亮着的组跟着收回。
 * 旧项（已有草稿）换候选；新选的还没有草稿，把选择记到 sameWanted，进看效果建草稿时用
 */
async function onPickSameToggle(row: PickRow, e: Event) {
  const want = (e.target as HTMLInputElement).checked;
  const el = row.el;
  const d = row.draft;
  if (d) {
    const next = generateCandidates(el, { onlyThis: !want });
    if (next.length === 0) {
      // 切换后找不到可靠写法：保持原设置，不让这条变成保存不了的空规则
      (e.target as HTMLInputElement).checked = !want;
      showWarn(t.value.wizard.warnUnstable);
      return;
    }
    d.onlyThis = !want;
    d.candidates = next;
    d.selectorText = next.join('\n');
    d.hits = countCandidateHits(document, next);
  } else {
    sameWanted.set(el, want);
  }
  // 勾上即聚焦这一组；取消勾选时如果亮着的是这一组，一并收回。
  // refreshSameNav 必须在 renderMarkers 之前：它重算 sameNav*，决定强调框画在谁身上
  // （0.8.12 审查：原顺序让换组的一瞬强调框与「第 i / N」挂在上一组成员上闪烁；
  //   且取消「非聚焦行」时无脑清空状态会抹掉亮着那组的导航——统一交给 refreshSameNav）
  sameFocusEl.value = want ? el : sameFocusEl.value === el ? null : sameFocusEl.value;
  refreshSameNav();
  renderMarkers();
  await pushPageCss();
  // 后果要看得见：另外那几个多半在屏幕外——从第一个其他成员开始逐个查看（#140），
  // 导航行给出「第 i / N 个」与上/下一个；一个其他成员都没有时回落到自己的号牌
  if (!want) return;
  await nextTick();
  const start = sameNavMembers.value.findIndex((m) => m !== el);
  sameNavIndex.value = start >= 0 ? start : 0;
  renderMarkers();
  const seq = pickRows.value.find((r) => r.el === el)?.seq ?? 0;
  const target = sameNavMembers.value[sameNavIndex.value] ?? overlayLayer.value?.querySelector('[data-testid="pm-box-' + seq + '"]');
  target?.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

/**
 * 点已勾选的行 = 把页面上亮着的组换成这一行的（焦点切换，上一组收回，#82）。
 * 行内的勾选框和 ✕ 有自己的意思，不掺和；没勾同类的行点了没有可亮的东西，不动
 */
async function onPickRowClick(row: PickRow, e: MouseEvent) {
  const t2 = e.target as HTMLElement;
  if (t2.closest('input, button, label')) return;
  if (!sameGroupOn(row) || sameFocusEl.value === row.el) return;
  sameFocusEl.value = row.el;
  refreshSameNav(); // 换了一组：导航行与强调框跟着换（#140）
  renderMarkers();
  await pushPageCss();
}

/** 预览行「检查同类」（#88）：回点选阶段亮出这一组，看完「下一步」回来，草稿不丢。
 *  0.8.11（#140）：与勾选同一口径——从第一个其他成员开始，导航行可逐个查看 */
async function inspectSameGroup(d: Draft) {
  if (!d.el) return;
  await backToPick();
  if (phase.value !== 'pick') return;
  sameFocusEl.value = d.el;
  await nextTick();
  refreshSameNav();
  const start = sameNavMembers.value.findIndex((m) => m !== d.el);
  sameNavIndex.value = start >= 0 ? start : 0;
  renderMarkers();
  await pushPageCss();
  const seq = pickRows.value.find((r) => r.el === d.el)?.seq ?? 0;
  const target = sameNavMembers.value[sameNavIndex.value] ?? overlayLayer.value?.querySelector('[data-testid="pm-box-' + seq + '"]');
  target?.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

/** 用户要求减少动态时不做平滑滚动（与 flashRow 同一口径） */
function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

// ---------- 同类逐个查看（0.8.11，#140） ----------
// 勾上「另外 N 个一样的也一起收起」后，整组靠一条描边样式规则亮出（虚线，#82）——
// 信息流网站里成员常在视口外又没有号牌，用户找不到。导航行给出位置与上/下一个，
// 当前成员用实线强调框标出（与虚线区分：虚线=这一类都要收，实线=现在看的这一个）。

/** 亮出的那组里、除这一项自己以外的成员（文档序；信息流懒加载后重算） */
const sameNavMembers = ref<Element[]>([]);
const sameNavIndex = ref(0);
/** 计数单独放 ref：导航行的位置文字要响应重算 */
const sameNavCount = ref(0);

/** 重新量亮出的那组的其他成员（按候选逐个查、去重、封顶与 matchedElements 同一口径） */
function refreshSameNav() {
  const el = sameFocusEl.value;
  if (!el || phase.value !== 'pick') {
    sameNavMembers.value = [];
    sameNavCount.value = 0;
    return;
  }
  const members: Element[] = [];
  const seen = new Set<Element>([el]);
  outer: for (const sel of focusedGroupCandidates()) {
    let list: NodeListOf<Element>;
    try {
      list = document.querySelectorAll(sel);
    } catch {
      continue;
    }
    for (const m of list) {
      if (seen.has(m) || isOwnUiNode(m)) continue;
      seen.add(m);
      members.push(m);
      if (members.length >= MATCHED_LIMIT) break outer;
    }
  }
  sameNavMembers.value = members;
  sameNavCount.value = members.length;
  if (sameNavIndex.value >= members.length) sameNavIndex.value = 0;
}

/** 跳到第 i 个成员（wrap 循环）：重画强调框 + 滚到视口中央 */
async function sameNavGo(i: number) {
  refreshSameNav();
  const members = sameNavMembers.value;
  if (members.length === 0) return;
  sameNavIndex.value = ((i % members.length) + members.length) % members.length;
  renderMarkers();
  await nextTick();
  members[sameNavIndex.value]?.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

function sameNavStep(delta: number) {
  void sameNavGo(sameNavIndex.value + delta);
}

/** 常驻 live region 的播报文字（0.8.12 准则审查）：亮着才报，空串不触发播报 */
const sameNavLiveText = computed(() =>
  sameFocusEl.value && sameNavCount.value > 0
    ? t.value.wizard.sameNavLive(sameNavIndex.value + 1, sameNavCount.value)
    : '',
);

/** 这一行有没有勾「一起收起」：旧项看草稿（同类只有 1 个时两边是同一件事），新选的看勾选时的选择 */
function sameGroupOn(row: PickRow): boolean {
  if (row.sameHits <= 1) return false;
  return row.draft ? !onlyOneOf(row.draft) : sameWanted.get(row.el) === true;
}

/** 亮着的这一组的候选：旧项用它自己的（勾上时就是同类那组），新选的按「同类一起」现算 */
function focusedGroupCandidates(): readonly string[] {
  const focus = sameFocusEl.value;
  if (!focus) return [];
  const row = pickRows.value.find((r) => r.el === focus);
  if (!row || !sameGroupOn(row)) return [];
  return row.draft ? row.draft.candidates : generateCandidates(focus, { onlyThis: false });
}

/** 点的这个元素在不在亮着的组里（看得见标记的成员）：点击语义跟着标记走（#82 交接铁律） */
function isMarkedGroupMember(el: Element): boolean {
  const focus = sameFocusEl.value;
  if (!focus || el === focus) return false; // 主元素自己本来就在选择集里，点了就是取消那一项
  const cands = focusedGroupCandidates();
  return cands.some((sel) => {
    try {
      return el.matches(sel);
    } catch {
      return false;
    }
  });
}

/** 点带标记的组员 = 取消这一行（等同行上的 ✕）：整行从清单去掉、整组解标记，不把组员当新的一项 */
function cancelFocusedRow(els: Element[], added: Element) {
  const focus = sameFocusEl.value;
  sameFocusEl.value = null;
  if (focus) {
    sameWanted.delete(focus);
    drafts.value = drafts.value.filter((d) => d.el !== focus);
  }
  const rest = els.filter((e) => e !== focus && e !== added);
  selEls.value = rest; // replaceAll 的回调把这次当作无变化，只落一遍序号与标记
  pick.replaceAll(rest);
}

/** 删除这一项：草稿和选择集一起移除；删到最后一项时回到点选阶段（N11） */
function removeDraft(d: Draft) {
  drafts.value = drafts.value.filter((x) => x.key !== d.key);
  if (d.el) pick.remove(d.el);
  if (pendingReplace === d) pendingReplace = null;
  if (drafts.value.length === 0) void backToPick();
  else void applyPreview();
}

// ---------- 工具条拖动（modern-web-guidance「drag」） ----------

/**
 * 标题栏里这些元素自己处理指针事件，按在它们上面不算拖动（#119）。
 * 把手必须放行：它是键盘入口，也是 E2E 的拖动入口。
 */
const NO_DRAG_SELECTOR =
  'button:not(.pm-wiz-handle), a, input, select, textarea, label, [contenteditable="true"], [data-no-drag]';

let grabOffset = { x: 0, y: 0 };

function moveToolbar(left: number, top: number) {
  const tb = toolbarEl.value;
  if (!tb) return;
  tbPos.value = clampToViewport(
    { left, top },
    { width: tb.offsetWidth, height: tb.offsetHeight },
    { width: window.innerWidth, height: window.innerHeight },
    // 拖到边上时至少留 16（#123）：贴死视口边缘看着局促，也容易让人以为被截断
    TOOLBAR_INSET,
  );
}

function onHeadDown(e: PointerEvent) {
  if (e.button !== 0 || !toolbarEl.value) return;
  // 退出设置等按钮照常响应；只有空白处、标题、进度这些「不是控件」的地方才开始拖
  if ((e.target as Element | null)?.closest(NO_DRAG_SELECTOR)) return;
  // 不选中标题文字，也不触发原生拖拽
  e.preventDefault();
  const r = toolbarEl.value.getBoundingClientRect();
  grabOffset = { x: e.clientX - r.left, y: e.clientY - r.top };
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}

function onHeadMove(e: PointerEvent) {
  if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return;
  dragging.value = true;
  moveToolbar(e.clientX - grabOffset.x, e.clientY - grabOffset.y);
}

/** 结束拖动：pointerup / pointercancel / lostpointercapture 三条路径都走这里，幂等 */
function endDrag(e: PointerEvent) {
  const head = e.currentTarget as HTMLElement;
  if (head.hasPointerCapture(e.pointerId)) head.releasePointerCapture(e.pointerId);
  dragging.value = false;
}

function onHandleKey(e: KeyboardEvent) {
  const d = ARROW_DIRS[e.key];
  if (!d || !toolbarEl.value) return;
  e.preventDefault();
  const r = toolbarEl.value.getBoundingClientRect();
  moveToolbar(r.left + d[0] * KEY_STEP, r.top + d[1] * KEY_STEP);
}

function reclampToolbar() {
  if (tbPos.value) moveToolbar(tbPos.value.left, tbPos.value.top);
}

/** 两步之间切换时工具条高度会变（#119）：拖动过的位置要重新夹回可视区 */
watch(phase, () => {
  void nextTick(reclampToolbar);
});

// ---------- 保存（#159：原样态先问「现在打开」；清爽态点保存就是最后一下，同 #53） ----------

/** 从点保存到写入完成只走一条路（含确认框），防重复点击 */
let saveBusy = false;

/** 读最新的开关状态：向导开着时别处可能已经切换过，不能拿打开那一刻的值判 */
async function latestSwitchContext(): Promise<SaveSwitchContext> {
  try {
    const latest = await createPageMaskStorage(browser.storage.local).getProfile(siteKey(props.url)!);
    return { exists: latest !== null, state: latest?.switchState ?? 'disguised' };
  } catch (e) {
    console.warn('[PageMask] 读取开关状态失败，按打开向导时的状态保存', e);
    return { exists: props.hasProfile, state: props.initialState };
  }
}

/** 确认框的三种结局：现在打开 / 先保持原样 / 取消（Esc、点外面） */
type OpenChoice = 'open' | 'stay' | 'cancel';
let resolveOpenChoice: ((choice: OpenChoice) => void) | null = null;

function askOpenSwitch(): Promise<OpenChoice> {
  const dlg = openDlg.value;
  if (!dlg) return Promise.resolve('cancel');
  return new Promise((resolve) => {
    resolveOpenChoice = resolve;
    dlg.showModal();
  });
}

/** 落定用户的选择：只认第一次，后续 close 事件不重复处理 */
function settleOpen(choice: OpenChoice) {
  const resolve = resolveOpenChoice;
  resolveOpenChoice = null;
  resolve?.(choice);
}

/** Esc：按「取消」放行，不依赖 close 事件晚一拍才到达的时序 */
function onOpenCancel() {
  settleOpen('cancel');
}

function onOpenClose() {
  const dlg = openDlg.value;
  if (!dlg) return;
  const choice = dlg.returnValue;
  dlg.returnValue = ''; // Esc / 点外面不设返回值，重置以免沿用上一次
  settleOpen(choice === 'open' || choice === 'stay' ? choice : 'cancel');
}

/** 点框外（::backdrop）也关：回到向导，不保存、不开开关（与空设置说明框同一套判定） */
function onOpenDialogClick(e: MouseEvent) {
  const dlg = openDlg.value;
  if (!dlg || e.target !== dlg) return;
  const r = dlg.getBoundingClientRect();
  const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  if (!inside) {
    settleOpen('cancel');
    dlg.close();
  }
}

/** 原样态保存前问一次；清爽态 / 新站点不问（#159） */
async function askOpenIfNeeded(ctx: SaveSwitchContext): Promise<OpenChoice | null> {
  if (!saveAsksToOpen(ctx)) return null;
  return askOpenSwitch();
}

async function doSave() {
  if (saving.value || saveBusy || finished) return;
  // 保存门槛：每条规则至少 1 个候选，空规则保存后什么也藏不掉
  const warn = unsavableDraftWarning(drafts.value);
  if (warn) {
    showWarn(warn);
    return;
  }
  saveBusy = true;
  try {
    const ctx = await latestSwitchContext();
    const choice = await askOpenIfNeeded(ctx);
    if (choice === 'cancel') return; // 回向导：不保存、不开开关
    await persistRules(ctx, choice === 'open');
  } finally {
    saveBusy = false;
  }
}

/** 真正写入「收起内容」：先撤预览，再合并规则并按选择写开关，最后关向导 */
async function persistRules(ctx: SaveSwitchContext, openNow: boolean) {
  saving.value = true;
  try {
    // 范围：从旧规则带进来的按它自己的；新选的默认整个网站（#76 起行内改）
    const now = Date.now();
    const incoming: DraftRuleInput[] = drafts.value.map((d) => ({
      sourceRuleId: d.sourceRuleId ?? null,
      elementName: draftName(d),
      candidates: [...d.candidates],
      strategy: d.strategy,
      scope: d.scope ?? { type: 'all' },
      onlyThis: d.onlyThis,
    }));

    // 先等预览样式真正撤掉，再落库；撤销失败时保留草稿，不能把“预览已关”当作既成事实（N22）
    const cleared = await props.setDraft(null);
    if (!cleared.ok) {
      console.warn('[PageMask] 保存前预览样式没能撤掉', cleared.error);
      showWarn(t.value.wizard.warnNotCleared);
      return;
    }

    const storage = createPageMaskStorage(browser.storage.local);
    const site = siteKey(props.url)!;
    let saved;
    try {
      // 原子写入：基于最新存储值改。
      saved = await storage.updateProfile(
        site,
        (p) => {
          // 有来源的原地更新（保留 id 与体检记录），没有的追加；
          // 本次打开时属于这个页面、但草稿里已经删掉的规则移除——只碰 initialIds 里的，别的页面的一概不动。
          // 站点还没有配置时 initialIds 是空的，效果就是纯追加（#81 两条流程同一条保存路径）
          p.hideRules = mergeSavedRules(p.hideRules, incoming, { editIds: initialIds, now, makeId: newRuleId });
          // 开关和规则在同一次写入里落库：新站点保存即建站并开启清爽（#81）；
          // 已有站点只在「现在打开」时切清爽，选「先保持原样」不动（#159）
          const next = savedSwitchState(ctx, openNow);
          if (next) p.switchState = next;
        },
        { create: !props.hasProfile },
      );
    } catch (e) {
      // 写入失败（例如存储空间不足）：恢复预览，留在向导里，可以再试
      showWarn(t.value.wizard.warnSaveFailed(e instanceof Error ? e.message : String(e)));
      await applyPreview();
      return;
    }
    if (!saved) {
      noticeText.value = t.value.wizard.noticeGoneRules;
      noticeDlg.value?.showModal();
      return;
    }
    // 两条分支都已保存并结束向导；清爽态点保存仍是最后一下（#53 收窄到清爽态）
    await finish(true);
  } finally {
    saving.value = false;
  }
}
</script>
