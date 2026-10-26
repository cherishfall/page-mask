/**
 * PageMask 后台入口。引擎实现见 core/background-engine.ts（可注入 browser，便于单测）。
 */
import { createBackground } from '@/core/background-engine';

export default defineBackground(() => {
  createBackground({ browser });
});
