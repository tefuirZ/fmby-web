//! FE-MIGRATION-WIZARD：迁移 ledger 检视/导出（`/api/manage/migration/*`）。
//!
//! 后端权威（FMBY-V2 `origin/main`）：
//! - 路由 `router_manage.rs:373-378`：`GET /manage/migration/inspect`、`GET /manage/migration/export`；
//!   handler `routes/manage_migration.rs`：`migration_inspect` / `migration_export`（**真实实现**）；
//! - 能力门 `VIEW_AUDIT`；端口未装配 ⇒ fail-closed（不返空壳假数据）；
//! - ★ `POST /manage/migration/import` 为 `ErrorCode::NotImplemented` 占位
//!   （“本卡未实现；已拆独立卡单独设计鉴权/幂等/干跑校验”）⇒ **本契约不包含 import**。
//!
//! wire 说明：后端 DTO 已用 `serde(rename = ...)` 输出 **camelCase**（`appliedAtMs` /
//! `currentVersion`），故前端**无需**再做 snake→camel 转换，字段名直接对拍。

/// 单条已应用迁移（wire 逐字）。
export interface MigrationEntry {
  version: number;
  name: string;
  checksum: string;
  appliedAtMs: number;
}

/// `GET /api/manage/migration/inspect` 响应。
export interface MigrationInspectResponse {
  count: number;
  currentVersion: number;
  entries: MigrationEntry[];
}

/// `GET /api/manage/migration/export` 响应（可导入集合 = 当前已应用条目）。
export interface MigrationExportResponse {
  entries: MigrationEntry[];
}
