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
//! ★`copy_state` 是**后端枚举的字符串投影**，不是布尔。
//!   后端权威 `fmby-v2-domain/src/cas.rs:64`
//!     `enum CopyState { Pending, Present, Failed, Tombstoned }`，
//!   wire 由 `fmby-v2-bridges/src/bridges/cas_admin.rs:95` `d.copy_state.as_str()` 产生，
//!   故取值集合**封闭**为 `pending` / `present` / `failed` / `tombstoned`。
//!   本层仍**原样透出**、不折叠成「是否已复制」—— 折叠会丢掉 `failed`（实体丢失）
//!   与 `tombstoned`（上游已删）这两个对账关键态的区分。

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
  /**
   * 后端 `CopyState` 枚举的字符串投影（**封闭**取值），原样透出。
   * 权威：`fmby-v2-domain/src/cas.rs:64` `enum CopyState { Pending, Present, Failed, Tombstoned }`，
   * wire 由 `fmby-v2-bridges/src/bridges/cas_admin.rs:95` `as_str()` 产生
   * ⇒ 取值为 `pending` / `present` / `failed` / `tombstoned`。
   * 不折叠成布尔：折叠会丢掉 `failed`（实体丢失）与 `tombstoned`（上游已删）
   * 这两个对账关键态的区分。
   */
  copyState: string;
  /** 未知大小为 `null`（**不是 0**）。 */
  sizeBytes: number | null;
  /** 从未核验为 `null`（**不是 0**，否则 UI 会显示 1970 年）。 */
  lastVerifiedAt: number | null;
  /**
   * 失败原因码（#671，wire `reason_code`）。
   *
   * ★「key 缺失」= **无原因**（后端 `Option::None` 时该 key **不出现在 JSON 里**），
   *   故此处为 `null`。**不得**用 `?? ''` 渲染空串 —— 那会把「健康」画成
   *   「有原因但空白」。
   * ★取值集合（`SCREAMING_SNAKE`，与全仓 `error_code` slug 命名族一致）目前封闭为：
   *   `CAS_COPY_FAILED`      —— 盘上实体丢失（`copy_state=failed`）
   *   `CAS_COPY_TOMBSTONED`  —— 上游文件已删/墓碑化（`copy_state=tombstoned`）
   *   未知新码按 fail-closed **显示原文码**（与 `copy_state` 未知码同纪律），
   *   绝不静默归入「无原因」。
   */
  reasonCode: string | null;
  /** 失败原因明细（#671，wire `reason_detail`）；同「key 缺失 = 无」。 */
  reasonDetail: string | null;
  /**
   * ★`reason_code` 这个 **key 是否存在于响应里**（#671 硬要求）。
   *
   * 必须区分两件事（rb01 特别提醒，混同即假态）：
   *   - key **不存在**（`Option::None` 不序列化，`pending`/`present` 的正常形态）
   *     ⇒ `reasonCodePresent = false`，`reasonCode = null`；
   *   - key **存在但为空/空白** ⇒ `reasonCodePresent = true`，`reasonCode = ''`。
   * 前端**不得**用 `?? ''` 把前者也变成空串 —— 那会把「健康（无原因）」
   *   与「后端给了 key 却是空值」混为一谈。
   */
  reasonCodePresent: boolean;
}

/// 前端域形态 · 一条内容的多盘扇出状态。
/** #862 · #658 ⑤：延迟删除三闸**逐闸明细**（backend `CasDeferredGateDto`；详版走 fanout 单查面）。 */
export interface CasDeferredGate {
  /** 当前**在挡**的闸：`none`/`session_open`/`lease_active`/`grace`/`reaped`。 */
  blockingGate: string;
  /** 闸①：播放会话是否已关闭。 */
  sessionClosed: boolean;
  /** 闸②：TTL 是否已到（`now >= expires_at`）。 */
  leaseExpired: boolean;
  /** 闸③：宽限期是否已满（`now >= expires_at + grace`）。 */
  graceElapsed: boolean;
  /** 宽限期剩余（ms，`>=0`）。 */
  graceRemainingMs: number;
}

export interface CasFanoutStatus {
  contentId: number;
  drives: CasDriveStatus[];
  /** 三闸明细；后端未给（老版本/未装配）⇒ `null`，UI 不编造。 */
  deferred: CasDeferredGate | null;
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
  /**
   * #671 新增：`Option<String>` + `skip_serializing_if = "Option::is_none"`
   * ⇒ 无原因时**该 key 不出现**（不是 `null` 字面量）。
   */
  reason_code?: string | null;
  reason_detail?: string | null;
}

/** wire 形态 · 扇出状态。 */
export interface RawCasDeferredGate {
  blocking_gate: string;
  session_closed: boolean;
  lease_expired: boolean;
  grace_elapsed: boolean;
  grace_remaining_ms: number;
}
export interface RawCasFanoutStatus {
  content_id: number;
  drives: RawCasDriveStatus[];
  deferred?: RawCasDeferredGate | null;
}

/** wire 形态 · 对账报告条目。 */
export interface RawCasReconcileReport {
  report_id: string;
  source: string;
  identified: boolean;
  reconciled: boolean;
  generated_at_ms: number;
}

