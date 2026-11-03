/**
 * 悬浮按钮自己的样式（胶囊、把手、菜单、删除确认框）。
 * 与向导同一套注入方式（ui/adopt-css.ts）；标题表单的 CSS 只由向导注入（wizard-styles）。
 */
import toggleCss from './toggle.css?inline';
import { createStyleAdopter } from '../adopt-css';

export const adoptToggleStyles = createStyleAdopter(toggleCss);
