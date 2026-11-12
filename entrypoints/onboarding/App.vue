<template>
  <main class="page">
    <!-- 读屏播报当前步（#108）：切步时更新文字，不抢焦点 -->
    <p class="visually-hidden" role="status">{{ stepStatus }}</p>

    <header class="head">
      <div class="head-text">
        <h1 translate="no">{{ t.onboarding.title }}</h1>
        <p class="sub">{{ t.onboarding.sub }}</p>
      </div>
      <!-- 退路在最轻的位置（AGENTS 整屏审查第 4 条 / #175 视觉审查）：装完就绑定三步不合情理，
           随时可以跳过；跳过与看完最后一步走同一个出口（关掉这一页），不丢任何东西。
           「跳过引导」的形态归档见下方 .skip 的样式注释与 design-ui §四 文字入口 · 登记的例外（#187） -->
      <button type="button" class="ghost skip" data-testid="onboard-skip" @click="finish">{{ t.onboarding.skip }}</button>
    </header>

    <!-- 分步单屏（#139）：一次只显示当前步，内容列放宽到 720——
         旧版三张卡竖排（窄列 + 整页下滑）是装机反馈「窄、要下滑」的来源；
         矮视口仍由 .scroll 兜底滚动，常态一屏放下不滚 -->
    <div class="scroll">
      <!-- 居中用 margin-block:auto 而不是 justify-content:center（0.8.11 目检 B1）：
           flex 居中在内容溢出时会把顶部顶出可视区、怎么滚都回不去；auto margin 在
           溢出时自动塌成 0——放得下就居中，放不下就贴顶可滚 -->
      <div class="stack">
        <section class="card" aria-labelledby="onboard-step-title" data-testid="onboard-card">
        <div class="step-head">
          <span class="num" aria-hidden="true">{{ step }}</span>
          <h2 id="onboard-step-title" :aria-current="'step'">
            {{ current.title }}
          </h2>
        </div>
        <p class="step-text">{{ current.text }}</p>
        <ul v-if="current.features.length" class="features">
          <li v-for="line in current.features" :key="line">{{ line }}</li>
        </ul>
        <!-- 每步一张图：第 2、3 步直接渲染真实组件（#103），弹窗 / 胶囊改版时示意图自动跟上。
             文案的同步由 tests/onboarding-sync.test.ts 守门：欢迎页文案必须覆盖当前功能名 -->
        <div class="art" aria-hidden="true" inert>
          <svg v-if="step === 1" class="art-svg" viewBox="0 0 300 44" role="img">
            <!-- 这张画画的是 Chrome 工具栏（拼图图标 + 固定后的 PageMask），不是自家界面，
                 不在「示意图跟组件走」的同步范围内 -->
            <rect x="1" y="6" width="298" height="32" rx="16" class="sk-bar" />
            <!-- 两侧灰圆是工具栏上别的图标位，纯装饰（#187：不承载「理解内容」，
                 不参与 WCAG 1.4.11 的 3:1，保持低对比） -->
            <circle cx="26" cy="22" r="9" class="sk-dot" />
            <!-- 拼图盒是文案让人去点的那枚图标（WCAG 1.4.11：理解内容必需的图形对象 ≥3:1。
                 #187：填充从 bg-subtle 的约 1.05:1 加深到 fg-muted——浅 4.83 / 深 5.98，两个主题都过线） -->
            <rect x="126" y="14" width="26" height="16" rx="4" class="sk-puzzle" />
            <!-- 盒内四个小点示意扩展图标格（0.8.11 目检 A3：光标指着的盒子里不能是空的）；
                 盒子加深后随深色填充反白 -->
            <circle cx="133" cy="19" r="1.7" class="sk-puzzle-dot" />
            <circle cx="140" cy="19" r="1.7" class="sk-puzzle-dot" />
            <circle cx="133" cy="26" r="1.7" class="sk-puzzle-dot" />
            <circle cx="140" cy="26" r="1.7" class="sk-puzzle-dot" />
            <path d="M146 34 l6 8 M146 34 l-6 8" class="sk-line" />
            <rect x="182" y="8" width="28" height="28" rx="8" class="sk-on" />
            <text x="196" y="27" text-anchor="middle" class="sk-on-text">P</text>
            <circle cx="240" cy="22" r="9" class="sk-dot" />
            <circle cx="266" cy="22" r="9" class="sk-dot" />
          </svg>
          <div v-else-if="step === 2" class="popup-preview">
            <PopupBody
              phase="new"
              host="example.com"
              :has-profile="false"
              :switch-on="false"
              rule-summary=""
              :stale-count="0"
              message=""
              busy=""
              :covered="false"
              :cover-shortcut="coverShortcut"
              :gray-shortcut="grayShortcut"
              preview
            />
          </div>
          <div v-else class="art-capsule">
            <FloatingToggle
              state="disguised"
              :position="null"
              site-label="example.com"
              :opacity="1"
              preview
            />
          </div>
        </div>
        <!-- 这句讲的是弹窗里那两个入口在哪（#187：说明跟着它解释的对象走——从页面底部
             挪进步骤卡、贴着弹窗示意图）：只配第 2 步（弹窗那一步）——0.8.11 目检指出
             它在第 1 步提前引用了还没介绍的弹窗、又与第 3 步逐字重复 -->
        <p v-if="step === 2" class="tip">{{ t.onboarding.tip }}</p>
      </section>
      </div>
    </div>

    <div class="nav">
      <!-- 上一步和向导里同一档：有框的次按钮，不是最轻的无框文字（导航也要看得出能点） -->
      <button v-if="step > 1" type="button" @click="step--">{{ t.onboarding.prev }}</button>
      <span v-else></span>
      <!-- 圆点只是装饰，步骤状态已由列表里的 aria-current 表达 -->
      <span class="dots" aria-hidden="true"><i v-for="i in t.onboarding.steps.length" :key="i" :class="{ on: i === step }"></i></span>
      <button v-if="step < t.onboarding.steps.length" type="button" class="primary" @click="step++">{{ t.onboarding.next }}</button>
      <button v-else type="button" class="primary" @click="finish">{{ t.onboarding.start }}</button>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { browser } from 'wxt/browser';
