<template>
  <!-- 弹窗的界面部分（#103）：纯展示，props 进、事件出——不碰 browser.*、不读存储。
       真正的弹窗页面（entrypoints/popup）负责取数与副作用；欢迎页 import 同一个组件做示意图，
       这样弹窗改版时示意图自动跟上，不会再出现「手抄的假弹窗」。 -->
  <main class="popup" :aria-busy="ariaBusy ? 'true' : 'false'">
    <header class="head">
      <h1 class="logo" translate="no">PageMask</h1>
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

        <!-- 开关：<input type="checkbox" switch>，Chrome 不支持 switch 属性，显式 role="switch"。
             处理期间不禁用：多拨一次由父组件忽略并拨回实际状态，状态由界面文字与 aria-busy 表达 -->
        <div v-if="phase === 'ready' && hasProfile" class="switch-row">
          <label for="pm-popup-switch">{{ t.common.cleanMode }}</label>
          <input
            id="pm-popup-switch"
            type="checkbox"
            switch
            role="switch"
            data-testid="pm-popup-switch"
            :checked="switchOn"
            @change="emit('toggleSwitch', $event.target as HTMLInputElement)"
          />
        </div>

        <p v-if="hasProfile" class="meta">
          {{ ruleSummary }}<template v-if="staleCount > 0">
            ·
            <span class="pm-mark pm-mark-danger" data-testid="pm-popup-stale">
              <span class="pm-mark-dot" aria-hidden="true"></span>{{ t.common.staleCount(staleCount) }}
            </span>
          </template>
        </p>
        <p v-else class="hint" data-testid="pm-popup-hint-new">{{ t.popup.newSiteHint }}</p>
      </div>

      <p v-if="message" class="hint error" role="alert" data-testid="pm-popup-error">{{ message }}</p>

      <template v-if="phase === 'pending'">
        <!-- 有配置、没授权：配置还在，只是浏览器收回了这个网站的访问权限 -->
        <p class="hint" data-testid="pm-popup-pending">{{ t.popup.pendingHint }}</p>
        <!-- 处理中的按钮不禁用：点第二下由处理函数忽略，按钮文字自己写「正在等你允许…」 -->
        <button class="primary" data-testid="pm-popup-reauth" @click="emit('reauthorize')">
          {{ busy === 'reauth' ? t.popup.reauthorizing : t.popup.reauthorize }}
        </button>
      </template>
      <template v-else>
        <!-- 两个入口（#81）：新旧网站同构，都有这两颗。「收起内容」是主按钮（进点选），
             「标题和图标」是次按钮（单步小表单，填完点保存） -->
        <button class="primary" data-testid="pm-popup-setup" @click="emit('setup')">
          {{ busy === 'setup' ? t.common.opening : t.popup.setupMore }}
        </button>
        <button data-testid="pm-popup-title" @click="emit('editTitle')">
          {{ busy === 'edit' ? t.common.opening : t.popup.editTitle }}
        </button>
      </template>

      <!-- 遮住开关（#54）：遮住后按钮自己写着「恢复本页」。没添加过 / 已添加 / 待授权三种站点都能用 -->
      <button data-testid="pm-popup-cover" @click="emit('toggleCurtain')">
        <span class="popup-cover-label">
          <template v-if="busy === 'curtain'">{{ covered ? t.popup.restoring : t.popup.covering }}</template>
          <template v-else>{{ covered ? t.popup.restorePage : t.popup.coverPage }}</template>
        </span>
        <!-- 快捷键提示（#101）：只显示当前平台的实际绑定；没绑定时整块不出现 -->
        <kbd v-if="coverShortcut" class="popup-kbd" aria-hidden="true">{{ coverShortcut }}</kbd>
      </button>

      <!-- 右下角的小按钮开关（#112）：只在这个网站已配置、已允许访问时出现——
           待授权站点页面上本来就没有胶囊；关掉后下面四件事一件不少，这是隐藏胶囊后的唯一页外入口 -->
      <template v-if="phase === 'ready'">
        <div class="divider" role="presentation"></div>
        <!-- 图片、视频和声音（#116）：三行收成一组，说明只留一行放在这组下面。
             与「按你的设置显示」一样只在按设置时起作用；原样时也能先设好，所以不设禁用态 -->
        <div class="media-group" role="group" :aria-label="t.media.heading" data-testid="pm-popup-media">
          <div v-for="key in MEDIA_FLAG_KEYS" :key="key" class="switch-row">
            <label :for="`pm-popup-media-${key}`">{{ t.media[key] }}</label>
            <input
              :id="`pm-popup-media-${key}`"
              type="checkbox"
              switch
              role="switch"
              :data-testid="`pm-popup-media-${key}`"
              :checked="media?.[key] === true"
              @change="emit('toggleMedia', key, $event.target as HTMLInputElement)"
            />
          </div>
          <p class="hint media-hint">{{ t.media.hintShort }}</p>
          <p v-if="mediaError" class="hint error" role="alert" data-testid="pm-popup-media-error">{{ mediaError }}</p>
        </div>
        <div class="switch-row">
          <label for="pm-popup-capsule">{{ t.popup.showToggle }}</label>
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
        <!-- 提示放在开关下面（说明跟着它解释的东西走），不塞进开关行 -->
        <p class="hint capsule-hint">{{ t.popup.showToggleHint }}</p>
        <div class="divider" role="presentation"></div>
      </template>
    </template>

    <!-- 底部两个入口：真链接（中键 / Cmd+点击也能开新标签）；target=_blank 新标签打开，面板失焦自动关闭 -->
    <div class="links">
      <a class="button small link" href="/management.html#/sites" target="_blank" data-testid="pm-popup-manage">{{ t.popup.manageAll }}</a>
      <a class="button small link" href="/settings.html" target="_blank" data-testid="pm-popup-settings">
        {{ t.popup.settings }}
      </a>
    </div>

    <!-- 删除这个网站的设置（#112）：红字文字按钮，最底、与入口用分隔线隔开。
         与胶囊菜单 / 管理页是同一件事、同一套文案（core/site-delete.ts）。
         只在ready / pending 出现：new 还没有配置可删 -->
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
import { MEDIA_FLAG_KEYS, type MediaFlagKey, type MediaToggles } from '@/core/media';
import { deleteSiteHeading } from '@/core/site-delete';
import { t } from '@/ui/i18n';

