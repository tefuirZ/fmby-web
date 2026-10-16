import { httpClient } from "@fmby/v2-shared/api/client";
import { isApiError, getErrorMessage } from "@fmby/v2-shared/errors";
import type {
  CasContentDriveCopy,
  CasContentFingerprint,
  CasContentLeaseRef,
  CasContentSummary,
  CasDriveConfig,
  CasDriveStatus,
  CasFanoutStatus,
  CasReconcileReport,
  RawCasContentDriveCopy,
  RawCasContentFingerprint,
  RawCasContentLeaseRef,
  RawCasContentSummary,
  RawCasDriveConfig,
  RawCasDriveStatus,
  RawCasFanoutStatus,
  RawCasReconcileReport,
  RawCasReconcileTrigger,
  RawCasRetryCopy,
  CasReconcileTrigger,
  CasRetryCopy,
} from "./types";

// 与 `routes/admin_cas.rs` 逐字一致（单一事实源，不另起常量）。
// 注意：**无 manage 段**（router_core nest `/api` + `add_admin_routes` 直挂 `/admin/*`）。
const DRIVES_PATH = "/api/admin/cas/drives";
const FANOUT_PATH = "/api/admin/cas/fanout";
const RECONCILE_PATH = "/api/admin/cas/reconcile";
// #658-CONTENT-LIST：CAS 内容列表（w02 后端 CAS-CONTENT-LIST-API 补）。
const CONTENTS_PATH = "/api/admin/cas/contents";

/**
 * 首屏条数 —— 与后端默认值同数（`admin_cas.rs` 的 `page_size.unwrap_or(20)`，
 * 钳位 `1..=200`），**显式发出**只为了一个目的：让前端**知道自己被截断在多少条**，
 * 从而能诚实告诉用户「这是首屏上限、不是全量」。
 * ★不发 `page`：后端 `page≠1` 直接 400（键集仓储禁 OFFSET 假分页，docs/15）
 *   ⇒ 任何「下一页」尝试都是制造假象；深分页的诚实路径是键集游标 wire（属后端升级）。
 */
export const CAS_CONTENTS_LIMIT = 20;

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
    // #862：三闸明细（后端未给 ⇒ null，UI 不编造）。
    deferred: raw?.deferred
      ? {
          blockingGate: raw.deferred.blocking_gate ?? '',
          sessionClosed: raw.deferred.session_closed ?? false,
          leaseExpired: raw.deferred.lease_expired ?? false,
          graceElapsed: raw.deferred.grace_elapsed ?? false,
          graceRemainingMs: raw.deferred.grace_remaining_ms ?? 0,
        }
      : null,
  };
}

/// 触发对账回执 → 域形态。`created` 缺失按 `false`（**不假定新建**）。
export function mapCasReconcileTrigger(
  raw: Partial<RawCasReconcileTrigger> | null | undefined,
): CasReconcileTrigger {
  return { taskId: raw?.task_id ?? 0, created: raw?.created ?? false };
}

/// 重试复制回执 → 域形态。
/// ★`copyState` 原样透出（后端是开放字符串）：折叠成「成功/失败」两态会把后端新增态
///   静默判成失败；`reason_*` 沿用「key 缺失 ≠ 空串」纪律（见 `mapCasDriveStatus`）。
export function mapCasRetryCopy(
  raw: Partial<RawCasRetryCopy> | null | undefined,
): CasRetryCopy {
  return {
    driveId: raw?.drive_id ?? 0,
    copyState: raw?.copy_state ?? '',
    reasonCode: raw?.reason_code ?? null,
    reasonDetail: raw?.reason_detail ?? null,
    reasonCodePresent: raw != null && "reason_code" in raw,
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
    // ★rv02 #25 M-2 收口：缺失 ⇒ `null`（「没值」），**不用 0 伪装缺失**；
    //   展示层 formatGeneratedAt 对 null/≤0 一律「未生成」，不伪造 1970。
    generatedAtMs: raw?.generated_at_ms ?? null,
  };
}

/// 内容在某盘上的副本（列表页简化）→ 域形态。`copyState` 原样透出不折叠。
export function mapCasContentDriveCopy(
  raw: Partial<RawCasContentDriveCopy> | null | undefined,
): CasContentDriveCopy {
  return {
    driveRef: raw?.drive_ref ?? "",
    providerType: raw?.provider_type ?? "",
    copyState: raw?.copy_state ?? "",
  };
}

/// CAS 内容列表一行 → 域形态。
///
/// ★不伪造事实（照 `mapCasDriveStatus` 纪律）：`mediaItemId`/`lease`/`updatedAt`
///   缺省 ⇒ `null`（不用 0/空串伪装）；`drives` 缺省 ⇒ 空数组（「无盘副本」是真实态）。
export function mapCasContentFingerprint(
  raw: RawCasContentFingerprint | undefined | null,
): CasContentFingerprint {
  return {
    sha256: raw?.sha256 ?? null,
    md5: raw?.md5 ?? null,
    sizeBytes: raw?.size_bytes ?? 0,
  };
}

function mapCasContentLeaseRef(
  raw: RawCasContentLeaseRef | undefined | null,
): CasContentLeaseRef | null {
  if (!raw) return null;
  return { holder: raw.holder, expiresAt: raw.expires_at };
}

