import { httpClient } from "@fmby/v2-shared/api/client";
import type {
  Pan115AccountInfo,
  Pan115BrowseResponse,
  Pan115ActivateRequest,
  Pan115ActivateResponse,
  Pan115HealthReport,
  Pan115QrLoginRequest,
  Pan115QrLoginResponse,
  Pan115QrStatusResponse,
  Pan115ShareBrowseEntry,
  Pan115ShareBrowseResponse,
  Pan115PreviewBrowseRequest,
  Pan115ShareBrowseRequest,
  Pan115SyncOverview,
  Pan115SyncEnqueueRequest,
  Pan115SyncEnqueueResponse,
  Pan115SyncSource,
  Pan115SyncCheckpoint,
  Pan115SyncTask,
  Pan115PreviewCreateRequest,
  Pan115PreviewCreateResponse,
  Pan115PreviewQrLoginRequest,
  Pan115PreviewQrLoginResponse,
  Pan115PreviewQrStatusResponse,
} from "./types";

interface RawAccountInfo {
  mount_id: string;
  /** P2-07-D：后端 `Option<String>`，缺失/解析不到时为 null。 */
  uid?: string | null;
  status: string;
  has_cookie: boolean;
  has_open_token: boolean;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
}

interface RawQrLogin {
  session_id: string;
  uid: string;
  qr_url: string;
  qr_image?: string | null;
}

interface RawQrStatus {
  status: unknown;
}

interface RawBrowseEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size?: number | null;
  modified_at?: string | null;
}

interface RawBrowseResponse {
  mount_id: string;
  current_path: string;
  entries: RawBrowseEntry[];
  /** P2-07-E：全量条目数（服务端分页窗口的 total）。 */
  total_count: number;
  /** P2-07-E：下一页起点；末页 null。 */
  next_offset: number | null;
}

interface RawActivate {
  ok: boolean;
  mount_id: string;
}

const QR_STATUSES = new Set([
  'waiting',
  'scanned',
  'signed',
  'expired',
  'canceled',
  'aborted',
  'unknown',
]);

function normalizeQrStatus(value: unknown): Pan115QrStatusResponse['status'] {
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (QR_STATUSES.has(normalized)) return normalized as Pan115QrStatusResponse['status'];
  }
  return 'unknown';
}

