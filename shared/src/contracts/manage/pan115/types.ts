// Pan115 凭据 / 扫码登录 / 账号管理 API 类型
export type Pan115QrcodeStatus =
  | "waiting"
  | "scanned"
  | "signed"
  | "expired"
  | "canceled"
  | "aborted"
  | "unknown";

export interface Pan115QrLoginRequest {
  appId?: string;
}

export interface Pan115QrLoginResponse {
  sessionId: string;
  uid: string;
  qrUrl: string;
  qrImage?: string;
}

export interface Pan115QrStatusResponse {
  status: Pan115QrcodeStatus;
}

export interface Pan115ActivateRequest {
  /** 扫码模式必填；手填 cookie 模式留空 */
  sessionId?: string;
  mountId: string;
  cookieApp?: string;
  /** 手填 cookie 模式必填：完整 cookie header 字符串 */
  cookieHeader?: string;
}

export interface Pan115ActivateResponse {
  ok: boolean;
  mountId: string;
}

export interface Pan115AccountInfo {
  mountId: string;
  /**
   * 绑定账号 UID（P2-07-D）。可空：后端由 SecretBox cookie 行解析，
   * 无 cookie 行或解析不到时为 null —— 表示「已绑定但 uid 不可得」，**非错误态**。
   */
  uid?: string;
  status: string;
  hasCookie: boolean;
  hasOpenToken: boolean;
  lastActiveAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Pan115HealthReport {
  ok: boolean;
  reason: string | null;
}

export interface Pan115BrowseEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number | null;
  modifiedAt: string | null;
}

export interface Pan115BrowseResponse {
  mountId: string;
  currentPath: string;
  entries: Pan115BrowseEntry[];
  /** P2-07-E：全量条目数（服务端分页窗口的 total）。 */
  totalCount: number;
  /** P2-07-E：下一页起点；末页 null（nextOffset <= offset 视为不可推进）。 */
  nextOffset: number | null;
}

// ─── 分享下载预览 / 分享项浏览（FE-PARITY-PAN115-SHARE）────────────────────

/** 分享下载面浏览条目（preview browse / share-items browse 共用，V1 wire 对齐）。 */
export interface Pan115ShareBrowseEntry {
  name: string;
  path: string;
  /** 115 网盘目录 id（`cid`）；下钻须传此值。 */
  cid: string;
  isDir: boolean;
  /** 字节数；目录为 null。 */
  size: number | null;
}

/** POST /api/manage/pan115/previews/{preview_id}/browse —— 用预览凭据浏览该账号自己的网盘目录。 */
export interface Pan115PreviewBrowseRequest {
  path?: string;
  offset?: number;
  limit?: number;
}

/** POST /api/manage/pan115/share-items/browse —— 匿名浏览 115 分享目录。 */
export interface Pan115ShareBrowseRequest {
  /** 分享码（必填，V1 同口径）。 */
  shareCode: string;
  /** 提取码；空白则交由端口侧反查。 */
  receiveCode?: string;
  /** 可选挂载 id（V1 `_mount_id` 收下未用，VOY wire 兼容）。 */
  mountId?: string;
  /** 目录路径或根 "0"；下钻须传子目录 id（cid）。 */
  path?: string;
  cid?: string;
  offset?: number;
  limit?: number;
}

/** preview / share-items 浏览响应（两套 key 集合不同，统一归一成一致字段）。 */
export interface Pan115ShareBrowseResponse {
  currentPath: string;
  parentPath: string | null;
  currentCid: string;
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  nextOffset: number | null;
  entries: Pan115ShareBrowseEntry[];
}

// ─── 同步管理面（FE-PARITY-PAN115-SHARE）────────────────────────────────────

/** GET /api/manage/pan115/sync/mounts/{mount_id} 概览中的单条来源。 */
export interface Pan115SyncSource {
  sourceId: string;
  shareItemId: string | null;
  displayName: string | null;
  sourceKind: string;
  status: string;
  rootNodeId: string | null;
  lastFullSyncAt: string | null;
  lastIncrementalSyncAt: string | null;
  lastShareDiffAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  updatedAt: string;
}

/** 同步检查点（断点续传 / 位点）。 */
export interface Pan115SyncCheckpoint {
  sourceId: string;
  shareItemId: string | null;
  displayName: string | null;
  checkpointKind: string;
  checkpointValue: string | null;
  payloadJson: string;
  updatedAt: string;
}

/** 最近同步任务。 */
export interface Pan115SyncTask {
  id: string;
  sourceId: string;
  shareItemId: string | null;
  displayName: string | null;
  taskKind: string;
  scopeNodeId: string | null;
  scopePathHint: string | null;
  requestReason: string;
  status: string;
  attemptCount: number;
  maxAttempts: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

/** GET /api/manage/pan115/sync/mounts/{mount_id} 概览。 */
export interface Pan115SyncOverview {
  mountId: string;
  providerType: string;
  sources: Pan115SyncSource[];
  checkpoints: Pan115SyncCheckpoint[];
  recentTasks: Pan115SyncTask[];
  /** 支持的手动入队动作（full-index / life-poll / diff-refresh 等）。 */
  supportedActions: string[];
}

/** POST /api/manage/pan115/sync/mounts/{mount_id}/enqueue body。 */
export interface Pan115SyncEnqueueRequest {
  action: string;
}

/** POST /api/manage/pan115/sync/mounts/{mount_id}/enqueue 响应。 */
export interface Pan115SyncEnqueueResponse {
  mountId: string;
  action: string;
  accepted: boolean;
  message: string;
}

// ─── 分享下载预览（FE-PARITY-PAN115-SHARE-DL）─────────────────────────────────
// 真源：crates/fmby-v2-http/src/routes/pan115_share_download.rs:224/228/232
//       crates/fmby-v2-http/src/state/pan115_share_download.rs
// wire：请求与响应**均 snake_case**（与该模块其它端点一致）。

/** POST /api/manage/pan115/share-download-preview/qr-login body。 */
export interface Pan115PreviewQrLoginRequest {
  /** 客户端 app_id（可选；不传走默认）。 */
  appId?: string;
}

/** 扫码登录发起响应。 */
export interface Pan115PreviewQrLoginResponse {
  sessionId: string;
  uid: string;
  /** 二维码内容（扫码用）。 */
  qrUrl: string;
  /** data-uri 二维码图；取图失败 → null（不阻断登录流程）。 */
  qrImage: string | null;
}

/** GET .../qr-status 响应。 */
export interface Pan115PreviewQrStatusResponse {
  /** 后端状态词（pending / scanned / confirmed / expired 等，原样透传）。 */
  status: string;
}

/** POST /api/manage/pan115/share-download-preview/create body。 */
export interface Pan115PreviewCreateRequest {
  /** 扫码登录拿到的会话（扫码模式）。 */
  sessionId?: string;
  cookieApp?: string;
  /** 手填 cookie 模式：完整 cookie header。 */
  cookieHeader?: string;
  /** 复用已绑定原生 115 挂载的 cookie。 */
  sourceMountId?: string;
}

/** create 响应。 */
export interface Pan115PreviewCreateResponse {
  previewId: string;
}
