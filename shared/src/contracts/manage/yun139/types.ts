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

// ---------------------------------------------------------------------------
// 账号池「段 B 调度运维」（FE-YUN139-ACCOUNT-POOLS，挑内聚 2 端点）
//
// 端点真源（origin/main）：`crates/fmby-v2-http/src/routes/yun139_accounts.rs`
//   POST /api/manage/yun139/account-pools/{poolId}/lease
//   POST /api/manage/yun139/account-pools/{poolId}/report
// DTO：`crates/fmby-v2-http/src/state/yun139_accounts.rs`
// 能力门：`MANAGE_MOUNT`。
//
// ★`expiresAt` 是 **epoch 毫秒**（租借 TTL，过期视为自动归还）⇒ 原样透传，不转字符串。
// ★可选字段省略时**不发送**，不在前端臆造缺省（冷却秒数缺省由池配置决定）。
// ---------------------------------------------------------------------------

/** 租借试运行入参：`sticky_key` 可省（粘性策略下同键恒选同一账号）。 */
export interface Yun139LeaseInput {
  stickyKey?: string;
}

/** 租借试运行结果。 */
export interface Yun139LeaseResult {
  poolId: string | null;
  leaseId: string;
  profileId: string;
  displayName: string;
  /** epoch 毫秒；过期自动归还。 */
  expiresAt: number;
}

/** 租借结果回写入参。 */
export interface Yun139ReportLeaseInput {
  profileId: string;
  leaseId?: string;
  success: boolean;
  /** 失败冷却秒数；省略 ⇒ 由池配置决定。 */
  cooldownSeconds?: number;
}

// 账号池「段 A」：池 CRUD + 成员管理（FE-YUN139-POOLS-SEG-A）
//
// 端点真源（origin/main）：`crates/fmby-v2-http/src/routes/yun139_accounts.rs`
//   GET/POST /api/manage/yun139/account-pools
//   GET/PUT/DELETE /api/manage/yun139/account-pools/{id}
//   GET/POST /api/manage/yun139/account-pools/{id}/members
//   DELETE /api/manage/yun139/account-pools/{id}/members/{profileId}
// DTO：`crates/fmby-v2-http/src/state/yun139_accounts.rs`
//   Pool 10 字段 / Member 11 字段；能力门 MANAGE_MOUNT。
//
// ★时间字段均为 **epoch 毫秒**（created_at/updated_at/last_used_at/cooldown_until）
//   ⇒ 原样透传，不转字符串。wire 一律 snake_case。
// ★可选字段省略 ⇒ **不发送**，交由后端缺省/校验，前端不臆造。
// ---------------------------------------------------------------------------

/** 账号池（10 字段）。 */
export interface Yun139AccountPool {
  id: string;
  name: string;
  description: string | null;
  /** 调度策略（后端枚举透传）。 */
  strategy: string;
  cooldownSeconds: number;
  maxConcurrent: number;
  isEnabled: boolean;
  memberCount: number;
  createdAt: number;
  updatedAt: number;
}

/** 建池入参（后端 5 字段；除 name 外均可省）。 */
export interface Yun139CreateAccountPoolInput {
  name: string;
  description?: string;
  strategy?: string;
  cooldownSeconds?: number;
  maxConcurrent?: number;
}

/** 改池入参（PATCH 语义：只发要改的字段）。 */
export interface Yun139UpdateAccountPoolInput {
  name?: string;
  description?: string;
  strategy?: string;
  cooldownSeconds?: number;
  maxConcurrent?: number;
  isEnabled?: boolean;
}

/** 池成员（11 字段）。 */
export interface Yun139AccountPoolMember {
  poolId: string;
  profileId: string;
  profileLabel: string | null;
  profileStatus: string | null;
  weight: number;
  isEnabled: boolean;
  lastUsedAt: number | null;
  failCount: number;
  cooldownUntil: number | null;
  createdAt: number;
  updatedAt: number;
}

/** 加成员入参（`weight` 可省）。 */
export interface Yun139AddAccountPoolMemberInput {
  profileId: string;
  weight?: number;
}
