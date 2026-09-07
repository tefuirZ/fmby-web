/**
 * 前端合同总入口（docs/09 §7，与 docs/interfaces/webui.md 同步）
 *
 * 分节：auth / browse / playback / manage / settings / theme
 * 每条合同 = raw DTO + mapper 双件套；页面禁止直接 import raw DTO
 * （scripts/check-frontend-dupes.mjs 强制）。
 *
 * 版本：统一版本号逻辑（docs/03-releases.md）——与后端/前端包用同一个版本号。
 */

export const CONTRACT_VERSION = '0.1.43';

export * from './auth';
export * from './browse';
export * from './playback';
export * from './manage';
export * from './settings';
export * from './assets';
export * from './theme';
