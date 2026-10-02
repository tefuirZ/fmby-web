/**
 * 账号三方身份绑定管理页纯逻辑（FE-IDENTITY-BINDINGS）。
 *
 * 无 JSX / 无副作用（仅 sessionStorage 回流上下文），供 node:test 直测；
 * 页面组件只做取数与渲染。
 */
import type {
  AccountIdentityBinding,
  IdentityLoginStart,
  IdentityProviderAvailability,
  IdentityProviderType,
} from '@fmby/v2-shared/contracts/auth';
import { bindingReadyProviders } from '@fmby/v2-shared/contracts/auth';

/** 已绑定行：绑定记录 + 展示名（缺可用性元信息时回落绑定显示名 / provider 名）。 */
export interface BoundBindingRow {
  provider: IdentityProviderType;
  displayName: string;
  binding: AccountIdentityBinding;
}

/** `complete` 入参（challengeId 必带；码字段按 action 分流）。 */
export interface BindingCompleteRequest {
  challengeId: string;
  code?: string;
  providerSubject?: string;
}

/**
 * 已绑定 / 可绑定分区。
 *
 * - `bound`：当前绑定记录——provider 不在可用性列表（如已停用）也**如实展示**，不丢绑定；
 * - `bindable`：`enabled && bindingEnabled`（fail-closed）且**尚未绑定**的 provider
 *   ——已绑定不重复发起，未开放绑定/未启用一律不出现（禁用或隐藏与后端对齐）。
 */
export function partitionBindingProviders(
  bindings: readonly AccountIdentityBinding[],
  providers: readonly IdentityProviderAvailability[],
): { bound: BoundBindingRow[]; bindable: IdentityProviderAvailability[] } {
  const availability = new Map(providers.map((provider) => [provider.provider, provider]));
  const bound = bindings.map((binding) => ({
    provider: binding.provider,
    displayName:
      availability.get(binding.provider)?.displayName ??
      binding.providerDisplayName ??
      binding.provider,
    binding,
  }));
  const boundProviders = new Set(bindings.map((binding) => binding.provider));
  const bindable = bindingReadyProviders(providers).filter(
    (provider) => !boundProviders.has(provider.provider),
  );
  return { bound, bindable };
}

/**
 * 构造 `complete` 入参（**challengeId 恒取自对应 start，不与其它流混淆**）。
 *
 * 码字段分流依据后端绑定面实现：
 * - `enter_code`（Email / Telegram 验证码）：后端 `CompleteIdentityBindingRequest`
 *   无 `verification_code` 字段，handler 把 `provider_subject` 接到 application 的
 *   `verification_code`（唯一验证码通道，见 `bindings.rs:296-303`）；
 * - `external_callback`（Google OAuth 回调）：走 `code`。
 *
 * 空码不编造字段——缺码交由后端如实拒绝。
 */
export function bindingCompleteRequest(
  start: Pick<IdentityLoginStart, 'challengeId' | 'action'>,
  enteredCode: string,
): BindingCompleteRequest {
  const code = enteredCode.trim();
  if (!code) {
    return { challengeId: start.challengeId };
  }
  return start.action === 'enter_code'
    ? { challengeId: start.challengeId, providerSubject: code }
    : { challengeId: start.challengeId, code };
}

/** 待完成绑定流（发起后 / OAuth 回站后）。 */
export interface PendingBinding {
  provider: IdentityProviderType;
  challengeId: string;
}

const PENDING_KEY = 'fmby:identity:pending-binding';

/** OAuth 跳转前记住发起上下文（仅流元信息；不含凭据）。 */
export function rememberPendingBinding(context: PendingBinding): void {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(context));
  } catch {
    // sessionStorage 不可用：回站无法自动识别 provider，用户可重试（不静默成功）。
  }
}

/** 依 challengeId（= OAuth state）反查发起时的 provider；不匹配按「未识别」处理。 */
export function resolvePendingBinding(challengeId: string): PendingBinding | undefined {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<PendingBinding>;
    if (
      parsed.challengeId === challengeId &&
      typeof parsed.provider === 'string'
    ) {
      return { challengeId: parsed.challengeId, provider: parsed.provider as IdentityProviderType };
    }
  } catch {
    // 解析失败按「未识别」处理（不猜测）。
  }
  return undefined;
}

/** 流结束后清理回流上下文。 */
export function clearPendingBinding(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // 清理失败不影响安全语义。
  }
}
