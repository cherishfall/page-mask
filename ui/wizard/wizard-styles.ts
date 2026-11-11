/**
 * 设置向导自己的样式（工具条、浮层、页内标记），以及第 1 步复用的小面板表单样式
 * （ui/title-icon/fields.css，与页面 ⋯ 菜单共用的那一份）。
 * 和共享基础样式（ui/shadow-styles.ts）同一种注入方式，见 ui/adopt-css.ts。
 *
 * ⓘ 信息标的样式（styles/info-tip.css）也在这里接进同一条 shadow 通道：组件可能出现在
 * 向导的 shadow root 里，扩展页面那份全局 @import（base.css）穿不过 shadow boundary（#161）。
 */
import wizardCss from './wizard.css?inline';
import fieldsCss from '../title-icon/fields.css?inline';
import infoTipCss from '../../styles/info-tip.css?inline';
import { createStyleAdopter } from '../adopt-css';

export const adoptWizardStyles = createStyleAdopter(wizardCss, fieldsCss, infoTipCss);
