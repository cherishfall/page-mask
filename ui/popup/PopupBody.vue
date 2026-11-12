<template>
  <!-- 弹窗的界面部分（#103）：纯展示，props 进、事件出——不碰 browser.*、不读存储。
       真正的弹窗页面（entrypoints/popup）负责取数与副作用；欢迎页 import 同一个组件做示意图，
       这样弹窗改版时示意图自动跟上，不会再出现「手抄的假弹窗」。
       0.8.15（#148）：new / ready 共用同一份模板，只按「对象是否存在」增减卡头开关、
       辅助行开关与删除入口；两颗编辑入口在任何状态、任何开关状态下都可点。 -->
  <main class="popup" :aria-busy="ariaBusy ? 'true' : 'false'">
    <header class="popup-head">
      <h1 class="popup-logo" translate="no">PageMask</h1>
      <!-- 最次要的文字链接（#148）：从底部独占一行挪到标题右侧。
           aria-label 用全称；命中区靠 min-height/min-width: 24px 撑够（WCAG 2.5.8 / C42）。
           欢迎页第 2 步是示意图（preview），隐藏它，避免「介绍页里指向介绍页自己」。
           源码里保留 testid 与 href 两串，供 tests/onboarding-sync.test.ts 的字符串守门。 -->
      <a
        v-if="!preview"
        class="popup-guide"
        href="/onboarding.html"
        target="_blank"
        :aria-label="t.popup.replayIntroAria"
        data-testid="pm-popup-replay-intro"
      >{{ t.popup.replayIntro }}</a>
    </header>

    <p v-if="phase === 'loading'" class="hint" data-testid="pm-popup-loading">{{ t.popup.loading }}</p>
    <p v-else-if="phase === 'unsupported'" class="hint" data-testid="pm-popup-unsupported">
      {{ unsupportedReason || t.popup.unsupportedFallback }}
    </p>

    <template v-else>
      <div class="site">
        <div class="site-head">
          <h2 class="host">{{ host }}</h2>
          <span v-if="phase === 'pending'" class="pm-mark pm-mark-warning" data-testid="pm-popup-pending-badge">
            <span class="pm-mark-dot" aria-hidden="true"></span>{{ t.popup.pendingBadge }}
          </span>
        </div>

        <p v-if="hasProfile" class="meta">
          {{ ruleSummary }}<template v-if="staleCount > 0">
            ·
            <!-- 失效项给出去处（#175 视觉审查，Nielsen 错误可恢复）：点它 = 打开「收起内容」
                 在页面上重新选一次；读屏名把动作说全，可见文字保持短名 -->
            <button
              type="button"
              class="pm-mark pm-mark-danger stale-link"
              data-testid="pm-popup-stale"
              :aria-label="t.popup.staleAction(staleCount)"
              @click="emit('setup')"
            >
              <span class="pm-mark-dot" aria-hidden="true"></span>{{ t.common.staleCount(staleCount) }}
            </button>
          </template>
        </p>
        <p v-else class="hint" data-testid="pm-popup-hint-new">{{ t.popup.newSiteHint }}</p>
      </div>

      <p v-if="message" class="hint error" role="alert" data-testid="pm-popup-error">{{ message }}</p>

      <!-- 待授权：有配置、没授权，配置还在，只是浏览器收回了访问权限；
           站点已授权但当前页面没被覆盖（#162）也走这一档，只把提示换成更具体的一句 -->
      <template v-if="phase === 'pending'">
        <p class="hint" data-testid="pm-popup-pending">
          {{ pageUncovered ? t.popup.pageNotAllowed : t.popup.pendingHint }}
        </p>
        <!-- 处理中的按钮不禁用：点第二下由处理函数忽略，按钮文字自己写「正在等你允许…」 -->
        <button class="primary" data-testid="pm-popup-reauth" @click="emit('reauthorize')">
          {{ busy === 'reauth' ? t.popup.reauthorizing : t.popup.reauthorize }}
        </button>
      </template>

      <!-- ───────── 四块功能（与胶囊左→右一一对应）─────────
           new / ready 共用这一份模板；差异只按「对象是否存在」（hasProfile）：
           ① 卡头开关、④ 辅助行开关、底部删除入口。两态卡头高度、图标、文字位置一致，不跳动。 -->

      <!-- ① 面具卡：卡头「面具图标 + 按你的设置显示」，ready 多一颗开关；
           new 不放假开关，同位置用一句肯定句说明开关设置好之后做什么（ready 态没有说明行：
           开关的标签与卡内两颗已写名字的按钮已经把这张卡说清，不再重复，0.8.16 #153）。
           卡头 label 的 :for 在 new 态是 undefined（渲染后无 for 属性），CSS 用 label[for]
           只给真关联了开关的那一态加指针样式，避免「看着能点、点了没反应」（方案 §四）。
           两颗编辑入口排一行：标题和图标在前、收起内容在后，同为次操作档（#153 去主按钮），等高 40px。
           任何状态、开关开或关都可点——它们是编辑入口，定义的是「打开之后生效什么」，
           不是从属于开关的即时设置，所以不禁用。 -->
      <div
        v-if="phase === 'new' || phase === 'ready'"
        class="popup-card disguise-group"
        role="group"
        :aria-label="t.common.cleanMode"
        data-testid="pm-popup-disguise"
      >
        <div class="switch-row">
          <label class="popup-row-label" :for="hasProfile ? 'pm-popup-switch' : undefined">
            <MaskIcon class="popup-row-icon" :data-state="switchOn ? 'on' : 'off'" />
            <span>{{ t.common.cleanMode }}</span>
          </label>
          <input
            v-if="hasProfile"
            id="pm-popup-switch"
            type="checkbox"
            switch
            role="switch"
            data-testid="pm-popup-switch"
            :checked="switchOn"
            :aria-describedby="emptySettings ? 'pm-popup-switch-empty' : undefined"
            @change="emit('toggleSwitch', $event.target as HTMLInputElement)"
          />
        </div>
        <p v-if="!hasProfile" class="hint card-switch-hint">{{ t.popup.cardSwitchHintNew }}</p>
        <!-- 空设置的事前说明（#158）：开关下面一句短句，说明打开后页面不会有变化。
             判据是三处共用的 core/site-state.ts（不含灰度）；ready 态才可能为空，
             new 态上面那句已经讲了设置好之后的事，两句不叠加。开关照常可拨，不禁用、不隐藏 -->
        <p v-if="emptySettings" id="pm-popup-switch-empty" class="hint card-empty-hint" data-testid="pm-popup-switch-empty">
          {{ t.common.switchNoEffectHint }}
        </p>
        <div class="edit-actions">
          <button data-testid="pm-popup-title" @click="emit('editTitle')">
            {{ busy === 'edit' ? t.common.opening : t.popup.editTitle }}
          </button>
          <button data-testid="pm-popup-setup" @click="emit('setup')">
            {{ busy === 'setup' ? t.common.opening : t.popup.setupMore }}
          </button>
        </div>
      </div>

      <!-- ② 灰度卡（new / ready 都显示）：与 ① 同款卡片框，一行开关 + 一句说明 + 错误。
           媒体图标与胶囊「媒体」钮同源；没配置过的网站打开走首次设置的授权流程。 -->
      <div
        v-if="phase === 'new' || phase === 'ready'"
        class="popup-card media-group"
        role="group"
        :aria-label="t.media.heading"
        data-testid="pm-popup-media"
      >
        <div class="switch-row pm-info-anchor">
          <label class="popup-row-label" for="pm-popup-media-mediaGray">
            <MediaIcon class="popup-row-icon" :data-state="media?.mediaGray === true ? 'on' : 'off'" />
            <span>{{ t.media.mediaGray }}</span>
          </label>
          <!-- 快捷键键帽（0.9.2，与遮住卡同款）：显示 Chrome 里当前绑定（区分 Mac / PC 由 formatShortcut 处理），
               未绑定就不显示；aria-hidden 与遮住键帽同口径——开关本身有标签，键帽是视觉附属 -->
          <kbd v-if="grayShortcut" class="pm-kbd popup-gray-kbd" aria-hidden="true">{{ grayShortcut }}</kbd>
          <!-- ⓘ 信息标（#161 抽成公共组件）：说明收短句，被砍掉的细节移到这里按需读。
               唯一 id / 常驻 DOM / 键盘聚焦 / 读屏 / Esc / shadow 内样式都归
               ui/info-tip/InfoTip.ts 与 styles/info-tip.css；这里只传正文与公共读屏名。 -->
          <InfoTip :text="t.popup.mediaTooltip" :label="t.common.infoLabel" />
          <input
            id="pm-popup-media-mediaGray"
            type="checkbox"
            switch
            role="switch"
            data-testid="pm-popup-media-mediaGray"
            :checked="media?.mediaGray === true"
            @change="emit('toggleMedia', 'mediaGray', $event.target as HTMLInputElement)"
          />
        </div>
        <p class="hint media-hint">{{ phase === 'new' ? t.media.hintNew : t.media.hintShort }}</p>
        <!-- 页面没加载好但配置已建档（0.8.16，#154）：说明而非错误（配置会在页面打开后生效） -->
        <p v-if="mediaNotice" class="hint media-notice" role="status" data-testid="pm-popup-media-notice">{{ mediaNotice }}</p>
        <p v-if="mediaError" class="hint error" role="alert" data-testid="pm-popup-media-error">{{ mediaError }}</p>
      </div>

      <!-- ③ 遮住卡：与 ① 同款卡片框，但内部是按钮（次操作档）、没有开关——
           它是页面级临时动作，不是会记住的设置（docs/design.md「幕布」/ ADR-0007）。
           闭眼 / 睁眼图标、快捷键键帽、busy 与 covered 状态切换全部照旧，只换容器。 -->
      <div class="popup-card cover-group">
        <button class="popup-cover" data-testid="pm-popup-cover" @click="emit('toggleCurtain')">
          <EyeOffIcon v-if="!covered" class="popup-action-icon" />
          <EyeOpenIcon v-else class="popup-action-icon" />
          <span class="popup-cover-label">
            <template v-if="busy === 'curtain'">{{ covered ? t.popup.restoring : t.popup.covering }}</template>
            <template v-else>{{ covered ? t.popup.restorePage : t.popup.coverPage }}</template>
          </span>
          <!-- 快捷键提示（#101）：只显示当前平台的实际绑定；没绑定时整块不出现 -->
          <kbd v-if="coverShortcut" class="pm-kbd" aria-hidden="true">{{ coverShortcut }}</kbd>
        </button>
        <p class="hint cover-hint">{{ t.popup.coverHint }}</p>
      </div>

      <!-- ④ 辅助行（悬浮按钮）：不带卡片框（0.8.16，#153：删掉上方的独立分割线，
           卡片边界 + 留白已经分好组）。0.9.3 文字精简：标签 + 开关已经说清这行管什么，
           原先「关掉后不再显示悬浮按钮」只是复述标签，删掉；关掉后还能用什么由 ⓘ 按需给出。
           new 态这一行管的东西还不存在，整行不渲染（原本两句都在说「设置后会出现」）。
           待授权 / loading / unsupported 也不显示这一行。
           0.9.3 #181：补一颗与胶囊同源的 16px 图标占同一个槽位（四行标签文字共线），
           label 用 margin-inline-end:auto 把 ⓘ + 开关推到行尾（两枚 ⓘ 右缘共线）；
           界面仍叫「悬浮按钮」，不采用形状名。 -->
      <div v-if="hasProfile && (phase === 'new' || phase === 'ready')" class="aux-row">
        <div class="switch-row pm-info-anchor">
          <label class="popup-row-label" for="pm-popup-capsule">
            <CapsuleIcon class="popup-row-icon" />
            <span>{{ t.popup.showToggle }}</span>
          </label>
          <InfoTip :text="t.popup.showToggleTooltip" :label="t.common.infoLabel" />
          <input
            id="pm-popup-capsule"
            type="checkbox"
            switch
            role="switch"
            data-testid="pm-popup-capsule"
            :checked="showToggle"
            @change="emit('toggleCapsule', $event.target as HTMLInputElement)"
          />
        </div>
      </div>
    </template>

    <!-- 底部入口（0.8.16，#153）：文字链接，不再是按钮——它们是导航去别的页面，不是对本页的操作
         （用户反馈「不该做成按钮」；uBO / Dark Reader 等扩展弹窗底部同为链接行）。
         muted + 下划线保证「看着就能点」（#74 的顾虑由下划线解决，GOV.UK 链接惯例）；
         真链接（中键 / Cmd+点击也能开新标签）；target=_blank 新标签打开，面板失焦自动关闭 -->
    <div class="links">
      <a class="popup-link" href="/management.html#/sites" target="_blank" data-testid="pm-popup-manage">{{ t.popup.manageAll }}</a>
      <a class="popup-link" href="/settings.html" target="_blank" data-testid="pm-popup-settings">
        {{ t.popup.settings }}
      </a>
    </div>

    <!-- 删除这个网站的设置（#112）：红字文字按钮，最底、与入口用分隔线隔开。
         与胶囊菜单 / 管理页是同一件事、同一套文案（core/site-delete.ts）。
         只在 ready / pending 出现：new 还没有配置可删 -->
    <template v-if="phase === 'ready' || phase === 'pending'">
      <div class="divider" role="presentation"></div>
      <p v-if="deleteError" class="hint error" role="alert" data-testid="pm-popup-delete-error">{{ deleteError }}</p>
      <button type="button" class="text-danger" data-testid="pm-popup-delete" @click="emit('deleteSite')">
        {{ busy === 'delete' ? t.popup.deleting : deleteLabel }}
      </button>
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { type MediaFlagKey, type MediaToggles } from '@/core/media';
import { deleteSiteHeading } from '@/core/site-delete';
import { t } from '@/ui/i18n';
import CapsuleIcon from '@/ui/icons/CapsuleIcon.vue';
import EyeOffIcon from '@/ui/icons/EyeOffIcon.vue';
import EyeOpenIcon from '@/ui/icons/EyeOpenIcon.vue';
import MaskIcon from '@/ui/icons/MaskIcon.vue';
import MediaIcon from '@/ui/icons/MediaIcon.vue';
import InfoTip from '@/ui/info-tip/InfoTip';