import { formatShortcut, isMacPlatform } from '@/core/shortcut';
import FloatingToggle from '@/ui/FloatingToggle.vue';
import PopupBody from '@/ui/popup/PopupBody.vue';
import { t } from '@/ui/i18n';
import { ensureTogglePreviewStyles } from '@/ui/toggle/preview-style';

const step = ref(1);
/** 弹窗示意图上的快捷键：与真实弹窗一致，取当前实际绑定（没绑定就不显示） */
const coverShortcut = ref('');
const grayShortcut = ref('');

const stepCount = computed(() => t.value.onboarding.steps.length);
/** 当前步（分步单屏，#139）：标题 / 说明 / 功能列表都来自文案表（step 恒在 1..length 内） */
const current = computed(() => t.value.onboarding.steps[step.value - 1]!);
/** 读屏播报（#108）：「第 N 步，共 M 步：<标题>」 */
const stepStatus = computed(() =>
  t.value.onboarding.stepStatus(step.value, stepCount.value, t.value.onboarding.steps[step.value - 1]?.title ?? ''),
);

// 切步跟随（#108）：矮视口滚动兜底时把当前卡滚进视野；系统要求减弱动效时直接跳位。
// 滚的是整张卡（0.8.11 目检：滚卡内的 .step-head 会把卡片顶边顶出可视区约 17px）
const reducedMotion =
  typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
watch(step, async () => {
  await nextTick();
  document.querySelector('[data-testid="onboard-card"]')?.scrollIntoView({
    block: 'start',
    behavior: reducedMotion?.matches ? 'auto' : 'smooth',
  });
});

/** 示意图上的键帽与真实弹窗一致，取 Chrome 里当前实际绑定；没绑定就不显示。
 *  Chrome 没有「绑定变了」的通知，标签页重新可见时重读一次（用户可能刚在快捷键页改完）。 */
async function refreshShortcut(): Promise<void> {
  try {
    const commands = await browser.commands.getAll();
    const find = (name: string) => commands.find((c) => c.name === name)?.shortcut ?? '';
    coverShortcut.value = formatShortcut(find('toggle-curtain'), isMacPlatform());
    grayShortcut.value = formatShortcut(find('toggle-media-gray'), isMacPlatform());
  } catch {
    coverShortcut.value = '';
    grayShortcut.value = '';
  }
}

