/**
 * 139 云盘凭据契约类型（FE-PARITY-YUN139）。
 *
 * 真源：`crates/fmby-v2-http/src/routes/yun139_accounts.rs`（19 端点，全 MANAGE_MOUNT）
 * DTO：`crates/fmby-v2-http/src/state/yun139_accounts.rs`
 *
 * wire：请求与响应**均 snake_case**。
 * ★注意与 pan115 的差异：139 的 qr-status query 用 **snake_case `session_id`**
 *   （后端只 `q.get("session_id")`），而 pan115 是 camelCase `sessionId`——两者不可混用。
 *
 * 本卡范围：扫码绑定 + 凭据档案（qr-login / qr-status / credential-profiles CRUD +
 * reauthorize）。account-pools（9 条）与 share-mounts（3 条）不在本卡，登记待办。
 */

/** POST /api/manage/yun139/qr-login 响应。 */
export interface Yun139QrLoginResult {
  sessionId: string;
  deviceId: string;
  /** 二维码内容。 */
  qrUrl: string;
  /** data:image/svg+xml;base64（可直接 <img>）；取图失败 → null，不伪造占位图。 */
  qrImage: string | null;
}

/** GET /api/manage/yun139/qr-status 响应。 */
export interface Yun139QrStatusResult {
  /** 后端状态词（pending / scanned / confirmed / expired 等，原样透传）。 */
  status: string;
}

/** 凭据档案。 */
export interface Yun139CredentialProfile {
  id: string;
  displayName: string;
  /** 账号标识掩码（不回显完整账号）。 */
  accountIdentityMask: string | null;
  status: string;
  canRefresh: boolean;
  authorizationExpiresAt: number | null;
  lastSuccessAt: number | null;
  lastErrorAt: number | null;
  /** ★最近错误类别：凭据过期的可辨信号来源（同挂载健康 last_fault_kind 口径）。 */
  lastErrorKind: string | null;
  lastErrorMessage: string | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * 创建/重新授权凭据档案入参（三种来源二选一：扫码会话 / authorization / cookie）。
 *
 * ★凭据安全：cookie/authorization 属敏感值，仅在请求体中出现，
 *   前端不得落 localStorage / URL / console（沿用 FE-CRUD-SECURITY-AUDIT 口径）。
 */
export interface Yun139CredentialProfileInput {
  displayName?: string;
  /** 扫码会话 id（与 authorization / cookie 二选一）。 */
  qrSessionId?: string;
  authorization?: string;
  cookie?: string;
}

/** 删除档案结果（OkResponse）。 */
export interface Yun139OkResult {
  ok: boolean;
}

// ---------------------------------------------------------------------------
// 139 自有挂载（owned mount）三端点类型 —— FE-YUN139-OWNED-BROWSE-UI
//
// 真源：
//   · `Yun139CredentialsInfo` @ crates/fmby-v2-bridges/src/bridges/yun139_owned_mount.rs
//   · `Yun139OwnedBrowseRequest` / `Yun139ActivateRequest` @
//     crates/fmby-v2-contracts/src/repository/yun139_accounts.rs
// 端点：`crates/fmby-v2-http/src/routes/yun139_accounts.rs`
//   GET  /manage/yun139/accounts/{mount_id}/credentials
//   POST /manage/yun139/accounts/{mount_id}/browse
//   POST /manage/yun139/activate
//
// ★安全红线：凭据面**只有 meta 五位**（有无/可刷新/过期时间/更新时间），
//   后端 `Yun139CredentialsInfo` 本身即零明文 ⇒ 前端不得新增任何明文字段。
// ---------------------------------------------------------------------------

/** `GET .../accounts/{mount_id}/credentials` 响应（后端 `Yun139CredentialsInfo`）。 */
export interface Yun139CredentialsInfo {
  mountId: string;
  /** 是否已有 authorization 段。 */
  hasAuthorization: boolean;
  /** 是否已有 cookie 段。 */
  hasCookie: boolean;
  /** 是否可刷新（二段齐全程度）。 */
  canRefresh: boolean;
  authorizationExpiresAt: string | null;
  updatedAt: string | null;
}

/** `POST .../accounts/{mount_id}/browse` 请求（后端 `Yun139OwnedBrowseRequest`）。 */
export interface Yun139OwnedBrowseRequest {
  path?: string;
  offset?: number;
  limit?: number;
  /** wire `spaceKind`（后端别名 space_kind）。 */
  spaceKind?: string;
  /** wire `cloudId`（后端别名 cloud_id/cloudID/family_id）。 */
  cloudId?: string;
  /** wire `fileId`（后端别名 file_id/root_file_id）。 */
  fileId?: string;
}

/**
 * `POST .../accounts/{mount_id}/browse` 响应。
 *
 * ★后端当前返回 `Json<serde_json::Value>`，**未定义结构化条目 DTO**
 *   （全仓无 `Yun139OwnedBrowseResponse`）。按「不自造字段」红线，前端
 *   只做不透明透传，由调用方在条目 DTO 落地后再细化；此处不臆造条文字段。
 */
export type Yun139OwnedBrowseResult = unknown;

/** `POST /manage/yun139/activate` 请求（后端 `Yun139ActivateRequest`）。 */
export interface Yun139ActivateRequest {
  /** wire `mountId`（后端别名 mount_id）；**必填**，后端空串 → Validation。 */
  mountId: string;
  authorization?: string;
  cookie?: string;
  spaceKind?: string;
  cloudId?: string;
}

/** `POST /manage/yun139/activate` 响应：成功只回 meta，绝不透 payload/明文。 */
export type Yun139ActivateResult = unknown;