/**
 * 域形态 · 对账报告条目。
 *
 * ★rv02 #25 Important-1 收口：`generatedAtMs` 改 `number | null` ——
 *   后端 u64 毫秒理论恒有值，但缺省面（key 缺失/部分响应）可能无值；
 *   契约层用 `null` 表达「没值」，**不用 0 伪装缺失**（M-2）。
 *   展示层 `formatGeneratedAt` 对 null/非有限/≤0 一律「未生成」，不伪造 1970。
 */
export interface CasReconcileReport {
  reportId: string;
  source: string;
  identified: boolean;
  reconciled: boolean;
  generatedAtMs: number | null;
}

// ===== #658-CONTENT-LIST：CAS 内容列表（第 1 页）=====
// 配对 w02 后端 `GET /admin/cas/contents`（CAS-CONTENT-LIST-API）。
// DTO 形状由主代理冻结（照后端 CAS 真值表 cas_content/cas_content_drive/cas_restore）。

/// 前端域形态 · 一条内容在某盘上的副本（列表页简化视图，无 size/reason 明细）。
export interface CasContentDriveCopy {
  driveRef: string;
  providerType: string;
  /**
   * 后端 `CopyState` 枚举的字符串投影（封闭取值 `pending`/`present`/`failed`/`tombstoned`），
   * 原样透出、不折叠成布尔（同 `CasDriveStatus.copyState` 纪律）。
   */
  copyState: string;
}

/// 前端域形态 · 内容指纹（sha256/md5 两族可空——至少其一才是入库级去重键；size 必填）。
export interface CasContentFingerprint {
  sha256: string | null;
  md5: string | null;
  sizeBytes: number;
}

/// 前端域形态 · 还原租约引用（holder=会话 id 或物化路径；expiresAt=TTL 到期 ms）。
export interface CasContentLeaseRef {
  holder: string;
  expiresAt: number;
}

/// 前端域形态 · CAS 内容列表一行（真值视图：内容 → 盘副本 / 本地实体 / lease 状态）。
export interface CasContentSummary {
  contentId: number;
  /** 内容指纹（sha256/md5 去重键两族 + 字节数；与后端 `CasContentFingerprintDto` 对齐）。 */
  fingerprint: CasContentFingerprint;
  /** 关联媒体项 id（无关联为 `null`，**不用 0 伪装**）。 */
  mediaItemId: number | null;
  /** 已落盘副本（每盘一条）。 */
  drives: CasContentDriveCopy[];
  /** 是否有本地实体。 */
  hasLocalEntity: boolean;
  /**
   * #658 ④「秒传来源」：`cas_content.source_kind`（domain 单一真源 `SourceKind::as_str`；
   * 后端 `CasContentListItemDto.source_kind` 明写供本徽章消费，`rapid_upload` = 秒传命中）。
   * 数据缺失 ⇒ `null` ⇒ UI 显 `—`，**不编造**。
   */
  sourceKind: string | null;
  /**
   * #862 · #658 ⑤「删除安全可见」：延迟删除三闸中**当前在挡的那一闸**（稳定码
   * `none`/`session_open`/`lease_active`/`grace`/`reaped`，后端 `CasContentListItemDto.deferred_gate`）。
   * 让用户看懂「删了但没真删」是被哪一闸挡着。数据缺失 ⇒ `null` ⇒ UI 显 `—`。
   */
  deferredGate: string | null;
  /** #862：宽限期剩余（ms，`>=0`；无关/已过/已回收为 0）。缺失 ⇒ `null`。 */
  graceRemainingMs: number | null;
  /**
   * 还原租约引用（后端最新一条非 Reaped；无 lease/全已回收为 `null`）。
   * ★结构化二字段（holder/expiresAt），不是状态串——与后端 `CasContentLeaseRefDto` 对齐；
   *   过期与否按此刻判断，不折叠成「无 lease」（防伪造对账关键态）。
   */
  lease: CasContentLeaseRef | null;
  /** 最近更新时间（ms；无值为 `null`，**不用 0 伪装**，否则 UI 显示 1970 年）。 */
  updatedAt: number | null;
}

/// wire 形态 · 内容在某盘上的副本。
export interface RawCasContentDriveCopy {
  drive_ref: string;
  provider_type: string;
  copy_state: string;
}

/// wire 形态 · 内容指纹（与后端 DTO 逐字段对齐）。
export interface RawCasContentFingerprint {
  sha256?: string | null;
  md5?: string | null;
  size_bytes: number;
}

/// wire 形态 · 还原租约引用。
export interface RawCasContentLeaseRef {
  holder: string;
  expires_at: number;
}

/// wire 形态 · CAS 内容列表一行。
export interface RawCasContentSummary {
  content_id: number;
  fingerprint: RawCasContentFingerprint;
  media_item_id?: number | null;
  drives?: RawCasContentDriveCopy[];
  has_local_entity?: boolean;
  source_kind?: string;
  deferred_gate?: string;
  grace_remaining_ms?: number;
  lease?: RawCasContentLeaseRef | null;
  updated_at?: number | null;
}