/**
 * 编辑面板自己的样式（右侧抽屉、卡片、高级后门）。
 * 与向导 / 悬浮按钮同一套注入方式（ui/adopt-css.ts）。
 */
import editorCss from './editor.css?inline';
import { createStyleAdopter } from '../adopt-css';

export const adoptEditorStyles = createStyleAdopter(editorCss);
