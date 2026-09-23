/**
 * 挂载凭据状态呈现（W5-A：CRED-EXPIRY-WIRE 前端消费）。
 *
 * 后端事实：
 * - `credential_status` 四态由 `derive_credential_status`
 *   （`crates/fmby-v2-server/src/bridges/manage/helpers.rs:47`）派生，
 *   列表（`mount.rs:180`）与详情（`:205`）**同值同源**
 *   （`read_health.rs:85` 明确 `credential_status: summary.credential_status.clone()`）。
 * - `last_fault_kind`（观察面）来自扫描观测 `last_failure_kind`
 *   （`provider_health.rs:172`），是**另一条证据链**，且可能为 null（无观测）。
 *
 * ★合并判据（本卡的去重规则，避免同一事实两处告警）：
 *   1. **徽标与行动入口唯一来源 = `credentialStatus`**（权威状态，恒在场）。
 *   2. `lastFaultKind === 'credential_expired'` **不再单独弹告警**，
 *      仅在 `credentialStatus !== 'expired'` 时作为「观察面补充」附加一句后端文案
 *      （诊断/观察滞后于状态是可能的：状态已恢复但观测未刷新）。
 *   3. 两者一致时只显示一条（不重复）。
 *   4. 无观测（null）→ 不显示任何故障补充，也不猜。
 *
 * ★不回显任何密钥/密封引用：本模块只消费四态枚举与后端文案。
 */

import type { ManageMountCredentialStatus } from '@fmby/v2-shared/contracts/manage';

/** 观察面故障类别（凭据过期，errno wire 词）。 */
export const MOUNT_FAULT_CREDENTIAL_EXPIRED = 'credential_expired';

export interface CredentialBadgeView {
  /** 是否显示凭据 UI；`not_required` 与未知均为 false。 */
  visible: boolean;
  /** 徽标文案。 */
  label: string;
  /** 徽标语义色（与 StatusBadge variant 对齐）。 */
  variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  /** 是否需要行动入口（重绑/绑定）。 */
  needsAction: boolean;
  /** 行动入口文案；不需要时为 null。 */
  actionLabel: string | null;
  /** 补充说明（含观察面补充）；无则 null。 */
  hint: string | null;
}

const UNKNOWN: CredentialBadgeView = {
  visible: false,
  label: '未知',
  variant: 'neutral',
  needsAction: false,
  actionLabel: null,
  hint: null,
};

/**
 * 四态 → 呈现。
 * `null` / 未识别 ⇒ 未知（visible=false，不猜、不伪造）。
 */
export function resolveCredentialBadge(
  credentialStatus: ManageMountCredentialStatus | null | undefined,
  lastFaultAction?: string | null,
): CredentialBadgeView {
  if (credentialStatus === 'expired') {
    return {
      visible: true,
      label: '凭据已过期',
      variant: 'danger',
      needsAction: true,
      actionLabel: resolveCredentialAction(credentialStatus, '')?.label ?? '重新绑定凭据',
      hint: lastFaultAction ?? '该数据源凭据已过期，请重新授权后再使用。',
    };
  }

  if (credentialStatus === 'unbound') {
    return {
      visible: true,
      label: '未绑定凭据',
      variant: 'warning',
      needsAction: true,
      actionLabel: resolveCredentialAction(credentialStatus, '')?.label ?? '绑定凭据',
      hint: '该数据源尚未绑定凭据，绑定后才能正常访问。',
    };
  }

  if (credentialStatus === 'bound') {
    return {
      visible: true,
      label: '凭据正常',
      variant: 'success',
      needsAction: false,
      actionLabel: null,
      // 观察面仍报过期：状态已恢复但观测未刷新 → 只做一句补充，不重复告警
      hint: lastFaultAction ? `观察面仍记录：${lastFaultAction}` : null,
    };
  }

  // not_required：Local 等无需凭据 → 完全不显示凭据 UI
  if (credentialStatus === 'not_required') {
    return {
      visible: false,
      label: '无需凭据',
      variant: 'neutral',
      needsAction: false,
      actionLabel: null,
      hint: null,
    };
  }

  return UNKNOWN;
}

/**
 * 观察面（`last_fault_kind`）是否应作为补充提示出现。
 * ★仅当权威状态**不是** expired 时才返回 true（是 expired 时已由徽标统一告警）。
 */
export function shouldShowFaultSupplement(
  credentialStatus: ManageMountCredentialStatus | null | undefined,
  lastFaultKind: string | null | undefined,
): boolean {
  if (credentialStatus === 'expired') {
    return false;
  }
  return lastFaultKind === MOUNT_FAULT_CREDENTIAL_EXPIRED;
}

/**
 * ★安全断言用：凭据呈现不得包含任何密钥/密封引用形态。
 * 返回匹配到的可疑串（空数组 = 干净）。
 */
export function findSecretLeaks(text: string): string[] {
  const patterns: RegExp[] = [
    /__sealed:[A-Za-z0-9_-]+/g, // 后端密封引用前缀（§3.3）
    /(?:password|secret|token|access[_-]?key|cookie)\s*[:=]/gi,
  ];
  const leaks: string[] = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      leaks.push(match[0]);
    }
  }
  return leaks;
}

/**
 * ★两个面（列表 / 详情）必须**同一函数**产出的动作目标，避免口径漂移。
 * 不需要动作（bound / not_required / 未知）→ null。
 */
export interface CredentialActionTarget {
  mountId: string;
  kind: 'bind' | 'rebind';
  label: string;
}

export function resolveCredentialAction(
  credentialStatus: ManageMountCredentialStatus | null | undefined,
  mountId: string,
): CredentialActionTarget | null {
  if (credentialStatus === 'expired') {
    return { mountId, kind: 'rebind', label: '重新绑定凭据' };
  }
  if (credentialStatus === 'unbound') {
    return { mountId, kind: 'bind', label: '绑定凭据' };
  }
  return null;
}

/**
 * W5-C（微软）：从挂载详情的 `configJson` 取 `drive_id`。
 *
 * 后端权威口径（`mount_contract_e2e.rs:1317`）：微软挂载经
 * `config_json.drive_id` → `microsoft_graph_accounts.expires_at` 派生
 * expired/bound。因此 `drive_id` 是挂载与微软账号的关联键。
 *
 * ★不猜结构：`configJson` 是开放 JSON，只按后端明确写的 `drive_id` 键读取；
 *   取不到（非微软 / 未配置）→ null，由调用方决定是否给入口。
 */
export function readMountDriveId(configJson: Record<string, unknown> | null | undefined): string | null {
  if (!configJson) {
    return null;
  }
  const value = configJson.drive_id;
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * W5-C：判断该挂载是否适用**微软专用重绑流**。
 * 条件（全部来自后端既有事实，不前端自造）：
 * - providerType 为 microsoft 系
 * - 且能取到 drive_id（否则无法定位账号，只能回落通用表单）
 */
export function supportsMicrosoftRebind(input: {
  providerType?: string | null;
  configJson?: Record<string, unknown> | null;
}): boolean {
  const provider = (input.providerType ?? '').toLowerCase();
  const isMicrosoft = provider.includes('microsoft') || provider.includes('onedrive') || provider.includes('sharepoint');
  if (!isMicrosoft) {
    return false;
  }
  return readMountDriveId(input.configJson) !== null;
}
