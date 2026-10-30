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
        </div>
      </li>
    </ol>

    <div class="nav">
      <button v-if="step > 1" type="button" class="ghost" @click="step--">{{ t.onboarding.prev }}</button>
      <span v-else></span>
      <!-- 圆点只是装饰，步骤状态已由列表里的 aria-current 表达 -->
      <span class="dots" aria-hidden="true"><i v-for="i in t.onboarding.steps.length" :key="i" :class="{ on: i === step }"></i></span>
      <button v-if="step < t.onboarding.steps.length" type="button" class="primary" @click="step++">{{ t.onboarding.next }}</button>
      <button v-else type="button" class="primary" @click="finish">{{ t.onboarding.start }}</button>
    </div>
    <p class="tip">{{ t.onboarding.tip }}</p>
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
}
.nav button {
  padding: 8px 18px;
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
  margin-top: 26px;
  font-size: var(--pm-font-size-caption);
  color: var(--pm-fg-muted);
  text-align: center;
}
</style>
