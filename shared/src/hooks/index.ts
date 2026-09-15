/**
 * 共享 Hooks 入口
 *
 * 在此统一导出所有可复用的自定义 Hook。
 * 注意：useSession 属 host 会话域（@/session），不在本包。
 */

export { useDebounce } from './useDebounce';
export { useDelayedTrigger } from './useDelayedTrigger';
export { useCredentialProbe } from './useCredentialProbe';
export type { CredentialProbeStatus, CredentialProbeResult } from './useCredentialProbe';
export { usePosterUrl, useBackdropUrl, generatePlaceholderColor } from './usePosterUrl';
export { useHoverWheelScroll } from './useHoverWheelScroll';
export { useViewportTrigger } from './useViewportTrigger';
export { useAmbientAccent } from './useAmbientAccent';
export type { UseAmbientAccentOptions } from './useAmbientAccent';
export { usePan115QrLogin } from './usePan115QrLogin';
export type {
  Pan115QrSession,
  UsePan115QrLoginOptions,
  UsePan115QrLoginResult,
} from './usePan115QrLogin';
export { useBatchSelection, useBatchRunner } from './useBatchOperation';
export type {
  UseBatchSelectionOptions,
  UseBatchSelectionResult,
  UseBatchRunnerResult,
} from './useBatchOperation';
