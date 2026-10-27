<template>
  <main class="page">
    <h1>欢迎使用 PageMask</h1>
    <p class="sub">一键收起网页上的干扰内容，给自己一个清爽、专注的阅读界面。你不设置的网站，PageMask 完全不碰。</p>

    <ol class="steps">
      <li
        v-for="(s, i) in STEPS"
        :key="s.title"
        class="step"
        :class="{ active: step === i + 1, done: step > i + 1 }"
        :aria-current="step === i + 1 ? 'step' : undefined"
      >
        <div class="num" aria-hidden="true">{{ i + 1 }}</div>
        <div class="body">
          <h2>
            {{ s.title }}<span v-if="step > i + 1" class="visually-hidden">（已完成）</span>
          </h2>
          <p>{{ s.text }}</p>
        </div>
      </li>
    </ol>

    <div class="nav">
      <button v-if="step > 1" type="button" class="ghost" @click="step--">上一步</button>
      <span v-else></span>
      <!-- 圆点只是装饰，步骤状态已由列表里的 aria-current 表达 -->
      <span class="dots" aria-hidden="true"><i v-for="i in STEPS.length" :key="i" :class="{ on: i === step }"></i></span>
      <button v-if="step < STEPS.length" type="button" class="primary" @click="step++">下一步</button>
      <button v-else type="button" class="primary" @click="finish">开始使用</button>
    </div>
    <p class="tip">小提示：管理全部网站、导出 / 导入设置，都在 PageMask 图标菜单的「管理全部网站」里。</p>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const STEPS = [
  {
    title: '把 PageMask 固定到工具栏',
    text: '新装的扩展默认收在菜单里。点浏览器右上角的拼图图标（扩展程序），在列表里找到 PageMask，点它右边的图钉，图标就会一直显示在工具栏上。',
  },
  {
    title: '打开你想变清爽的网站',
    text: '比如你常用的阅读、学习类网站。PageMask 不会主动处理任何网站，只有你自己开启过的网站才会生效。',
  },
  {
    title: '点工具栏图标，选要收起的内容',
    text: '点 PageMask 图标，选「为当前网站开启清爽模式」。鼠标移到页面上会高亮元素，点一下选中（可以连续选），选到内层文字时可以用「选大一点 / 选小一点」调整。',
  },
  {
    title: '预览、保存，清爽常驻',
    text: '预览时可以给每一项换收起方案（彻底移除 / 原地留白 / 遮罩覆盖）。保存后页面立刻变清爽；标签页也可以换成更简洁的标题和图标（在管理页设置）。想看原样？点页面右下角的小按钮就能切换。',
  },
] as const;

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