function fromAccount(r: RawAccountInfo): Pan115AccountInfo {
  return {
    mountId: r.mount_id,
    // 后端 null（uid 不可得）归一为 undefined，对齐 `uid?: string` 可选契约。
    uid: r.uid ?? undefined,
    status: r.status,
    hasCookie: r.has_cookie,
    hasOpenToken: r.has_open_token,
    lastActiveAt: r.last_active_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const basePan115Api = {
  async startQrLogin(req: Pan115QrLoginRequest = {}): Promise<Pan115QrLoginResponse> {
    const raw = await httpClient.post<RawQrLogin>("/api/manage/pan115/qr-login", {
      body: { app_id: req.appId },
    });
    return { sessionId: raw.session_id, uid: raw.uid, qrUrl: raw.qr_url, qrImage: raw.qr_image ?? undefined };
  },

  async pollQrStatus(sessionId: string): Promise<Pan115QrStatusResponse> {
    const raw = await httpClient.get<RawQrStatus>("/api/manage/pan115/qr-status", {
      params: { session_id: sessionId },
      timeout: 35_000,
    });
    return { status: normalizeQrStatus(raw.status) };
  },

  async activate(req: Pan115ActivateRequest): Promise<Pan115ActivateResponse> {
    const raw = await httpClient.post<RawActivate>("/api/manage/pan115/activate", {
      body: {
        session_id: req.sessionId,
        mount_id: req.mountId,
        cookie_app: req.cookieApp,
        cookie_header: req.cookieHeader,
      },
    });
    return { ok: raw.ok, mountId: raw.mount_id };
  },

  async getAccount(mountId: string): Promise<Pan115AccountInfo> {
    const raw = await httpClient.get<RawAccountInfo>(
      `/api/manage/pan115/accounts/${encodeURIComponent(mountId)}`,
    );
    return fromAccount(raw);
  },

  async refreshOpenToken(mountId: string): Promise<void> {
    await httpClient.post<{ ok: boolean }>(
      `/api/manage/pan115/accounts/${encodeURIComponent(mountId)}/refresh`,
    );
  },

  async healthCheck(mountId: string): Promise<Pan115HealthReport> {
    return httpClient.post<Pan115HealthReport>(
      `/api/manage/pan115/accounts/${encodeURIComponent(mountId)}/health`,
    );
  },

  async browseDirectory(
    mountId: string,
    path?: string,
    offset?: number,
    limit?: number,
  ): Promise<Pan115BrowseResponse> {
    const raw = await httpClient.post<RawBrowseResponse>(
      `/api/manage/pan115/accounts/${encodeURIComponent(mountId)}/browse`,
      { body: { path, offset, limit } },
    );
    return {
      mountId: raw.mount_id,
      currentPath: raw.current_path,
      entries: raw.entries.map((e) => ({
        name: e.name,
        path: e.path,
        isDir: e.is_dir,
        size: e.size ?? null,
        modifiedAt: e.modified_at ?? null,
      })),
      totalCount: raw.total_count,
      nextOffset: raw.next_offset ?? null,
    };
  },

  async unbind(mountId: string): Promise<void> {
    await httpClient.delete<{ ok: boolean }>(
      `/api/manage/pan115/accounts/${encodeURIComponent(mountId)}`,
    );
  },
};

// ─── FE-PARITY-PAN115-SHARE：分享下载预览 / 分享项浏览 / 同步 ───────────────────
// 契约层扩展（前端此前零消费这 4 个端点）。端点后端均经 `MANAGE_MOUNT` 能力门 +
// license 端口收口；未装配端口时 fail-closed（503 / 500），前端必须透传错误码，
// 不得吞成空成功（与 EMAIL-WEB-UI 同纪律）。

interface RawShareBrowseEntry {
  name: string;
  path: string;
  cid: string;
  is_dir: boolean;
  size?: number | null;
}

interface RawShareBrowseCommonResponse {
  current_path: string;
  parent_path?: string | null;
  current_cid: string;
  total: number;
  offset: number;
  limit: number;
  has_more: boolean;
  next_offset?: number | null;
  entries: RawShareBrowseEntry[];
}

function fromShareBrowseEntry(e: RawShareBrowseEntry): Pan115ShareBrowseEntry {
  return {
    name: e.name,
    path: e.path,
    cid: e.cid,
    isDir: e.is_dir,
    size: e.size ?? null,
  };
}

function fromShareBrowseResponse(
  r: RawShareBrowseCommonResponse,
): Pan115ShareBrowseResponse {
  return {
    currentPath: r.current_path,
    parentPath: r.parent_path ?? null,
    currentCid: r.current_cid,
    total: r.total,
    offset: r.offset,
    limit: r.limit,
    hasMore: r.has_more,
    nextOffset: r.next_offset ?? null,
    entries: (r.entries ?? []).map(fromShareBrowseEntry),
  };
}

// preview 段响应额外带 `preview_id`/`mount_id` Optional 字段，统一按通用响应归一。

interface RawSyncSource {
  source_id: string;
  share_item_id?: string | null;
  display_name?: string | null;
  source_kind: string;
  status: string;
  root_node_id?: string | null;
  last_full_sync_at?: string | null;
  last_incremental_sync_at?: string | null;
  last_share_diff_at?: string | null;
  last_error_code?: string | null;
  last_error_message?: string | null;
  updated_at: string;
}

interface RawSyncCheckpoint {
  source_id: string;
  share_item_id?: string | null;
  display_name?: string | null;
  checkpoint_kind: string;
  checkpoint_value?: string | null;
  payload_json: string;
  updated_at: string;
}

interface RawSyncTask {
  id: string;
  source_id: string;
  share_item_id?: string | null;
  display_name?: string | null;
  task_kind: string;
  scope_node_id?: string | null;
  scope_path_hint?: string | null;
  request_reason: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
  last_error_code?: string | null;
  last_error_message?: string | null;
  requested_at: string;
  started_at?: string | null;
  finished_at?: string | null;
}

interface RawSyncOverview {
  mount_id: string;
  provider_type: string;
  sources: RawSyncSource[];
  checkpoints: RawSyncCheckpoint[];
  recent_tasks: RawSyncTask[];
  supported_actions: string[];
}

interface RawSyncEnqueueResponse {
  mount_id: string;
  action: string;
  accepted: boolean;
  message: string;
}

function fromSyncSource(s: RawSyncSource): Pan115SyncSource {
  return {
    sourceId: s.source_id,
    shareItemId: s.share_item_id ?? null,
    displayName: s.display_name ?? null,
    sourceKind: s.source_kind,
    status: s.status,
    rootNodeId: s.root_node_id ?? null,
    lastFullSyncAt: s.last_full_sync_at ?? null,
    lastIncrementalSyncAt: s.last_incremental_sync_at ?? null,
    lastShareDiffAt: s.last_share_diff_at ?? null,
    lastErrorCode: s.last_error_code ?? null,
    lastErrorMessage: s.last_error_message ?? null,
    updatedAt: s.updated_at,
  };
}

function fromSyncCheckpoint(c: RawSyncCheckpoint): Pan115SyncCheckpoint {
  return {
    sourceId: c.source_id,
    shareItemId: c.share_item_id ?? null,
    displayName: c.display_name ?? null,
    checkpointKind: c.checkpoint_kind,
    checkpointValue: c.checkpoint_value ?? null,
    payloadJson: c.payload_json,
    updatedAt: c.updated_at,
  };
}

function fromSyncTask(t: RawSyncTask): Pan115SyncTask {
  return {
    id: t.id,
    sourceId: t.source_id,
    shareItemId: t.share_item_id ?? null,
    displayName: t.display_name ?? null,
    taskKind: t.task_kind,
    scopeNodeId: t.scope_node_id ?? null,
    scopePathHint: t.scope_path_hint ?? null,
    requestReason: t.request_reason,
    status: t.status,
    attemptCount: t.attempt_count,
    maxAttempts: t.max_attempts,
    lastErrorCode: t.last_error_code ?? null,
    lastErrorMessage: t.last_error_message ?? null,
    requestedAt: t.requested_at,
    startedAt: t.started_at ?? null,
    finishedAt: t.finished_at ?? null,
  };
}

export interface RawPreviewQrLoginResponse {
  session_id: string;
  uid: string;
  qr_url: string;
  qr_image: string | null;
}

interface RawPreviewQrStatusResponse {
  status: string;
}

interface RawPreviewCreateResponse {
  preview_id: string;
}

interface Pan115ShareApi {
  /** POST /api/manage/pan115/previews/{preview_id}/browse —— 预览凭据浏览网盘目录。 */
  browsePreview(
    previewId: string,
    req?: Pan115PreviewBrowseRequest,
  ): Promise<Pan115ShareBrowseResponse>;
  /** POST /api/manage/pan115/share-items/browse —— 匿名浏览 115 分享目录。 */
  browseShareItem(req: Pan115ShareBrowseRequest): Promise<Pan115ShareBrowseResponse>;
  /** GET /api/manage/pan115/sync/mounts/{mount_id} —— 同步概览。 */
  syncOverview(mountId: string): Promise<Pan115SyncOverview>;
  /** POST /api/manage/pan115/sync/mounts/{mount_id}/enqueue —— 手动入队同步。 */
  syncEnqueue(
    mountId: string,
    req: Pan115SyncEnqueueRequest,
  ): Promise<Pan115SyncEnqueueResponse>;

  /** POST /api/manage/pan115/share-download-preview/qr-login —— 发起预览登录扫码。 */
  previewQrLogin(req?: Pan115PreviewQrLoginRequest): Promise<Pan115PreviewQrLoginResponse>;
  /** GET /api/manage/pan115/share-download-preview/qr-status?sessionId= —— 轮询扫码状态。 */
  previewQrStatus(sessionId: string): Promise<Pan115PreviewQrStatusResponse>;
  /** POST /api/manage/pan115/share-download-preview/create —— 创建分享下载预览凭据。 */
  previewCreate(req: Pan115PreviewCreateRequest): Promise<Pan115PreviewCreateResponse>;
}

// 将 4 个新方法并入 `basePan115Api`，导出为带完整类型的 `pan115Api`
// （保持单例导出，避免破坏既有调用方；类型含全部原方法 + 新增方法）。
export const pan115Api: typeof basePan115Api & Pan115ShareApi = {
  ...basePan115Api,
  async browsePreview(previewId: string, req: Pan115PreviewBrowseRequest = {}) {
    const raw = await httpClient.post<RawShareBrowseCommonResponse>(
      `/api/manage/pan115/previews/${encodeURIComponent(previewId)}/browse`,
      { body: { path: req.path, offset: req.offset, limit: req.limit } },
    );
    return fromShareBrowseResponse(raw);
  },
  async browseShareItem(req: Pan115ShareBrowseRequest) {
    const raw = await httpClient.post<RawShareBrowseCommonResponse>(
      `/api/manage/pan115/share-items/browse`,
      {
        body: {
          share_code: req.shareCode,
          receive_code: req.receiveCode,
          mount_id: req.mountId,
          path: req.path,
          cid: req.cid,
          offset: req.offset,
          limit: req.limit,
        },
      },
    );
    return fromShareBrowseResponse(raw);
  },
  async syncOverview(mountId: string) {
    const raw = await httpClient.get<RawSyncOverview>(
      `/api/manage/pan115/sync/mounts/${encodeURIComponent(mountId)}`,
    );
    return {
      mountId: raw.mount_id,
      providerType: raw.provider_type,
      sources: (raw.sources ?? []).map(fromSyncSource),
      checkpoints: (raw.checkpoints ?? []).map(fromSyncCheckpoint),
      recentTasks: (raw.recent_tasks ?? []).map(fromSyncTask),
      supportedActions: raw.supported_actions ?? [],
    };
  },
  async syncEnqueue(mountId: string, req: Pan115SyncEnqueueRequest) {
    const raw = await httpClient.post<RawSyncEnqueueResponse>(
      `/api/manage/pan115/sync/mounts/${encodeURIComponent(mountId)}/enqueue`,
      { body: { action: req.action } },
    );
    return {
      mountId: raw.mount_id,
      action: raw.action,
      accepted: raw.accepted,
      message: raw.message,
    };
  },
  async previewQrLogin(req: Pan115PreviewQrLoginRequest = {}) {
    const raw = await httpClient.post<RawPreviewQrLoginResponse>(
      '/api/manage/pan115/share-download-preview/qr-login',
      { body: { app_id: req.appId } },
    );
    return {
      sessionId: raw.session_id,
      uid: raw.uid,
      qrUrl: raw.qr_url,
      qrImage: raw.qr_image ?? null,
    };
  },
  async previewQrStatus(sessionId: string) {
    // ★后端按 V1 wire 取 camelCase `sessionId`（同时接受 snake_case 别名）。
    const raw = await httpClient.get<RawPreviewQrStatusResponse>(
      '/api/manage/pan115/share-download-preview/qr-status',
      { params: { sessionId } },
    );
    return { status: raw.status };
  },
  async previewCreate(req: Pan115PreviewCreateRequest) {
    const raw = await httpClient.post<RawPreviewCreateResponse>(
      '/api/manage/pan115/share-download-preview/create',
      {
        body: {
          session_id: req.sessionId,
          cookie_app: req.cookieApp,
          cookie_header: req.cookieHeader,
          source_mount_id: req.sourceMountId,
        },
      },
    );
    return { previewId: raw.preview_id };
  },
};


