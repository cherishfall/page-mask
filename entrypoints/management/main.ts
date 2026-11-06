import { createApp } from 'vue';
import '@/styles/base.css';
// 图标三态选择器（ui/title-icon/IconPicker.vue）与管理页共用这份样式（向导在 shadow 里另行注入）
import '@/ui/title-icon/fields.css';
import { initUiLanguage } from '@/ui/i18n';
import App from './App.vue';

// 挂载前先读设置里的界面语言（#57）：不会先闪一下默认语言，之后切换即时生效
await initUiLanguage({ title: (m) => m.management.pageTitle });
createApp(App).mount('#app');
