import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'PageMask',
    description: '让非工作网站在一瞥之下看起来不像它自己。不设置，零影响。',
    permissions: ['storage', 'scripting', 'activeTab'],
    optional_host_permissions: ['*://*/*'],
  },
});