const props = defineProps<{
  /** loading 读取中 / unsupported 不支持的页面 / new 没有配置 / pending 待授权 / ready 就绪 */
  phase: 'loading' | 'unsupported' | 'new' | 'pending' | 'ready';
  /** unsupported 时的原因（父组件从 core/origin 取；空串用兜底文案） */
  unsupportedReason?: string;
  host: string;
  /** 这个网站有没有配置（决定卡头开关、辅助行开关与条数摘要出不出来） */
  hasProfile: boolean;
  /** 「按你的设置显示」是否打开 */
  switchOn: boolean;
  /**
   * 这个网站还没有开关管得到的设置（#158）：收起的内容、标签页标题和图标都空。
   * 由 core/site-state.ts 的 hasSwitchEffect 取反得来，三处共用同一个判断；只有灰度不算有。
   * 成立时在开关下方说一句「打开后页面不变」，开关照常可拨。
   */
  emptySettings?: boolean;
  ruleSummary: string;
  staleCount: number;
  /** 失败时给用户看的一句话（父组件已按语言取好） */
  message: string;
  /** 正在处理的动作：'' 空闲；处理期间按钮文字变进行时 */
  busy: string;
  /** 当前标签页是否遮着 */
  covered: boolean;
  /**
   * 站点已授权、但当前页面不在授权模式的覆盖范围内（#162，例如只允许过 weibo.com、
   * 当前停在 s.weibo.com）。为 true 时 pending 档的提示换成「这个页面还没允许访问」。
   */
  pageUncovered?: boolean;
  /** 弹窗上显示的快捷键（当前平台、已格式化；空串 = 没绑定，不显示） */
  coverShortcut: string;
  grayShortcut: string;
  /** 右下角的小按钮在这个网站是否显示（#112：capsuleHidden 的反面）；只在 ready 出现 */
  showToggle?: boolean;
  /** 「整页变灰」的当前值（0.8.0）；欢迎页示意图不传时按未开渲染，new / ready 都显示这一行 */
  media?: MediaToggles;
  /** 开关写入失败时的一句话，显示在这一组下面（role=alert） */
  mediaError?: string;
  /** 页面没加载好但配置已建档的说明（0.8.16，#154）：不是错误，用普通说明样式 */
  mediaNotice?: string;
  /** 删除失败时的一行错误（显示在删除按钮上方，role=alert） */
  deleteError?: string;
  /** 欢迎页第 2 步的示意图：隐藏头部「查看使用说明」链接，避免介绍页指向自己（#148） */
  preview?: boolean;
}>();

