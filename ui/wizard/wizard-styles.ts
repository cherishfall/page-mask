/**
 * 设置向导自己的样式（工具条、浮层、页内标记），以及第 1 步复用的小面板表单样式
 * （ui/title-icon/fields.css，与页面 ⋯ 菜单共用的那一份）。
 * 和共享基础样式（ui/shadow-styles.ts）同一种注入方式，见 ui/adopt-css.ts。
 */
import wizardCss from './wizard.css?inline';
import fieldsCss from '../title-icon/fields.css?inline';
import { createStyleAdopter } from '../adopt-css';

export const adoptWizardStyles = createStyleAdopter(wizardCss, fieldsCss);
