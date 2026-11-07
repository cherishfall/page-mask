<template>
  <!-- 媒体（图片和视频变灰）：胶囊「媒体」钮与弹窗开关行共用一份（#132）。
       按下状态（实心/描边）由使用处在根节点上挂 data-state、用 CSS 控制 fill -->
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <circle cx="9" cy="9" r="2" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
</template>