const emit = defineEmits<{
  toggleSwitch: [input: HTMLInputElement];
  setup: [];
  editTitle: [];
  reauthorize: [];
  toggleCurtain: [];
  /** 拨动「右下角的小按钮」开关（#112） */
  toggleCapsule: [input: HTMLInputElement];
  /** 拨动「整页变灰」开关（0.8.0）：只带键与输入元素，方向由父组件读 checked */
  toggleMedia: [key: MediaFlagKey, input: HTMLInputElement];
  /** 点了「删除这个网站的设置」：确认框由父组件（entrypoints/popup）打开 */
  deleteSite: [];
}>();

const ariaBusy = computed(() => props.phase === 'loading' || props.busy !== '');
/** 删除入口用全名（与胶囊菜单 / 管理页 / 列表 ⋯ 菜单同一叫法）；确认框里的实心红按钮才是「删除设置」 */
const deleteLabel = deleteSiteHeading();
</script>

<style>
/* 共享样式（字体、颜色、按钮、开关、徽标）来自 @/styles/base.css；这里只写弹窗布局。
   类名带 .popup 前缀/限定，欢迎页把同一份界面嵌进去时不会和那张页面的元素选择器打架。 */
.popup {
  width: 320px;
  box-sizing: border-box;
  padding: var(--pm-space-3);
  display: flex;
  flex-direction: column;
  /* 0.8.16（#153）：0.8.15 为英文态 600px 红线把间距压到 4px，中文态跟着憋屈（用户反馈
     「一点呼吸的气口都没有」）。本批把说明文字砍短换回呼吸感：组件间距 8px（M3 8dp 网格），
     卡片内边距 12px（iOS inset grouped / Ant 卡片量级）。高度红线继续由 check-language 守门 */
  gap: var(--pm-space-2);
}
/* 头部类名带 .popup- 前缀（0.8.11，#139）：.head/.logo 是通用词，欢迎页同页嵌入时
   全局样式会撞车（欢迎页自己的 .head 被这里的 flex 压成两列） */
