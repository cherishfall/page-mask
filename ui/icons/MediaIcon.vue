<template>
  <!-- 整页变灰（0.8.18，#156）：胶囊「媒体」钮与弹窗开关行共用一份（#132）。
       图标是对比度符（半填充圆，M3 contrast / macOS·GNOME 对比度设置同款）——
       功能从「图片变灰」升级为「整页变灰」后，原来「山 + 太阳」的图片符号与语义脱节，
       换成灰度 / 对比度的通行符号；内部组件名 MediaIcon 保留（内部命名，界面不出现）。
       按下状态由使用处在根节点上挂 data-state、用 CSS 控制：
       on = 右半圆盘填实（.pm-media-content），与关态的「只有描边（圆 + 直径线）」构成
       填实 vs 描边的形状信号（WCAG 1.4.1），与面具图标同一套语言；off = 全描边。
       一条路径两用：描边画出「圆 + 中线」，填实画出「右半圆盘」 -->
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle class="pm-media-frame" cx="12" cy="12" r="9" />
    <path class="pm-media-content" d="M12 3 A 9 9 0 0 1 12 21 Z" />
  </svg>
</template>
