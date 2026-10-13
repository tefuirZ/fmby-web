import { httpClient } from "@fmby/v2-shared/api/client";
import { isApiError, getErrorMessage } from "@fmby/v2-shared/errors";
import type {
  CasDriveConfig,
  CasDriveStatus,
  CasFanoutStatus,
  CasReconcileReport,
  RawCasDriveConfig,
  RawCasDriveStatus,
  RawCasFanoutStatus,
  RawCasReconcileReport,
} from "./types";

// 与 `routes/admin_cas.rs` 逐字一致（单一事实源，不另起常量）。
// 注意：**无 manage 段**（router_core nest `/api` + `add_admin_routes` 直挂 `/admin/*`）。
const DRIVES_PATH = "/api/admin/cas/drives";
const FANOUT_PATH = "/api/admin/cas/fanout";
const RECONCILE_PATH = "/api/admin/cas/reconcile";

/// snake_case → camelCase。
export function mapCasDriveConfig(
  raw: Partial<RawCasDriveConfig> | null | undefined,
): CasDriveConfig {
  return {
    providerType: raw?.provider_type ?? "",
    driveRef: raw?.drive_ref ?? "",
    enabled: raw?.enabled ?? false,
    priority: raw?.priority ?? 0,
  };
}

/// 单盘副本状态 → 域形态。
///
/// ★`copyState` 原样透出（后端开放字符串），**不**折叠成「是否已复制」——
///   后端新增第三态时折叠会静默丢信息。
/// ★`sizeBytes` / `lastVerifiedAt` 保持 `null`：用 `?? 0` 会把「未知/未核验」
///   显示成「0 字节 / 1970 年已核验」，那是**伪造事实**。
export function mapCasDriveStatus(
  raw: Partial<RawCasDriveStatus> | null | undefined,
): CasDriveStatus {
  return {
    driveId: raw?.drive_id ?? 0,
    providerType: raw?.provider_type ?? "",
    driveRef: raw?.drive_ref ?? "",
    copyState: raw?.copy_state ?? "",
    sizeBytes: raw?.size_bytes ?? null,
    lastVerifiedAt: raw?.last_verified_at ?? null,
    // #671：key 缺失 ⇒ null（**不是空串**）；存在但为空 ⇒ 空串。
    // ★两者必须分开：用 `?? ''` 归一会把「健康（无原因）」与「给了 key 却是空值」
    //   混同（rb01 特别提醒）。存在性单独落在 `reasonCodePresent`。
    reasonCode: raw?.reason_code ?? null,
    reasonDetail: raw?.reason_detail ?? null,
    reasonCodePresent: raw != null && "reason_code" in raw,
  };
}

export function mapCasFanoutStatus(
  raw: Partial<RawCasFanoutStatus> | null | undefined,
): CasFanoutStatus {
  return {
    contentId: raw?.content_id ?? 0,
    drives: (raw?.drives ?? []).map(mapCasDriveStatus),
  };
}

export function mapCasReconcileReport(
  raw: Partial<RawCasReconcileReport> | null | undefined,
): CasReconcileReport {
  return {
    reportId: raw?.report_id ?? "",
    source: raw?.source ?? "",
    identified: raw?.identified ?? false,
    reconciled: raw?.reconciled ?? false,
    generatedAtMs: raw?.generated_at_ms ?? 0,
  };
}

/// camelCase → wire（★不得把域形态直接发给后端：后端是 snake_case 且不认多余字段）。
function toRaw(config: CasDriveConfig): RawCasDriveConfig {
  return {
    provider_type: config.providerType,
    drive_ref: config.driveRef,
    enabled: config.enabled,
    priority: config.priority,
  };
}