.popup-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--pm-space-2);
}
.popup-logo {
  font-size: var(--pm-font-size-title);
  margin: 0;
  letter-spacing: 0.2px;
}
/* 查看使用说明（#148）：最次要的文字链接——12px / muted / 下划线、hover 变色；
   命中区用 min-height/min-width 撑到 ≥24（WCAG 2.5.8 / W3C C42），链接文字不与 h1 相交 */
.popup-guide {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  min-width: 24px;
  padding: 0 2px;
  color: var(--pm-fg-muted);
  font-size: var(--pm-font-size-caption);
  text-decoration: underline;
  text-underline-offset: var(--pm-underline-offset);
  white-space: nowrap;
}
.popup-guide:hover {
  color: var(--pm-fg);
}
.popup > .hint {
  font-size: var(--pm-font-size-body);
  margin: 0;
}
.site {
  display: flex;
  flex-direction: column;
  gap: var(--pm-space-2);
}
.site-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--pm-space-2);
}
.host {
  font-size: var(--pm-font-size-body);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.popup .switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--pm-space-2);
}
/* 灰度行的快捷键键帽（0.9.2）：贴着标签（与插件设置页「标签 + 键帽」同一形态），
   margin auto 吃掉剩余空间，把 ⓘ 与开关推回行尾 */
