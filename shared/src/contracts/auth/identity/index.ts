/**
 * 三方身份登录（SSO）契约域 —— THIRDPARTY-LOGIN-FLOW 前端消费面。
 *
 * 双件套：raw-types（wire 形状）+ mappers（读助手）+ api（HTTP 编排）。
 * 页面**不得**直接 import `./api` 或 `./raw-types`（见 check-contract-mappers.mjs）；
 * 请经 `../index`（auth barrel）取用 `identityLoginApi` 与 domain 类型。
 */

export { completeIdentityLogin, identityLoginApi } from './api';
export {
  loginReadyProviders,
  mapIdentityCallbackCapture,
  mapIdentityComplete,
  mapIdentityLoginStart,
  mapProviderAvailability,
  mapProviderList,
  mapTelegramLoginStatus,
  normalizeProviderType,
} from './mappers';
export type { IdentityCompleteOutcome } from './mappers';
export type {
  IdentityCallbackCapture,
  IdentityLoginCompleteResult,
  IdentityLoginStart,
  IdentityProviderAvailability,
  IdentityProviderType,
  IdentityStartInput,
  TelegramLoginStatus,
} from './types';
