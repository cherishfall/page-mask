import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'PageMask',
    description: '页面清爽模式：一键收起网页干扰元素，专注阅读；自定义标签页标题与图标。不设置，零影响。',
    icons: { 128: '/icon/128.png' },
    permissions: ['storage', 'scripting', 'activeTab'],
    optional_host_permissions: ['*://*/*'],
  },
});