.popup .switch-row .popup-gray-kbd {
  margin-inline-end: auto;
}
/* 只有真关联了开关的 label 才给指针样式与点击区补偿（#148）：new 态卡头的
   :for="undefined" 渲染后没有 for 属性，不该看着可点、点了没反应（方案 §四）。 */
.popup .switch-row label[for] {
  cursor: pointer;
  /* 命中区补偿（WCAG 2.5.8）：开关本体 20px 高，把标签的点击区垫到 ≥24（负 margin 抵消，视觉不变） */
  padding: 3px 0;
  margin: -3px 0;
}
.meta {
  font-size: var(--pm-font-size-caption);
  color: var(--pm-fg-muted);
  margin: 0;
}
.site .hint {
  margin: 0;
}
/* pending 的「重新授权」主按钮仍是 .popup 直接子：按「主要提交」放大到 40。
   卡内两颗编辑入口的 40px 由 .popup .edit-actions button 统一给（0.8.15 #148 / 方案 v3 §三①）。 */
.popup > button.primary {
  min-block-size: var(--pm-control-lg);
  padding-inline: var(--pm-space-3);
}
/* 底部一行两个入口（0.8.16，#153）：文字链接——导航去别的页面不是本页操作，
   不该占按钮的视觉档（用户反馈；uBO / Dark Reader 弹窗底部同为链接行）。
   下划线 + muted 色（GOV.UK：链接默认带下划线）保证看着就能点（#74 的顾虑），
   hover 变正文色；命中区 ≥24px（WCAG 2.5.8）。
   #180：改两端对齐——两个链接分别贴内容基准线左端与右端（父级 space-between），
   间距用父级 gap 而不是给子项加 margin；去掉各占一半与文字居中，英文长文案也各贴各的一端。
   这一行的左右内缩由下面「内容基准线」组合规则统一给，不在这里各写一份。 */
