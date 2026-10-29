/**
 * 悬浮按钮自己的样式（胶囊、把手、菜单、标题与图标小面板、删除确认框）。
 * 与向导 / 编辑面板同一套注入方式（ui/adopt-css.ts）；表单部分的 CSS 与向导共用同一份
 * （ui/title-icon/fields.css），两处不各写一套。
 */
import toggleCss from './toggle.css?inline';
import fieldsCss from '../title-icon/fields.css?inline';
import { createStyleAdopter } from '../adopt-css';

export const adoptToggleStyles = createStyleAdopter(toggleCss, fieldsCss);
