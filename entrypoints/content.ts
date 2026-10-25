export default defineContentScript({
  // 注意：matches 用一个永不命中的占位地址，仅为让 WXT 构建出
  // content-scripts/content.js 产物；真实站点由后台动态注册（见 ADR-0002）。
  matches: ['https://pagemask.invalid/*'],
  main() {
    // 内容脚本主体（标题/图标伪装、悬浮按钮、向导、体检），随任务票充实
  },
});
