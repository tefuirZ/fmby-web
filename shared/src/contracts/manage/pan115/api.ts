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
} from "./types";

interface RawAccountInfo {
  mount_id: string;
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
    status: r.status,
    hasCookie: r.has_cookie,
    hasOpenToken: r.has_open_token,
    lastActiveAt: r.last_active_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export const pan115Api = {
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

  async browseDirectory(mountId: string, path?: string): Promise<Pan115BrowseResponse> {
    const raw = await httpClient.post<RawBrowseResponse>(
      `/api/manage/pan115/accounts/${encodeURIComponent(mountId)}/browse`,
      { body: { path } },
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
    };
  },

  async unbind(mountId: string): Promise<void> {
    await httpClient.delete<{ ok: boolean }>(
      `/api/manage/pan115/accounts/${encodeURIComponent(mountId)}`,
    );
  },
};
