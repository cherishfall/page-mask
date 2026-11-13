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
        <!-- 每步一张图：第 2、3 步直接渲染真实组件（#103），弹窗 / 胶囊改版时示意图自动跟上；
             第 1 步示意真实 Chrome 工具栏 + 扩展菜单（#194），其中 PageMask 行的图标内联
             assets/icon/icon-16.svg 的真实图形，与工具栏真图标同源。
             文案的同步由 tests/onboarding-sync.test.ts 守门：欢迎页文案必须覆盖当前功能名 -->
        <div class="art" aria-hidden="true" inert>
          <svg v-if="step === 1" class="art-svg" viewBox="0 0 300 112" role="img">
            <!-- 第 1 步（#194）：与真实 Chrome 一致的两步示意——上方工具栏里一枚真实形状的拼图按钮，
                 下方是点开后弹出的扩展菜单（一列列表行），在 PageMask 这一行的行尾点图钉。
                 依据：Google Chrome 帮助「Select Extensions → Find the hidden extension → Select Pin」；
                 Apple HIG Onboarding「把引导放在对应区域附近」；NN/g Instructional Overlays
                 「Use Visuals When Possible / Short, Focused Tips」；Material 3 Menus（列表行 leading / trailing）。
                 旧图把菜单和工具栏挤进同一条 300×44 横条、用蓝底白字「P」自造符号指代扩展
                 （GLOSSARY Avoid：不用形状 / 字母指代功能），已弃用。
                 与第 2/3 步同理：PageMask 行的 leading icon 内联 assets/icon/icon-16.svg 的真实图形
                 （同源、不依赖外部图片加载），不再自造符号。 -->
            <!-- 工具栏短条：底色比卡片浅一档、边界用控件色（≥3:1），暗色 / forced-colors 下仍清楚 -->
            <rect x="1" y="1" width="298" height="28" rx="8" class="sk-bar" />
            <!-- 左侧灰圆是工具栏上别的图标位，纯装饰（沿用旧 sk-dot 口径，不承载理解内容、不参与 3:1） -->
            <circle cx="20" cy="15" r="4.5" class="sk-dot" />
            <circle cx="40" cy="15" r="4.5" class="sk-dot" />
            <circle cx="60" cy="15" r="4.5" class="sk-dot" />
            <!-- 拼图按钮 = 文案让人去点的「扩展程序」按钮：真实拼图块形状（Material extension 路径），
                 不再是带四个点的方框。填充 fg-muted 对工具栏底（bg-subtle）浅 4.51 / 深 5.16 ≥3:1 -->
            <path class="sk-puzzle" transform="translate(260 4) scale(0.9)"
                  d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7s2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z" />
            <!-- 下拉菜单面板：与工具栏分开的另一块圆角浮层，右对齐挂在拼图按钮下方，
                 不再把两个界面挤进同一条横条。边界用控件色（≥3:1）保证暗色 / forced-colors 下读得出「这是一块菜单」 -->
            <rect x="140" y="34" width="150" height="74" rx="10" class="sk-menu" />
            <!-- 扩展列表行 1（中性灰占位：别的扩展，纯装饰） -->
            <rect x="150" y="38" width="20" height="20" rx="5" class="sk-ph" />
            <rect x="178" y="45" width="58" height="6" rx="3" class="sk-ph" />
            <!-- 扩展列表行 2 = PageMask：行首内联真实 16px 图标、行尾一枚图钉（这一行略作强调，不引入新颜色语义） -->
            <g class="sk-icon" transform="translate(150 61) scale(1.25)">
              <rect width="16" height="16" rx="3.5" fill="#2563eb" />
              <rect x="4.5" y="1.5" width="7" height="13" rx="1.5" fill="#ffffff" />
              <rect x="5.5" y="10.5" width="5" height="1.5" rx="0.75" fill="#9aa3af" />
              <g transform="rotate(-10 8 6)">
                <path d="M2.6 5.2 C3.6 3.9 5.7 3.9 6.7 5.1 L8 6.4 L9.3 5.1 C10.3 3.9 12.4 3.9 13.4 5.2 C13.4 7.7 11.4 8.5 9.5 7.7 L8 7 L6.5 7.7 C4.6 8.5 2.6 7.7 2.6 5.2 Z" fill="#1e40af" />
                <circle cx="5.6" cy="6.2" r="1.05" fill="#ffffff" />
                <circle cx="10.4" cy="6.2" r="1.05" fill="#ffffff" />
              </g>
            </g>
            <!-- 行名字占位条用 fg-muted（≥3:1），比占位行深一档，突出「这一行就是 PageMask」 -->
            <rect x="178" y="68" width="54" height="6" rx="3" class="sk-ph-strong" />
            <!-- 行尾图钉（#191 沿用）：竖置图钉 = Chrome 扩展菜单里那枚固定钮，填充与拼图块同档 ≥3:1 -->
            <g class="sk-pin" transform="translate(268 63)">
              <circle cx="6" cy="3.2" r="3.2" />
              <path d="M3.6 6 L8.4 6 L7.2 10 L4.8 10 Z" />
              <path class="sk-pin-needle" d="M6 10 L6 16" />
            </g>
            <!-- 扩展列表行 3（中性灰占位） -->
            <rect x="150" y="84" width="20" height="20" rx="5" class="sk-ph" />
            <rect x="178" y="91" width="46" height="6" rx="3" class="sk-ph" />
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
              :media="{ mediaGray: false }"
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
  text-underline-offset: var(--pm-underline-offset);
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
/* ── 第 1 步示意图（#194）：把旧的 300×44 横条换成「工具栏 + 下拉菜单」两块，
 *   与真实 Chrome（拼图 → 扩展菜单里找到 PageMask 这一行 → 点行尾图钉）一致，依据见 SVG 模板注释。
 *   全部沿用 --pm-* token；理解内容必需的图形 ≥3:1（WCAG 1.4.11）：
 *   拼图块 / 图钉 / PageMask 行名条取 fg-muted（对底浅 4.51~4.83 / 深 5.16~5.98），
 *   工具栏与菜单边界取 border-control（≥3:1）；占位件沿用旧 sk-dot 口径，不参与 3:1。 ── */
