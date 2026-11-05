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
          <!-- 每步一张小图：文字只留一句，细节看图（#93） -->
          <div class="art" aria-hidden="true">
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
            <div v-else-if="i === 1" class="art-popup">
              <div class="ap-title">PageMask</div>
              <div class="ap-btn ap-btn-primary">收起内容</div>
              <div class="ap-btn">标题和图标</div>
              <div class="ap-row"><span class="ap-switch"></span>遮住这一页</div>
              <div class="ap-foot"><span>全部网站设置</span><span>插件设置</span></div>
            </div>
            <div v-else-if="i === 2" class="art-flow">
              <span class="af-box">页面上点一下</span>
              <span class="af-arrow">→</span>
              <span class="af-box">看效果</span>
              <span class="af-arrow">→</span>
              <span class="af-box af-done">保存</span>
            </div>
            <div v-else class="art-capsule">
              <span class="ac-pill">
                <svg viewBox="0 0 10 16" class="ac-grip"><circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/><circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="2" cy="14" r="1.5"/><circle cx="8" cy="14" r="1.5"/></svg>
                <span class="ac-main"><span class="ac-dot on"></span>按设置</span>
                <svg class="ac-eye" viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
                <span class="ac-ico">⋯</span>
                <span class="ac-ico">‹</span>
              </span>
              <span class="ac-note">← 右下角的日常开关</span>
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
import { ref } from 'vue';
import { t } from '@/ui/i18n';

const step = ref(1);

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

/* ── 每步一张小图（#93）：文字只留一句，细节看图；全部用 tokens 配色 ── */
.art {
  margin-top: var(--pm-space-2);
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
.art-popup {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: min(240px, 100%);
  padding: 10px;
  background: var(--pm-bg);
  border: 1px solid var(--pm-border-control);
  border-radius: 10px;
}
.ap-title {
  font-size: 13px;
  font-weight: var(--pm-font-weight-strong);
}
.ap-btn {
  padding: 4px 8px;
  border: 1px solid var(--pm-border-control);
  border-radius: 999px;
  background: var(--pm-bg);
  color: var(--pm-fg);
  font-size: 12px;
  text-align: center;
}
.ap-btn-primary {
  background: var(--pm-accent);
  border-color: var(--pm-accent);
  color: var(--pm-on-accent);
}
.ap-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--pm-fg);
}
.ap-switch {
  width: 20px;
  height: 12px;
  border-radius: 999px;
  background: var(--pm-accent);
  position: relative;
}
.ap-switch::after {
  content: '';
  position: absolute;
  right: 1px;
  top: 1px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--pm-on-accent);
}
.ap-foot {
  display: flex;
  justify-content: space-between;
  padding-top: 6px;
  border-top: 1px solid var(--pm-border);
  font-size: var(--pm-font-size-caption);
  color: var(--pm-fg-muted);
}
.art-flow {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.af-box {
  padding: 6px 10px;
  border: 1px solid var(--pm-border-control);
  border-radius: 8px;
  background: var(--pm-bg);
  color: var(--pm-fg);
  font-size: 12px;
}
.af-arrow {
  color: var(--pm-fg-muted);
}
.af-done {
  background: var(--pm-accent);
  border-color: var(--pm-accent);
  color: var(--pm-on-accent);
  font-weight: var(--pm-font-weight-strong);
}
.art-capsule {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ac-pill {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px 6px;
  background: var(--pm-bg);
  border: 1px solid var(--pm-border-control);
  border-radius: 999px;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 0.35);
}
.ac-grip {
  width: 10px;
  height: 16px;
  fill: var(--pm-fg-muted);
}
.ac-main {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--pm-bg-subtle);
  color: var(--pm-fg);
  font-size: 12px;
}
.ac-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  border: 1px solid var(--pm-accent);
}
.ac-dot.on {
  background: var(--pm-accent);
}
.ac-ico {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  color: var(--pm-fg-muted);
  font-size: 13px;
  line-height: 1;
}
.ac-eye {
  width: 13px;
  height: 13px;
  fill: none;
  stroke: var(--pm-fg-muted);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.ac-note {
  font-size: 12px;
  color: var(--pm-fg-muted);
}
</style>
