/**
 * 139 凭据过期判定（FE-PARITY-YUN139-EXPIRY-GUIDE）。
 *
 * 依据（后端 domain，非前端猜测）：
 * - `crates/fmby-v2-domain/src/yun139_accounts.rs:19-49`
 *   `Yun139CredentialProfileStatus` 四态：Pending / Active / AuthExpired / Disabled，
 *   且 `as_str()` 会把它写到档案的 `status` 字段。
 * - 同一 DTO 的 `last_error_kind` 也写 `AuthExpired`
 *   （冻结字段测试 `crates/fmby-v2-server/tests/yun139_accounts_e2e.rs:70`）。
 * - 同一词表在 pan115_sync.rs / microsoft_accounts.rs / upstream.rs 复用
 *   （`Self::AuthExpired => "AuthExpired"`），属跨 provider 统一口径。
 *
 * ★诚实边界：只认后端给出的 `AuthExpired` 一词；其它未见值（含 null）
 *   一律归 none / unknown，不本地扩张词表、不伪造过期结论。
 */

import type { Yun139CredentialProfile } from '@fmby/v2-shared/contracts/manage/yun139';

/** 后端 domain `Yun139CredentialProfileStatus` 四态 wire 词。 */
export type Yun139CredentialProfileStatus =
  | 'Pending'
  | 'Active'
  | 'AuthExpired'
  | 'Disabled';

/** 唯一认的过期词（跨 provider 统一）。 */
export const YUN139_AUTH_EXPIRED = 'AuthExpired';

export type CredentialExpiryKind = 'expired' | 'unknown' | 'none';

export interface CredentialExpiryGuidance {
  kind: CredentialExpiryKind;
  /** 管理员可见原因；unknown 时为 null（不猜）。 */
  reason: string | null;
  /** 后端原始错误文案（无则 null，不编造）。 */
  backendMessage: string | null;
}

/**
 * 判定凭据是否需要引导重新授权。
 *
 * 优先用后端状态词 `AuthExpired`（ authoritative ）；辅以后端 last_error_kind。
 * 时间戳不作为判定依据（可能缺失/时区歧义），仅当两者都无时不参与。
 */
export function resolveCredentialExpiry(
  profile: Pick<Yun139CredentialProfile, 'status' | 'lastErrorKind' | 'lastErrorMessage'> | null | undefined,
): CredentialExpiryGuidance {
  if (!profile) {
    return { kind: 'unknown', reason: null, backendMessage: null };
  }

  const expired =
    profile.status === YUN139_AUTH_EXPIRED || profile.lastErrorKind === YUN139_AUTH_EXPIRED;

  if (expired) {
    return {
      kind: 'expired',
      reason: '凭据授权已过期，需重新扫码授权。',
      backendMessage: profile.lastErrorMessage ?? null,
    };
  }

  return { kind: 'none', reason: null, backendMessage: null };
}

/** 是否展示「待确认授权」提示（Pending 态）。 */
export function isPendingAuthorization(profile: Pick<Yun139CredentialProfile, 'status'> | null): boolean {
  return profile?.status === 'Pending';
}

/** 是否已被管理员停用（Disabled 态）。 */
export function isDisabled(profile: Pick<Yun139CredentialProfile, 'status'> | null): boolean {
  return profile?.status === 'Disabled';
}