.links {
  display: flex;
  justify-content: space-between;
  gap: var(--pm-space-2);
}
.links > .popup-link {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  color: var(--pm-fg-muted);
  font-size: var(--pm-font-size-caption);
  text-decoration: underline;
  text-underline-offset: var(--pm-underline-offset);
}
.links > .popup-link:hover {
  color: var(--pm-fg);
}
/* 键帽样式走 styles/controls.css 的 .pm-kbd（#171 统一），这里不再各写一份 */
/* 弹窗里的同源图标（#132）：闭眼 / 睁眼 / 媒体 / 面具，16 盒、随文字色。
   媒体图标跟胶囊「媒体」钮同一套状态表达：开 = 内容填实、外框描边（0.8.3）；
   面具图标跟胶囊主钮同态（#138）：开 = 填实，眼缝描弹窗底色读出挖孔（挖孔透出的是图标身后的表面）。
   0.8.16（#152）：开态图标改用 --pm-fg 墨色，与胶囊开启态同源同态（胶囊图标开关的选中态
   = 填实图标 + 淡灰选中底，不再用强调色，见 ui/toggle/toggle.css）；
   关态仍是 --pm-fg-muted，填实规则继续用 currentColor 自动跟随，眼缝 stroke 保持 var(--pm-bg) */
/* #181：display:block 去掉 SVG 默认 inline 的额外间隙（modern-web-guidance · css-layout
   "certain replaced elements like <svg> use display: inline by default ... remove it by
   applying a block display-outside value"）；flex:none 固定 16px 槽位，长文案下也不被压 */