function onShortcutSurfaceVisible(): void {
  if (document.visibilityState === 'visible') void refreshShortcut();
}

onMounted(() => {
  ensureTogglePreviewStyles();
  void refreshShortcut();
  document.addEventListener('visibilitychange', onShortcutSurfaceVisible);
});
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onShortcutSurfaceVisible);
});

function finish() {
  window.close();
}
</script>

<style>
/* 共享样式（字体、颜色、按钮）来自 @/styles/base.css */
/* 欢迎页是唯一的整页界面：常态一屏放下不滚动（#139），矮视口由 .scroll 兜底；
 * 底栏在 flex 里占自己的高度，永远完整可见 */
html {
  height: 100%;
}
body {
  height: 100dvh;
  background: var(--pm-bg-subtle);
  overflow: hidden; /* 整页不再滚动：滚动属于 .scroll */
}
#app {
  height: 100dvh;
}
.page {
  height: 100dvh;
  /* 720（#139）：内容列放宽——旧版 560 是装机反馈「窄窄的」的来源 */
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
}
.head {
  padding: calc(var(--pm-space-8) + var(--pm-space-4)) var(--pm-space-6) 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--pm-space-4);
}
.head-text {
  flex: 1;
  min-width: 0;
}
h1 {
  font-size: var(--pm-font-size-heading);
  margin: 0;
}
.sub {
  color: var(--pm-fg-muted);
  margin: var(--pm-space-2) 0 0;
}
/* 「跳过引导」（#187 定稿；归档登记在 docs/design-ui.md §四 文字入口 · 登记的例外）：
 * 它是「结束引导」的动作不是去向，语义留在 <button>（Carbon：动作不用链接）；
 * 形态取「次级入口链接」档——muted 灰 + 常驻下划线。文字按钮档的「悬停出浅灰底」
 * 只有指针看得见（规则自己在嵌流档承认过：悬停是鼠标才有的状态，键盘与触屏没有悬停），
 * 而它静置在标题与副标题两行说明文字旁边，同灰无下划线时读不出能点（#74 的教训；
 * 弹窗删除入口 #175 先例：按钮 + 常驻下划线治「长得不像入口」）。
 * 与设置页那个「到 Chrome 里设置快捷键」不共形不冲突：它独占一行、悬停信号够用，
 * 「跳过引导」与说明文字同排——文字入口规则按上下文分档 */
.skip {
  text-decoration: underline;
  text-underline-offset: 2px;
}
/* 滚动区：常态内容不满一屏，竖直居中（0.8.11 目检 A4「头重脚轻」）；
   矮视口时内容在这里滚，底栏永远完整可见。居中由 .stack 的 margin-block:auto 承担：
   flex 容器上的 justify-content:center 在内容溢出时会把顶部顶出可视区、滚不回来 */
.scroll {
  flex: 1;
  min-height: 0; /* flex 子项要这个才收得住高度，否则内容把 .page 撑开 */
  overflow-y: auto;
  padding: var(--pm-space-4) var(--pm-space-6) var(--pm-space-6);
  scrollbar-gutter: stable;
  overscroll-behavior: contain;
  display: flex;
  flex-direction: column;
}
/* 卡片 + 说明的竖直栈：空间足够时 margin-block:auto 居中，溢出时塌成 0 贴顶可滚 */
.stack {
  margin-block: auto;
  display: flex;
  flex-direction: column;
}
.card {
  background: var(--pm-bg);
  border: 1px solid var(--pm-border);
  border-radius: var(--pm-radius-card);
  padding: var(--pm-space-4);
  scroll-margin-block: 12px; /* 切步滚到顶后与滚动区顶边留一拍空隙（沿旧 .step 的做法） */
}
.step-head {
  display: flex;
  align-items: center;
  gap: var(--pm-space-3);
}
.num {
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid var(--pm-border-control);
  background: var(--pm-accent);
  color: var(--pm-on-accent);
  font-weight: var(--pm-font-weight-strong);
  display: flex;
  align-items: center;
  justify-content: center;
}
.card h2 {
  font-size: var(--pm-font-size-title);
  margin: 0;
}
.step-text {
  margin: var(--pm-space-3) 0 0;
  color: var(--pm-fg-muted);
  line-height: 1.6;
}
/* 功能列表（#139 起四件事）：一行一件，名字在前、结果在后。
   #187：正文回到 --pm-fg——要点是这一步的主内容，原来与副标题同灰同值，
   只靠加粗语序区分是层级倒挂；主内容 fg、辅助说明 muted（design-ui §三 文字表） */