export const casAdminApi = {
  /// `GET` —— 列出 CAS 矩阵的盘配置。
  async listDriveConfigs(): Promise<CasDriveConfig[]> {
    const raw = await httpClient.get<RawCasDriveConfig[]>(DRIVES_PATH);
    return (raw ?? []).map(mapCasDriveConfig);
  },

  /// `PUT` —— 保存单个盘配置（后端是 PUT，非 POST）。
  async upsertDriveConfig(config: CasDriveConfig): Promise<void> {
    await httpClient.put<void>(DRIVES_PATH, { body: toRaw(config) });
  },

  /// `GET` —— 一条内容的多盘扇出状态。
  async fanoutStatus(contentId: number): Promise<CasFanoutStatus> {
    const raw = await httpClient.get<RawCasFanoutStatus>(
      `${FANOUT_PATH}/${contentId}`,
    );
    return mapCasFanoutStatus(raw);
  },

  /// `GET` —— `.cas` 对账报告。
  async reconcileReports(): Promise<CasReconcileReport[]> {
    const raw = await httpClient.get<RawCasReconcileReport[]>(RECONCILE_PATH);
    return (raw ?? []).map(mapCasReconcileReport);
  },

  ///
  /// `POST` —— 触发一次 `.cas` 对账（#671 写面，rb01 PR #678）。
  ///
  /// 端点：`POST /api/admin/cas/reconcile/trigger?confirmed=true`
  /// 失败语义（**照后端，不猜**）：未装配/不可用 ⇒ **503**；能力不足 ⇒ 403；
  /// 缺 `confirmed` ⇒ 400。一律由 `httpClient` 抛错，前端用 `getErrorMessage`
  /// **透传后端原文**（不另造文案）。
  /// 当前端调用前无需判断能力：403 即能力不足，交给错误文案呈现。
  async triggerReconcile(): Promise<void> {
    await httpClient.post<void>(`${RECONCILE_PATH}/trigger`, {
      params: { confirmed: true },
    });
  },

  ///
  /// `POST` —— 重试某内容在某盘上的复制（#671 写面，rb01 同 PR）。
  ///
  /// 端点：`POST /api/admin/cas/fanout/{contentId}/drives/{driveId}/retry?confirmed=true`
  /// 失败语义同上（503 未装配 / 403 能力不足 / 400 缺 confirmed）。
  ///
  /// ★rb01 本端点**尚未合入** ⇒ 前端接线但不伪装可用：未装配时按 503 显式报
  ///   「端点未装配」（沿用既有 fail-closed 纪律）。
  async retryFanoutCopy(contentId: number, driveId: number): Promise<void> {
    await httpClient.post<void>(
      `${FANOUT_PATH}/${contentId}/drives/${driveId}/retry`,
      { params: { confirmed: true } },
    );
  },
};

// 错误面复用 `shared/src/errors` 既有口径（端口未装配 ⇒ 后端 503，由调用方对拍，
// **不得**在映射层兜成空数组/假状态）。
export { isApiError, getErrorMessage };

/**
 * CAS 管理端口「未装配」判定。
 *
 * ★为何不能用通用的 `isServiceUnwiredError`：
 *   后端权威 `fmby-v2-http/src/routes/admin_cas.rs:4,29-32,285-288` 写明
 *     「端口未装配 ⇒ fail-closed **503**（DependencyUnavailable）」，
 *     并显式说明 `http_status` 对 `DependencyUnavailable` 返 **503（非 500）**。
 *   而 `isServiceUnwiredError`（`peripherals/api.ts:345-359`）**只认 500/501**，
 *   对 503 一律返 false ⇒ 页面会误走「载入失败」而非「服务未启用」，
 *   恰好把卡面最核心的 fail-closed 语义弄丢。故本函数按后端真实返回实现。
 *
 * 三个后端可能出现的未装配形态：
 *   · 503 `dependency_unavailable` —— handler 的 `service()` 端口未装配（**主路径**）
 *   · 500 `internal`                 —— 已装配但沿用 trait 默认体（fail-closed）
 *   · 501 `not_implemented`          —— 能力未实现
 *
 * ★绝不能把业务 **404** 算成未装配 —— 404 意味着路由没接对，
 *   把它伪装成「服务未启用」会让接线错误长期隐身。
 */
/**
 * CAS 写操作（触发对账 / 重试复制）的失败分类（纯函数，可被直接断言）。
 *
 * 后端语义（#671，照后端、**不猜**）：
 *   - 未装配 / 不可用 ⇒ **503**（不是 500）；
 *   - 能力不足 ⇒ 403；
 *   - 缺 `confirmed` ⇒ 400；
 *   - 其余（含未知错误码）⇒ `other`，**错误码与原文一律保留**，由 UI 透传。
 */
export type CasWriteErrorKind = 'unwired' | 'forbidden' | 'bad_request' | 'other';

export function classifyCasWriteError(error: unknown): CasWriteErrorKind {
  if (isCasAdminUnwired(error)) return 'unwired';
  if (!isApiError(error)) return 'other';
  const code = error.code;
  if (code === 'forbidden' || code === 'FORBIDDEN' || code === 'HTTP_403') return 'forbidden';
  if (
    code === 'validation' ||
    code === 'VALIDATION' ||
    code === 'bad_request' ||
    code === 'HTTP_400'
  ) {
    return 'bad_request';
  }
  return 'other';
}

export function isCasAdminUnwired(error: unknown): boolean {
  if (!isApiError(error)) return false;
  const code = error.code;
  if (
    code === "dependency_unavailable" ||
    code === "DEPENDENCY_UNAVAILABLE" ||
    code === "not_implemented" ||
    code === "NOT_IMPLEMENTED" ||
    code === "internal" ||
    code === "HTTP_500" ||
    code === "HTTP_501" ||
    code === "HTTP_503"
  ) {
    return true;
  }
  const status = (error as { status?: unknown }).status;
  return status === 500 || status === 501 || status === 503;
}