//! fmby-web#8：CAS 编排面管理契约（`/api/admin/cas/*`）。
//!
//! 后端权威（FMBY-V2 `origin/main`，#42-N5 = PR #378 / `c0ef6a381`）：
//! - 路由 `routes/admin_cas.rs`：
//!   `GET`/`PUT` `/admin/cas/drives`、`GET` `/admin/cas/fanout/{content_id}`、
//!   `GET` `/admin/cas/reconcile`；
//! - DTO `state/cas_admin.rs`（**snake_case wire**）：
//!   `CasDriveConfigDto` = `{ provider_type, drive_ref, enabled, priority }`
//!   `CasFanoutStatusDto` = `{ content_id, drives: CasDriveStatusDto[] }`
//!   `CasDriveStatusDto` = `{ drive_id, provider_type, drive_ref, copy_state,
//!                          size_bytes?, last_verified_at? }`
//!   `CasReconcileReportDto` = `{ report_id, source, identified, reconciled,
//!                               generated_at_ms }`
//!   PUT 入参 `UpsertCasDriveConfigRequest` 与 `CasDriveConfigDto` 同形。
//! - 能力门 `MANAGE_LIBRARY`；端口未装配 ⇒ **fail-closed 500**（不回落空值/假状态）。
//!
//! ★`copy_state` 是**后端定义的开放字符串**（后端注释示例 `present`），不是布尔。
//!   本层**原样透出**，不折叠成「是否已复制」—— 后端新增第三态（如 `copying`/`missing`）时，
//!   折叠会静默丢信息。是否「已完成」由 UI 层按后端契约解释，不在映射层猜。

/// 前端域形态 · 盘配置（CAS 矩阵的一行：开关 + 优先级）。
export interface CasDriveConfig {
  providerType: string;
  driveRef: string;
  enabled: boolean;
  priority: number;
}

/// 前端域形态 · 单盘副本状态。
export interface CasDriveStatus {
  driveId: number;
  providerType: string;
  driveRef: string;
  /** 后端开放字符串，原样透出（不折叠成布尔）。 */
  copyState: string;
  /** 未知大小为 `null`（**不是 0**）。 */
  sizeBytes: number | null;
  /** 从未核验为 `null`（**不是 0**，否则 UI 会显示 1970 年）。 */
  lastVerifiedAt: number | null;
}

/// 前端域形态 · 一条内容的多盘扇出状态。
export interface CasFanoutStatus {
  contentId: number;
  drives: CasDriveStatus[];
}

/// 前端域形态 · `.cas` 对账报告条目。
export interface CasReconcileReport {
  reportId: string;
  source: string;
  identified: boolean;
  reconciled: boolean;
  generatedAtMs: number;
}

/// wire 形态 · 盘配置（后端逐字）。
export interface RawCasDriveConfig {
  provider_type: string;
  drive_ref: string;
  enabled: boolean;
  priority: number;
}

/** wire 形态 · 单盘副本状态（`size_bytes` / `last_verified_at` 可缺省）。 */
export interface RawCasDriveStatus {
  drive_id: number;
  provider_type: string;
  drive_ref: string;
  copy_state: string;
  size_bytes?: number | null;
  last_verified_at?: number | null;
}

/** wire 形态 · 扇出状态。 */
export interface RawCasFanoutStatus {
  content_id: number;
  drives: RawCasDriveStatus[];
}

/** wire 形态 · 对账报告条目。 */
export interface RawCasReconcileReport {
  report_id: string;
  source: string;
  identified: boolean;
  reconciled: boolean;
  generated_at_ms: number;
}