.popup-action-icon,
.popup-row-icon {
  display: block;
  inline-size: 16px;
  block-size: 16px;
  flex: none;
}
.popup-row-icon {
  color: var(--pm-fg-muted);
}
.popup-row-icon[data-state='on'] {
  color: var(--pm-fg);
}
.popup-row-icon[data-state='on'] .pm-media-content {
  fill: currentColor;
}
.popup-row-icon[data-state='on'] .pm-mask-body {
  fill: currentColor;
}
.popup-row-icon[data-state='on'] .pm-mask-eye {
  stroke: var(--pm-bg);
}
/* 媒体开关行：图标 + 文字成组，点图标也能拨开关（点击区跟着 label 走） */
.popup-row-label {
  display: inline-flex;
  align-items: center;
  gap: var(--pm-space-2);
}
/* #181：辅助行 label 吃满剩余空间，把 ⓘ + 开关推到行尾——与灰度卡
   .popup-gray-kbd 的 margin-inline-end:auto 同款思路，两枚 ⓘ 右缘因此共线。
   不用 order / *-reverse / justify-self 挪位置，DOM 与 Tab 顺序保持不变。
   选择器带 .popup .aux-row 限定，避开「行首裸 .switch-row」与欢迎页同页嵌入的串味 */
.popup .aux-row .switch-row .popup-row-label {
  margin-inline-end: auto;
}
/* ⓘ 信息标（#161）：外观收进 styles/info-tip.css 一份共享样式，这里不再写第二套；
   浮层靠 .pm-info-anchor（模板加在带 ⓘ 的那一行）定位，全局样式只留布局。 */
/* 遮住这一页：图标 + 文字 + 快捷键排一行（按钮本身走 controls.css 的次操作档） */
.popup-cover {
  gap: var(--pm-space-2);
}
/* 分组分隔线（0.8.16，#153）：只保留删除入口上方一条——把「删配置」这个危险动作
   与上面的两个页面入口分开（0.8.15 曾在辅助行上方也画一条，用户反馈丑，已删：
   卡片边界 + 8px 留白已经分好组，格式塔共同区域不需要再多一道线）。
   margin 归零：上下各吃 .popup 的 8px 组件间距，线不再贴着文字。
   #180 例外：它是分组线、容器级元素，刻意跨整卡宽（x=12…308），不跟内容行一起收进
   内容基准线——所以不加 margin-inline。理由与判据见 docs/design-ui.md §五。 */
.divider {
  border-top: 1px solid var(--pm-border);
}
/* 卡片框（0.8.10，#138）：面具 / 灰度 / 遮住三张同款卡片，与站点设置页同构
   （iOS/macOS inset grouped、Windows SettingsCard 先例）。分组关系靠框表达。
   0.8.16（#153）：内边距 4→12、卡内间距 4→8——间距换回呼吸感（见 .popup 注释） */
.popup-card {
  border: 1px solid var(--pm-border);
  border-radius: var(--pm-radius-card);
  background: var(--pm-bg);
  padding: var(--pm-space-3);
  display: flex;
  flex-direction: column;
  gap: var(--pm-space-2);
}
/* ── 内容基准线（#180）──────────────────────────────────────────────────────
   弹窗 320px、内边距 --pm-space-3。带框卡片（.popup-card）靠自己的 1px border +
   12px padding 把内容收到 x=25…295；不带框的裸行用同一个 token 的 margin-inline
   收到同一条线，不各写一份 13px 补偿值（--pm-card-inset = --pm-space-3 + 1px，
   定义在 styles/tokens.css，全项目唯一来源）。于是三个开关右缘、辅助行 / 链接行 /
   删除行的文字左右落点共线（iOS 设置 / SwiftUI Form 的 trailing edge、
   Material 1 Lists: Controls）。.divider 是分组线、容器级元素，刻意跨整卡宽，
   不参与内缩——例外见上方注释。 */
