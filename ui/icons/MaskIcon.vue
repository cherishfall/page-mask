<template>
  <!-- 主按钮（按你的设置显示 / 原样）：0.8.9（#137）起换威尼斯面具——Lucide venetian-mask
       的路径（官方标签 mask / incognito / secret，与产品名 Page Mask 对得上）。旧版实心
       蛋形 + 两只小圆眼在 13px 下近骷髅 / 头套剪影（0.8.6 / 0.8.7 两轮目检一致反馈
       「凶、认不出」），横长圆润轮廓 + 弯眼缝符合「曲线比尖角亲和」的既有研究。
       填实态（开）身体填 currentColor、眼缝描选中态容器色（--pm-fg），读得出挖孔；
       描边态（关）与胶囊其他图标同族（24 盒描边，#132） -->
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path
      class="pm-mask-body"
      d="M4 6a2 2 0 0 0-2 2v4a5 5 0 0 0 5 5 8 8 0 0 1 5 2 8 8 0 0 1 5-2 5 5 0 0 0 5-5V8a2 2 0 0 0-2-2h-3a8 8 0 0 0-5 2 8 8 0 0 0-5-2z"
    />
    <path class="pm-mask-eye" d="M6 11c1.5 0 2.5.5 3 2" />
    <path class="pm-mask-eye" d="M18 11c-1.5 0-2.5.5-3 2" />
  </svg>
</template>