export function mapCasContentSummary(
  raw: Partial<RawCasContentSummary> | null | undefined,
): CasContentSummary {
  return {
    contentId: raw?.content_id ?? 0,
    fingerprint: mapCasContentFingerprint(raw?.fingerprint),
    mediaItemId: raw?.media_item_id ?? null,
    drives: (raw?.drives ?? []).map(mapCasContentDriveCopy),
    hasLocalEntity: raw?.has_local_entity ?? false,
    // #658 ④：缺失即 null ⇒ UI 显 —（不编造来源）。
    sourceKind: raw?.source_kind ?? null,
    // #862 · #658 ⑤：三闸「当前在挡那一闸」+ 宽限期剩余；缺失即 null ⇒ UI 显 —。
    deferredGate: raw?.deferred_gate ?? null,
    graceRemainingMs: raw?.grace_remaining_ms ?? null,
    lease: mapCasContentLeaseRef(raw?.lease),
    updatedAt: raw?.updated_at ?? null,
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
  /// `GET` —— CAS 内容列表（#658-CONTENT-LIST）。
  ///
  /// ★后端读面**已实现**并挂进生产 router（fmby-v2
  ///   `crates/fmby-v2-http/src/routes/admin_cas.rs` 的 `cas_list_contents`）
  ///   ⇒ `unwired` 的含义是**本实例**没给出数据，不是「端点没做」。
  /// ★CAS 端口未装配 ⇒ 503/501（`isCasAdminUnwired`）；后端版本过旧、路由不存在 ⇒ 404
  ///   （列表端点 404 = 该路由不存在，不是业务资源 404）——两者都归 `unwired:true`，
  ///   返回 `{ items: [], unwired: true }`，**不造假数据**；页面据此显式提示。
  /// ★其余错误（403 能力不足等）⇒ 抛错，交页面 error 态透传后端原文。
  async listCasContents(): Promise<{
    items: CasContentSummary[];
    unwired: boolean;
    limit: number;
  }> {
    try {
      const raw = await httpClient.get<RawCasContentSummary[]>(CONTENTS_PATH, {
        params: { page_size: CAS_CONTENTS_LIMIT },
      });
      const items = (raw ?? []).map(mapCasContentSummary);
      return { items, unwired: false, limit: CAS_CONTENTS_LIMIT };
    } catch (err) {
      if (isCasAdminUnwired(err) || isNotFound(err)) {
        // 未装配/端点不存在 ⇒ 假空态，`limit` 无意义（给 0，防 UI 把 0 当「上限 0 条」）。
        return { items: [], unwired: true, limit: 0 };
      }
      throw err;
    }
  },

  ///
  /// `POST` —— 触发一次 `.cas` 对账（#671 写面，rb01 PR #678）。
  ///
  /// 端点：`POST /api/admin/cas/reconcile/trigger?confirmed=true`
  /// 失败语义（**照后端，不猜**）：未装配/不可用 ⇒ **503**；能力不足 ⇒ 403；
  /// 缺 `confirmed` ⇒ 400。一律由 `httpClient` 抛错，前端用 `getErrorMessage`
  /// **透传后端原文**（不另造文案）。
  /// 当前端调用前无需判断能力：403 即能力不足，交给错误文案呈现。
  async triggerReconcile(): Promise<CasReconcileTrigger> {
    const raw = await httpClient.post<RawCasReconcileTrigger>(
      `${RECONCILE_PATH}/trigger`,
      { params: { confirmed: true } },
    );
    return mapCasReconcileTrigger(raw);
  },

  ///
  /// `POST` —— 重试某内容在某盘上的复制（#671 写面，rb01 同 PR）。
  ///
  /// 端点：`POST /api/admin/cas/fanout/{contentId}/drives/{driveId}/retry?confirmed=true`
  /// 失败语义同上（503 未装配 / 403 能力不足 / 400 缺 confirmed）。
  ///
  /// ★rb01 本端点**尚未合入** ⇒ 前端接线但不伪装可用：未装配时按 503 显式报
  ///   「端点未装配」（沿用既有 fail-closed 纪律）。
  async retryFanoutCopy(
    contentId: number,
    driveId: number,
  ): Promise<CasRetryCopy> {
    const raw = await httpClient.post<RawCasRetryCopy>(
      `${FANOUT_PATH}/${contentId}/drives/${driveId}/retry`,
      { params: { confirmed: true } },
    );
    return mapCasRetryCopy(raw);
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

/**
 * CAS 内容列表端点「未就绪」判定（#658-CONTENT-LIST）。
 *
 * w02 后端 `GET /admin/cas/contents` 未合时该路由**不存在** ⇒ httpClient 抛 404
 * `not_found`。列表端点 404 = 端点不存在（w02 未合），**不是**业务资源 404
 * （列表端点不返回业务 404，成功即返回数组）⇒ 归为「数据面未就绪」，页面据
 * 此显式提示，**不**当接线错误、**不**造假数据。
 */
export function isNotFound(error: unknown): boolean {
  if (!isApiError(error)) return false;
  const code = error.code;
  if (code === "not_found" || code === "NOT_FOUND" || code === "HTTP_404") {
    return true;
  }
  return (error as { status?: unknown }).status === 404;
}