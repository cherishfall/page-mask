<template>
  <!-- 悬浮按钮（#181）：四段胶囊的简化轮廓——整根胶囊外框 + 三道分隔线。
       弹窗辅助行补上与另外三行同源的 16px 槽位图标（.popup-row-icon + 8px gap），
       让四行标签文字落在同一条起点线上（Apple HIG Label：lists align titles across rows）。
       只画形状、不表达开关状态；读屏名仍由 label[for] 提供，装饰图标 aria-hidden、无 aria-label。
       界面叫「悬浮按钮」，不用「悬浮胶囊」等形状名（GLOSSARY「悬浮切换按钮」_Avoid_）。
       24 盒描边风格照 MediaIcon / EyeOpenIcon；颜色走 currentColor / --pm-*，
       尺寸与 flex 槽位由使用处 .popup-row-icon 约定（#132 同一份图标体系，不自创第二套）。 -->
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path :d="CAPSULE_OUTLINE_PATH" />
  </svg>
</template>

<script setup lang="ts">
import { CAPSULE_OUTLINE_PATH } from './paths';
</script>
