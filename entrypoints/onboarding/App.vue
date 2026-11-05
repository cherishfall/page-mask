<template>
  <main class="page">
    <h1>{{ t.onboarding.title }}</h1>
    <p class="sub">{{ t.onboarding.sub }}</p>

    <ol class="steps">
      <li
        v-for="(s, i) in t.onboarding.steps"
        :key="i"
        class="step"
        :class="{ active: step === i + 1, done: step > i + 1 }"
        :aria-current="step === i + 1 ? 'step' : undefined"
      >
        <div class="num" aria-hidden="true">{{ i + 1 }}</div>
        <div class="body">
          <h2>
            {{ s.title }}<span v-if="step > i + 1" class="visually-hidden">{{ t.onboarding.done }}</span>
          </h2>
          <p>{{ s.text }}</p>
          <ul v-if="s.features.length" class="features">
            <li v-for="line in s.features" :key="line">{{ line }}</li>
          </ul>
          <!-- 每步一张图：第 2、3 步直接渲染真实组件（#103），弹窗 / 胶囊改版时示意图自动跟上 -->
          <div class="art" aria-hidden="true" inert>
            <svg v-if="i === 0" class="art-svg" viewBox="0 0 300 44" role="img">
              <rect x="1" y="6" width="298" height="32" rx="16" class="sk-bar" />
              <circle cx="26" cy="22" r="9" class="sk-dot" />
              <rect x="126" y="14" width="26" height="16" rx="4" class="sk-puzzle" />
              <path d="M146 34 l6 8 M146 34 l-6 8" class="sk-line" />
              <rect x="182" y="8" width="28" height="28" rx="8" class="sk-on" />
              <text x="196" y="27" text-anchor="middle" class="sk-on-text">P</text>
              <circle cx="240" cy="22" r="9" class="sk-dot" />
              <circle cx="266" cy="22" r="9" class="sk-dot" />
            </svg>
            <div v-else-if="i === 1" class="popup-preview">
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
              />
            </div>
            <div v-else class="art-capsule">
              <FloatingToggle
                state="disguised"
                :position="null"
                :mini="false"
                site-label="example.com"
                :opacity="1"
                preview
              />
            </div>
          </div>
        </div>
      </li>
    </ol>

    <!-- 这句讲的是弹窗里那两个入口在哪，属于内容说明，放在按钮行上面，不塞进操作栏 -->
    <p class="tip">{{ t.onboarding.tip }}</p>

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
import { onMounted, ref } from 'vue';
import { browser } from 'wxt/browser';
import { formatShortcut, isMacPlatform } from '@/core/shortcut';
import FloatingToggle from '@/ui/FloatingToggle.vue';
import PopupBody from '@/ui/popup/PopupBody.vue';
import { t } from '@/ui/i18n';
import { ensureTogglePreviewStyles } from '@/ui/toggle/preview-style';

const step = ref(1);
/** 弹窗示意图上的快捷键：与真实弹窗一致，取当前实际绑定（没绑定就不显示） */
const coverShortcut = ref('');

onMounted(async () => {
  ensureTogglePreviewStyles();
  try {
    const commands = await browser.commands.getAll();
    const shortcut = commands.find((c) => c.name === 'toggle-curtain')?.shortcut ?? '';
    coverShortcut.value = formatShortcut(shortcut, isMacPlatform());
  } catch {
    coverShortcut.value = '';
  }
});

function finish() {
  window.close();
}
</script>

<style>
/* 共享样式（字体、颜色、按钮）来自 @/styles/base.css */
body {
  background: var(--pm-bg-subtle);
}
.page {
  max-width: 560px;
  margin: 48px auto;
  padding: 0 var(--pm-space-6);
}
h1 {
  font-size: var(--pm-font-size-heading);
  margin: 0;
}
.sub {
  color: var(--pm-fg-muted);
  margin: var(--pm-space-2) 0 var(--pm-space-6);
}
.steps {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--pm-space-3);
}
.step {
  display: flex;
  gap: 14px;
  background: var(--pm-bg);
  border: 1px solid var(--pm-border);
  border-radius: var(--pm-radius-card);
  padding: var(--pm-space-4);
}
/* 当前步骤：主色描边加粗（不再靠透明度区分，未激活步骤文字也要清楚可读） */
.step.active {
  border-color: var(--pm-accent);
  box-shadow: inset 0 0 0 1px var(--pm-accent);
}
.num {
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid var(--pm-border-control);
  background: var(--pm-bg);
  color: var(--pm-fg-muted);
  font-weight: var(--pm-font-weight-strong);
  display: flex;
  align-items: center;
  justify-content: center;
}
.step.active .num {
  background: var(--pm-accent);
  border-color: var(--pm-accent);
  color: var(--pm-on-accent);
}
.step.done .num {
  background: var(--pm-success);
  border-color: var(--pm-success);
  color: var(--pm-on-success);
}
.step h2 {
  font-size: var(--pm-font-size-title);
  margin: 0 0 var(--pm-space-1);
}
.step p {
  margin: 0;
  color: var(--pm-fg-muted);
  line-height: 1.6;
}
/* 三件功能（#103）：一行一件，名字在前、结果在后 */
.features {
  margin: var(--pm-space-2) 0 0;
  padding-left: 1.2em;
  color: var(--pm-fg-muted);
  line-height: 1.6;
}
.features li + li {
  margin-top: 2px;
}
.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: var(--pm-space-6);
  /* 主操作不压在折叠线下（#92 审查）：整页内容超过一屏，底栏滚动时贴着视口底部走 */
  position: sticky;
  bottom: 0;
  padding: var(--pm-space-2) 0;
  background: var(--pm-bg-subtle);
}
/* 底栏两个按钮是这一步的主要提交：用 40 高（docs/design-ui.md §四） */
.nav button {
  min-block-size: var(--pm-control-lg);
  padding-inline: var(--pm-space-4);
}
.dots {
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
  margin-top: var(--pm-space-3);
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
.sk-puzzle {
  fill: var(--pm-bg-subtle);
  stroke: var(--pm-border-control);
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

/* 真实弹窗（#103）：白色卡片 + 阴影，宽度与真身一致 */
.popup-preview {
  width: min(320px, 100%);
  background: var(--pm-bg);
  border: 1px solid var(--pm-border);
  border-radius: var(--pm-radius-card);
  box-shadow: var(--pm-shadow-overlay);
  overflow: hidden;
}
/* 真实胶囊（#103）：一块页面感的浅底，里面是 position: static 的预览 */
.art-capsule {
  display: flex;
  align-items: center;
  padding: var(--pm-space-4);
  background: var(--pm-bg-subtle);
  border: 1px dashed var(--pm-border);
  border-radius: var(--pm-radius-card);
}
</style>
