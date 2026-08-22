/**
 * @fmby/v2-shared 根导出（shared 根导出为 chokepoint，仅本文件收口）
 *
 * 分层规则（docs/09-webui.md）：
 * - 子路径导入优先（@fmby/v2-shared/contracts/auth 等），根导出供快速起步；
 * - 会话 Provider / 路由 / 页面域在 host（@fmby/v2-host），不在本包。
 */

export * from './api';
export * from './query';
export * from './errors';
export * from './time';
export * from './theme';
export * from './types';
export * from './contracts';
