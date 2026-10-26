<template>
  <div class="page">
    <h1>欢迎使用 PageMask 🎭</h1>
    <p class="sub">一键收起网页上的干扰元素，给自己一个清爽专注的阅读界面。你不设置，插件对任何网站零影响。</p>

    <div class="steps">
      <div class="step" :class="{ active: step === 1, done: step > 1 }">
        <div class="num">1</div>
        <div class="body">
          <h2>打开你想变清爽的网站</h2>
          <p>比如微信读书、得到、极客时间。PageMask 不会主动打扰任何网站——只有你主动添加的站点才会被处理。</p>
        </div>
      </div>
      <div class="step" :class="{ active: step === 2, done: step > 2 }">
        <div class="num">2</div>
        <div class="body">
          <h2>点工具栏图标，选要去掉的干扰</h2>
          <p>点击浏览器右上角的 PageMask 图标 → 「为当前网站开启清爽模式」。鼠标悬停会高亮元素，点击选中（可连选），选到内层文字可以用「选大一点 / 选小一点」调整。</p>
        </div>
      </div>
      <div class="step" :class="{ active: step === 3, done: step > 3 }">
        <div class="num">3</div>
        <div class="body">
          <h2>预览、保存，清爽常驻</h2>
          <p>预览时可以给每个元素换收起方案（彻底移除 / 原地留白 / 遮罩覆盖）。保存后页面即刻清爽，标签页标题和图标也会换成低调的样子。想临时还原？点页面右下角的小按钮就行。</p>
        </div>
      </div>
    </div>

    <div class="nav">
      <button v-if="step > 1" class="ghost" @click="step--">上一步</button>
      <span class="dots"><i v-for="i in 3" :key="i" :class="{ on: i === step }"></i></span>
      <button v-if="step < 3" class="primary" @click="step++">下一步</button>
      <button v-else class="primary" @click="finish">开始使用</button>
    </div>

    <p class="tip">小提示：管理全部站点、导出/导入配置，都在工具栏图标的「管理全部站点」里。</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const step = ref(1);

function finish() {
  window.close();
}
</script>

<style>
body {
  margin: 0;
  background: #f6f7f9;
  font-family: system-ui, -apple-system, 'PingFang SC', sans-serif;
  color: #222;
}
.page {
  max-width: 560px;
  margin: 48px auto;
  padding: 0 20px;
}
h1 {
  font-size: 22px;
}
h2 {
  font-size: 15px;
  margin: 0 0 4px;
}
.sub {
  color: #777;
  font-size: 13px;
  margin: 6px 0 28px;
}
.steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.step {
  display: flex;
  gap: 14px;
  background: #fff;
  border: 1px solid #e8eaee;
  border-radius: 12px;
  padding: 16px;
  opacity: 0.55;
  transition: opacity 0.2s;
}
.step.active,
.step.done {
  opacity: 1;
}
.step.active {
  border-color: #3575e0;
}
.num {
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #e8eaee;
  color: #666;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.step.active .num {
  background: #3575e0;
  color: #fff;
}
.step.done .num {
  background: #3aa655;
  color: #fff;
}
.step p {
  margin: 0;
  font-size: 13px;
  color: #555;
  line-height: 1.6;
}
.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 24px;
}
.dots {
  display: flex;
  gap: 6px;
}
.dots i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d5d8de;
}
.dots i.on {
  background: #3575e0;
}
button {
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 8px 18px;
  font-size: 14px;
  cursor: pointer;
  background: #fafafa;
}
button.primary {
  background: #3575e0;
  border-color: #3575e0;
  color: #fff;
}
button.ghost {
  background: transparent;
}
.tip {
  margin-top: 26px;
  font-size: 12px;
  color: #999;
  text-align: center;
}
</style>