.features {
  margin: var(--pm-space-3) 0 0;
  padding-left: 1.2em;
  color: var(--pm-fg);
  line-height: 1.6;
}
.features li + li {
  margin-top: var(--pm-space-1);
}
/* 底栏（#108）：flex 里固定，只放按钮与圆点（操作栏里不放说明文字） */
.nav {
  flex: none;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--pm-space-3) var(--pm-space-6);
  padding-bottom: calc(var(--pm-space-3) + env(safe-area-inset-bottom));
  background: var(--pm-bg-subtle);
  border-top: 1px solid var(--pm-border);
}
/* 底栏按钮尺寸（#187 统一到档）：40 只给触屏与主要提交（docs/design-ui.md §四）——
 * 「下一步 / 开始使用」是这一步的主要提交，用 40；「上一步」是退路（次操作），
 * 回归默认档 32。旧规则把整条底栏抬到 40，退路冒充了主要提交 */
.nav button.primary {
  min-block-size: var(--pm-control-lg);
  padding-inline: var(--pm-space-4);
}
/* 圆点绝对居中：第 1 步没有「上一步」，普通流式排版会让它切步时横跳 */
.dots {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
}
.dots i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--pm-border-control);
}
.dots i.on {
  background: var(--pm-accent);
}
.tip {
  margin: var(--pm-space-4) 0 0;
  font-size: var(--pm-font-size-caption);
  color: var(--pm-fg-muted);
}

/* ── 每步一张图（#93）：文字只留一句，细节看图；全部用 tokens 配色 ── */
.art {
  margin-top: var(--pm-space-4);
  /* 示意图是静图（inert 已挡焦点与事件，这里把指针也显式关掉）：里面嵌的是真实组件，不该被点 */
  pointer-events: none;
}
.art-svg {
  display: block;
  width: 100%;
  max-width: 300px;
}
.sk-bar {
  fill: var(--pm-bg);
  stroke: var(--pm-border-control);
}
.sk-dot {
  fill: var(--pm-border);
}
/* 拼图盒是文案让人去点的那枚图标，填充对白底必须 ≥3:1（WCAG 1.4.11，#187）：
   fg-muted 浅 4.83 / 深 5.98；盒内的图标格随深色填充反白 */
.sk-puzzle {
  fill: var(--pm-fg-muted);
  stroke: var(--pm-fg-muted);
}
.sk-puzzle-dot {
  fill: var(--pm-bg);
}
.sk-line {
  stroke: var(--pm-fg-muted);
  stroke-width: 1.5;
  fill: none;
}
.sk-on {
  fill: var(--pm-accent);
}
.sk-on-text {
  fill: var(--pm-on-accent);
  font-size: 13px;
  font-weight: 600;
}

/* 真实弹窗（#103）：白色卡片 + 阴影，宽度与真身一致；居中放置（#139 分步单屏）。
   zoom 0.85（0.8.11 目检 B1）：0.8.10 起弹窗加了卡片分组、整卡约 500px 高，
   原尺寸放不进一屏——缩到 0.85 后连底部的两个入口都完整可见，不必滚动。
   用 zoom 而不是 transform：zoom 参与布局不留空白，Chrome 扩展页面可用 */
.popup-preview {
  inline-size: min(320px, 100%);
  margin: 0 auto;
  background: var(--pm-bg);
  border: 1px solid var(--pm-border);
  border-radius: var(--pm-radius-card);
  box-shadow: var(--pm-shadow-overlay);
  overflow: hidden;
  zoom: 0.85;
}
/* 真实胶囊（#103）：一块页面感的浅底，里面是 position: static 的预览 */
.art-capsule {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--pm-space-4);
  background: var(--pm-bg-subtle);
  border: 1px dashed var(--pm-border);
  border-radius: var(--pm-radius-card);
}
</style>