.sk-bar {
  fill: var(--pm-bg-subtle);
  stroke: var(--pm-border-control);
}
/* 工具栏上别的图标位：纯装饰，不承载「理解内容」（沿用旧 sk-dot 口径，不参与 WCAG 1.4.11 的 3:1） */
.sk-dot {
  fill: var(--pm-border);
}
/* 拼图块 = 文案让人去点的「扩展程序」按钮，实心拼图块形状（不再是带四个点的方框）。
   fg-muted 对工具栏底（bg-subtle）浅 4.51 / 深 5.16 ≥3:1 */
.sk-puzzle {
  fill: var(--pm-fg-muted);
}
/* 下拉菜单面板：与工具栏分开的另一块圆角浮层。fill 用 bg（与卡片同底、靠边界分出形状），
   边界用控件色（≥3:1），暗色 / forced-colors 下都读得出「这是一块弹出的菜单」 */
.sk-menu {
  fill: var(--pm-bg);
  stroke: var(--pm-border-control);
}
/* 占位行（别的扩展）：中性灰占位，纯装饰，沿用 sk-dot 口径不参与 3:1 */
.sk-ph {
  fill: var(--pm-border);
}
/* PageMask 行的名字占位条：要看得清「这一行就是 PageMask」，按 ≥3:1 取 fg-muted（比占位深一档） */
.sk-ph-strong {
  fill: var(--pm-fg-muted);
}
/* 真实 PageMask 16px 图标（#194）：assets/icon/icon-16.svg 的图形原样内联到 .sk-icon 组里
   （fill 写在各形状上，与工具栏真图标同源、不依赖外部图片加载、不用字母 P / 自造符号，GLOSSARY Avoid）。
   它自带品牌蓝底（--pm-accent 同色相）与白纸，是一块自成一体的彩色方图，浅色 / 深色菜单底上都看得清；
   forced-colors 下随系统色落成高对比图标块，仍是行首一枚可辨的图标。
   图标的 fill 是固有品牌色，周围示意图形一律走 --pm-* token，两者不混、不新增颜色语义。 */
/* 图钉（#191 沿用）：填充与拼图块同一档（fg-muted，见 SVG 内注释），针尖用同色细线。
   针尖选择器带 .sk-pin 前缀压过上一条的 path 填充（同特异性、靠源码顺序取胜） */
.sk-pin circle,
.sk-pin path {
  fill: var(--pm-fg-muted);
}
.sk-pin path.sk-pin-needle {
  fill: none;
  stroke: var(--pm-fg-muted);
  stroke-width: 1.6;
  stroke-linecap: round;
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