.popup > .aux-row,
.popup > .links,
.popup > .text-danger {
  margin-inline: var(--pm-card-inset);
}
/* ① 卡内两颗编辑入口并排（0.8.15 #148）：「标题和图标」在前、「收起内容」在后，间距 8。
   0.8.16（#153）：两颗同为次操作档（用户明确推翻「收起内容是主按钮」——已设置网站里它只是
   两个编辑入口之一；Ant「默认按钮用于一组没有优先级差别的动作」）。弹窗不再有实心主按钮，
   pending 态的「允许访问」仍是实心（那一屏唯一的动作）。
   #187：高度回归默认档 32——#148 当年按「主要提交」给的 40 只属于实心那颗，
   #153 改判次操作档后 40 的依据已经不在；并排省一行的形态不变。
   <style> 非 scoped，一律 .popup 限定。 */
.popup .edit-actions {
  display: flex;
  gap: var(--pm-space-2);
}
.popup .edit-actions button {
  flex: 1;
}
/* 卡内说明（#148 / 方案 v3 §三①）：卡内说明与错误提示统一 13px 正文档，
   消掉 .hint 默认 12px 与 .media-group .hint 13px 的分叉（AGENTS.md 整屏审查第 5 条）。
   0.9.3 辅助行的常驻说明删掉，.aux-hint 一并退场。
   <style> 不是 scoped、欢迎页第 2 步会嵌入同一份界面（0.8.11 #139 同款教训），
   新增类名一律用 .popup 限定，别用通用词压到欢迎页自己的 .head / .card 等元素。 */
.popup .card-switch-hint,
.popup .card-empty-hint,
.popup .media-hint,
.popup .media-notice,
.popup .cover-hint,
/* 卡内错误提示（mediaError / deleteError）跟着同一档，别比它旁边的说明小一号 */
.popup .hint.error {
  margin: 0;
  font-size: var(--pm-font-size-body);
}
/* 媒体开关一组（0.8.0）：开关与它的说明贴在一起，读成一件事；
   说明与错误都跟着这一组走（0.8.10 起与面具卡同款卡片框） */
.media-group {
  display: flex;
  flex-direction: column;
  gap: var(--pm-space-1);
}
/* 组内的说明不是 .popup 的直接子元素；字号已在上面四条统一到 13px，不再单独抬。
   0.8.0 起只有一行开关：说明直接跟着它解释的那一行，不再要 #127 的组级分隔线 */
.media-group .hint {
  margin: 0;
}
/* ④ 辅助行：不带卡片框，只有一条分隔线（在模板里）与紧凑的一行开关 / 一句说明 */
.popup .aux-row {
  display: flex;
  flex-direction: column;
  gap: var(--pm-space-1);
}
/* 删除入口（#112）：最轻的一档——无框文字按钮、危险色；可点区仍够（min-block-size 由控件样式给）。
   常态就带下划线（#175 视觉审查）：它上面两个入口都是下划线链接，唯独它没有下划线时
   第一眼像警示标签而不是能点的入口（清单 #8「入口长得不像入口」） */
.popup > .text-danger {
  border: none;
  background: none;
  padding-inline: 0;
  justify-content: flex-start;
  color: var(--pm-danger);
  text-align: left;
  text-decoration: underline;
  text-underline-offset: var(--pm-underline-offset);
}
.popup > .text-danger:hover:not(:disabled) {
  background: none;
  color: var(--pm-danger);
  text-decoration: underline;
}
/* 摘要里的失效条改成了可点（#175）：保持 pm-mark 的「圆点 + 文字」样子，
   按钮的默认样式全退掉。#188 文字入口规则：可点的红字入口必须常驻下划线
   （此前只有悬停才有——键盘 / 触屏没有「悬停一看」，Nielsen 状态可见）。
   命中区补偿（WCAG 2.5.8）：12px 标记文字垫到 ≥24，负 margin 抵消，视觉不变 */
.stale-link {
  border: none;
  background: none;
  padding: 4px 0;
  margin: -4px 0;
  font: inherit;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: var(--pm-underline-offset);
}
.stale-link:hover {
  text-decoration: underline;
  text-underline-offset: var(--pm-underline-offset);
}
.stale-link:focus-visible {
  outline: var(--pm-focus-ring);
  outline-offset: var(--pm-focus-ring-offset);
  border-radius: 2px;
}
</style>
