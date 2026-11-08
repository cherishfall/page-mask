<template>
  <!-- 主按钮（按你的设置显示 / 原样）：PageMask 的本名隐喻——按设置 = 戴上面具（填实），
       原样 = 摘下面具（描边）。0.8.6 起取代「圆点 + 文字」：文字只为圆点不可读而存在，
       图标有了语义文字就是冗余。眼睛挖孔用 evenodd 子路径实现：填实态两只眼睛透出来，
       读得出「面具」而不是一坨色块。与胶囊其他图标同族（24 盒描边，#132） -->
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
      fill-rule="evenodd"
      d="M12 2.5c4.6 0 8.5 2.8 8.5 6.7 0 5.6-3.8 12.3-8.5 12.3S3.5 14.8 3.5 9.2C3.5 5.3 7.4 2.5 12 2.5zM8.8 8.7a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zm6.4 0a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z"
    />
  </svg>
</template>
