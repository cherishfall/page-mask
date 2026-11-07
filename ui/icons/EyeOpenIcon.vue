<template>
  <!-- 睁眼（恢复）：弹窗「恢复这一页」与幕布上的恢复按钮共用一份轮廓路径（#132） -->
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path :d="EYE_OUTLINE_PATH" />
    <circle cx="12" cy="12" r="3" />
  </svg>
</template>

<script setup lang="ts">
import { EYE_OUTLINE_PATH } from './paths';
</script>
