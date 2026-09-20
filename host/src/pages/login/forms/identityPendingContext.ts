/**
 * 三方登录回流上下文（sessionStorage）—— 解决「OAuth 回调只回 `code`/`state`，
 * 而 `state` 是 challenge_id（不透明）该怎么知道是哪个 provider」的问题。
 *
 * 机理（不改后端）：V2 `start_oauth` 的 `state` == challenge_id（V1 口径）。发起
 * Google 跳转前把 `{challengeId, provider}` 暂存；Google 回站时 URL 带
 * `state`，据此找回 provider，无需在 provider 控制台登记含 query 的回调 URL。
 *
 * 隐私/安全：仅存非敏感的流元信息（challenge_id 本就会出现在 OAuth state 里）；
 * 不含任何凭据。读取失败（隐私模式/禁用）时返回 null，调用方按「无法识别 provider」
 * 如实报错，不猜测。
 */

import type { IdentityProviderType } from '@fmby/v2-shared/contracts/auth';

const PENDING_KEY = 'fmby:identity:pending-login';

interface PendingIdentityContext {
  challengeId: string;
  provider: IdentityProviderType;
}

/** 跳转授权前保存上下文。 */
export function rememberPendingIdentity(context: PendingIdentityContext): void {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(context));
  } catch {
    // sessionStorage 不可用：回流将无法自动识别 provider，用户可重试（不静默成功）。
  }
}

/** 依 challenge_id（= OAuth state）取回发起时的 provider。 */
export function resolvePendingProvider(
  challengeId: string,
): IdentityProviderType | undefined {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<PendingIdentityContext>;
    if (parsed.challengeId === challengeId && typeof parsed.provider === 'string') {
      return parsed.provider as IdentityProviderType;
    }
  } catch {
    // 解析失败按「未知」处理。
  }
  return undefined;
}

/** 流结束后清理。 */
export function clearPendingIdentity(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // 清理失败不影响安全语义。
  }
}
