<template>
  <!-- 拖动把手的六点图形：全项目唯一一份（#83）——胶囊与向导工具条共用，
       此前向导用 ⠿ 字符、胶囊用 SVG，大小各平台不一，正是「同一控件两种长相」。
       不用点阵字符的原因：各平台字形大小不一，还会把字号压到 12px 以下。
       图形 10×16；命中区由各使用处的 CSS 撑到 ≥24×24（WCAG 2.5.8） -->
  <svg class="pm-grip-icon" viewBox="0 0 10 16" aria-hidden="true" fill="currentColor">
    <circle cx="2" cy="2" r="1.5" />
    <circle cx="8" cy="2" r="1.5" />
    <circle cx="2" cy="8" r="1.5" />
    <circle cx="8" cy="8" r="1.5" />
    <circle cx="2" cy="14" r="1.5" />
    <circle cx="8" cy="14" r="1.5" />
  </svg>
</template>
