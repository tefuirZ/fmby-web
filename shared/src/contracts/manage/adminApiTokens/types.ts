//! FE-ADMIN-SURFACE：管理面 API 令牌（`/api/admin/api-tokens`）。
//!
//! 后端权威（FMBY-V2 `origin/main`）：
//! - 路由 `router_manage.rs:625-629`：`POST` /`GET` `/admin/api-tokens`、
//!   `DELETE` `/admin/api-tokens/{id}`；
//!   handler `routes/admin.rs`：`admin_create_api_token` / `admin_list_api_tokens` /
//!   `admin_revoke_api_token`；
//! - 能力门 `MANAGE_ACCESS`；端口未装配 ⇒ `Validation("api token service unavailable")`；
//! - DTO `dto/api_token.rs:33` = `{ id, name, scopes, created_at_ms, expires_at_ms? }`
//!   （**snake_case wire**，`expires_at_ms` 可缺省）。

/// 前端域形态（camelCase）。
export interface AdminApiToken {
  id: number;
  name: string;
  scopes: string[];
  createdAtMs: number;
  expiresAtMs: number | null;
}

/// 创建入参（后端按 name/scopes/可选过期时间创建）。
export interface AdminApiTokenCreateInput {
  name: string;
  scopes: string[];
  expiresAtMs?: number | null;
}

/// wire 形态（后端逐字）。
export interface RawAdminApiToken {
  id: number;
  name: string;
  scopes: string[];
  created_at_ms: number;
  expires_at_ms?: number | null;
}