const props = defineProps<{
  /** loading 读取中 / unsupported 不支持的页面 / new 没有配置 / pending 待授权 / ready 就绪 */
  phase: 'loading' | 'unsupported' | 'new' | 'pending' | 'ready';
  /** unsupported 时的原因（父组件从 core/origin 取；空串用兜底文案） */
  unsupportedReason?: string;
  host: string;
  /** 这个网站有没有配置（决定开关与条数摘要出不出来） */
  hasProfile: boolean;
  /** 「按你的设置显示」是否打开 */
  switchOn: boolean;
  ruleSummary: string;
  staleCount: number;
  /** 失败时给用户看的一句话（父组件已按语言取好） */
  message: string;
  /** 正在处理的动作：'' 空闲；处理期间按钮文字变进行时 */
  busy: string;
  /** 当前标签页是否遮着 */
  covered: boolean;
  /** 弹窗上显示的快捷键（当前平台、已格式化；空串 = 没绑定，不显示） */
  coverShortcut: string;
  /** 右下角的小按钮在这个网站是否显示（#112：capsuleHidden 的反面）；只在 ready 出现 */
  showToggle?: boolean;
  /** 图片、视频、声音三个开关的当前值（#116）；欢迎页示意图不传也没关系（new 态不显示这一组） */
  media?: MediaToggles;
  /** 三个开关写入失败时的一句话，显示在这一组下面（role=alert） */
  mediaError?: string;
  /** 删除失败时的一行错误（显示在删除按钮上方，role=alert） */
  deleteError?: string;
}>();

const emit = defineEmits<{
  toggleSwitch: [input: HTMLInputElement];
  setup: [];
  editTitle: [];
  reauthorize: [];
  toggleCurtain: [];
  /** 拨动「右下角的小按钮」开关（#112） */
  toggleCapsule: [input: HTMLInputElement];
  /** 拨动图片 / 视频 / 声音里的某一个开关（#116）：只带键与输入元素，方向由父组件读 checked */
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
  gap: var(--pm-space-3);
}
.head {
  display: flex;
  align-items: center;
}
.logo {
  font-size: var(--pm-font-size-title);
  margin: 0;
  letter-spacing: 0.2px;
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
.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--pm-space-2);
}
.switch-row label {
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
/* 主按钮是这一屏唯一的提交按钮：按「主要提交」的尺寸放大到 40 */
.popup > button.primary {
  min-block-size: var(--pm-control-lg);
  padding-inline: var(--pm-space-3);
}
/* 底部一行两个入口：它们不是「内容里的小动作」，是两个页面唯一的入口，所以用次按钮
   （有底有边、比主按钮浅一档），不用无框小字——无框小字看着像不能点（#74） */
.links {
  display: flex;
  gap: var(--pm-space-2);
}
.links > .link {
  flex: 1;
  padding-inline: var(--pm-space-1);
  /* 链接默认色会盖过按钮字色（a 的特异性压过控件样式）：按钮样式的链接用正文色 */
  color: var(--pm-fg);
  text-align: center;
  text-decoration: none;
}
/* 键帽：说明「这颗按钮还有一条键盘通路」，视觉上低于按钮文字 */
.popup-kbd {
  padding: 0 4px;
  border: 1px solid var(--pm-border);
  border-radius: 4px;
  color: var(--pm-fg-muted);
  font: inherit;
  font-size: var(--pm-font-size-caption);
  line-height: 16px;
}
/* 分组分隔线（#112）：站点动作 ｜ 胶囊开关 ｜ 页面入口 ｜ 删除，一拍留白 + 一条细线 */
.divider {
  border-top: 1px solid var(--pm-border);
  margin: calc(var(--pm-space-1) * -1) 0;
}
/* 三个媒体开关收成一组（#116）：组内间距比弹窗默认的组件间距小一档，
   三行读成「一组设置」而不是三个散落的开关；说明与错误都跟着这一组走 */
.media-group {
  display: flex;
  flex-direction: column;
  gap: var(--pm-space-2);
}
/* 组内的说明不是 .popup 的直接子元素，字号自己对齐弹窗里其他说明那一档 */
.media-group .hint {
  margin: 0;
  font-size: var(--pm-font-size-body);
}
/* 胶囊开关下的说明：一行小字，跟着开关走 */
.capsule-hint {
  margin: 0;
}
/* 删除入口（#112）：最轻的一档——无框文字按钮、危险色；可点区仍够（min-block-size 由控件样式给） */
.popup > .text-danger {
  border: none;
  background: none;
  padding-inline: 0;
  justify-content: flex-start;
  color: var(--pm-danger);
  text-align: left;
}
.popup > .text-danger:hover:not(:disabled) {
  background: none;
  color: var(--pm-danger);
  text-decoration: underline;
}
</style>
