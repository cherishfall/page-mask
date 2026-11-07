<template>
  <!-- 媒体（图片和视频变灰）：胶囊「媒体」钮与弹窗开关行共用一份（#132）。
       按下状态由使用处在根节点上挂 data-state、用 CSS 控制：
       on = 只把框里的内容（山 + 太阳）填实，外框保持描边——0.8.3 起不再整颗填实，
       整颗填实会糊成一个方块，读不出「图片变灰」；off = 全描边 -->
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <rect class="pm-media-frame" x="3" y="3" width="18" height="18" rx="3" />
    <g class="pm-media-content">
      <circle cx="9" cy="9" r="2" />
      <polyline points="21 15 16 10 5 21" />
    </g>
  </svg>
</template>
