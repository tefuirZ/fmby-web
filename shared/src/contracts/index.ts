/**
 * 前端合同总入口（docs/09 §7，与 docs/interfaces/webui.md 同步）
 *
 * 分节：auth / browse / playback / manage / settings / theme
 * 每条合同 = raw DTO + mapper 双件套；页面禁止直接 import raw DTO
 * （scripts/check-frontend-dupes.mjs 强制）。
 */

export * from './auth';
export * from './browse';
export * from './playback';
export * from './manage';
export * from './settings';
export * from './assets';
export * from './theme';
