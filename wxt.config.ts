import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'PageMask',
    description: '页面清爽模式：一键收起网页干扰元素，专注阅读；自定义标签页标题与图标。不设置，零影响。',
    // 四个尺寸均由 scripts/gen-icons.mjs 从 assets/icon/*.svg 生成；路径不带前导斜杠。
    icons: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' },
    action: {
      default_icon: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' },
    },
    permissions: ['storage', 'scripting', 'activeTab'],
    optional_host_permissions: ['*://*/*'],
  },
});
