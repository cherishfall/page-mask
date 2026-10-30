import { createApp } from 'vue';
import '@/styles/base.css';
import { initUiLanguage } from '@/ui/i18n';
import App from './App.vue';

// 挂载前先读设置里的界面语言（#57）：不会先闪一下默认语言，之后切换即时生效
await initUiLanguage();
createApp(App).mount('#app');
