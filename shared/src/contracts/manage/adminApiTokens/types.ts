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

/// wire 形态 · 签发响应（后端 `CreateApiTokenResponse`）。
///
/// ★与列表项**形状不同**：无 `created_at_ms`，有一次性明文 `token`
/// （`dto/api_token.rs`：明文 token 仅此路径下发一次）。
/// 曾因复用 `RawAdminApiToken` 接此响应 ⇒ token 被静默丢弃、createdAtMs 被伪造成 0。
export interface RawCreatedApiToken {
  id: number;
  name: string;
  token: string;
  scopes: string[];
}

/// 前端域形态 · 签发结果（含一次性明文 token，调用方须提示用户立即保存）。
export interface CreatedApiToken {
  id: number;
  name: string;
  token: string;
  scopes: string[];
}
