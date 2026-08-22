import { httpClient } from '@fmby/v2-shared/api/client';
import type {
  Pan115ImghostActivateRequest,
  Pan115ImghostAsset,
  Pan115ImghostAssetListResponse,
  Pan115ImghostCredentials,
  Pan115ImghostQrLoginRequest,
  Pan115ImghostQrLoginResponse,
  Pan115ImghostQrStatusResponse,
  Pan115ImghostUploadResponse,
} from './types';

// ─── 服务端原始响应（snake_case）────────────────────────────────────────────

interface RawQrLogin {
  session_id: string;
  uid: string;
  qr_url: string;
  qr_image?: string | null;
}

interface RawQrStatus {
  status: unknown;
}

interface RawCredentials {
  id: string;
  status: string;
  has_cookie: boolean;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
}

interface RawAsset {
  id: string;
  sha1: string;
  size: number;
  mime: string;
  ext: string;
  original_filename: string;
  mirror_status: string;
  local_url: string;
  host_url: string | null;
  created_at: string;
  updated_at: string;
}

interface RawAssetList {
  total: number;
  page: number;
  page_size: number;
  items: RawAsset[];
}

interface RawUpload {
  id: string;
  sha1: string;
  size: number;
  mime: string;
  mirror_status: string;
  local_url: string;
  host_url: string | null;
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

function normalizeQrStatus(value: unknown): Pan115ImghostQrStatusResponse['status'] {
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (QR_STATUSES.has(normalized)) return normalized as Pan115ImghostQrStatusResponse['status'];
  }
  return 'unknown';
}

// ─── 转换函数 ─────────────────────────────────────────────────────────────────

function fromCredentials(r: RawCredentials): Pan115ImghostCredentials {
  return {
    id: r.id,
    status: r.status as Pan115ImghostCredentials['status'],
    hasCookie: r.has_cookie,
    lastActiveAt: r.last_active_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function fromAsset(r: RawAsset): Pan115ImghostAsset {
  return {
    id: r.id,
    sha1: r.sha1,
    size: r.size,
    mime: r.mime,
    ext: r.ext,
    originalFilename: r.original_filename,
    mirrorStatus: r.mirror_status as Pan115ImghostAsset['mirrorStatus'],
    localUrl: r.local_url,
    hostUrl: r.host_url,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** 读取 cookie 值（复用 httpClient 内相同逻辑） */
function readCookie(name: string): string | null {
  for (const pair of document.cookie.split(';')) {
    const t = pair.trim();
    if (t.startsWith(`${name}=`)) {
      const v = t.slice(name.length + 1).trim();
      return v === '' ? null : decodeURIComponent(v);
    }
  }
  return null;
}

const BASE = '/api/manage/pan115/imghost';

// ─── API 客户端 ───────────────────────────────────────────────────────────────

export const pan115ImghostApi = {
  async startQrLogin(req: Pan115ImghostQrLoginRequest = {}): Promise<Pan115ImghostQrLoginResponse> {
    const raw = await httpClient.post<RawQrLogin>(`${BASE}/qr-login`, {
      body: { app_id: req.appId },
    });
    return { sessionId: raw.session_id, uid: raw.uid, qrUrl: raw.qr_url, qrImage: raw.qr_image ?? undefined };
  },

  async pollQrStatus(sessionId: string): Promise<Pan115ImghostQrStatusResponse> {
    const raw = await httpClient.get<RawQrStatus>(`${BASE}/qr-status`, {
      params: { session_id: sessionId },
      timeout: 35_000,
    });
    return { status: normalizeQrStatus(raw.status) };
  },

  async activate(req: Pan115ImghostActivateRequest): Promise<{ ok: boolean }> {
    return httpClient.post<{ ok: boolean }>(`${BASE}/activate`, {
      body: { session_id: req.sessionId, cookie_app: req.cookieApp },
    });
  },

  async getCredentials(): Promise<Pan115ImghostCredentials> {
    const raw = await httpClient.get<RawCredentials>(`${BASE}/credentials`);
    return fromCredentials(raw);
  },

  async deleteCredentials(): Promise<{ ok: boolean }> {
    return httpClient.delete<{ ok: boolean }>(`${BASE}/credentials`);
  },

  /**
   * 上传图片（支持进度回调）。
   * 若传入 onProgress，内部使用 XHR 实现实时进度；否则退化到 httpClient.post。
   */
  uploadAsset(
    file: File,
    mode: 'permanent' | 'oneshot' = 'permanent',
    onProgress?: (pct: number) => void,
  ): Promise<Pan115ImghostUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);

    if (!onProgress) {
      return httpClient
        .post<RawUpload>(`${BASE}/upload`, { body: formData })
        .then((raw) => ({
          id: raw.id,
          sha1: raw.sha1,
          size: raw.size,
          mime: raw.mime,
          mirrorStatus: raw.mirror_status as Pan115ImghostUploadResponse['mirrorStatus'],
          localUrl: raw.local_url,
          hostUrl: raw.host_url,
        }));
    }

    return new Promise<Pan115ImghostUploadResponse>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', BASE + '/upload');
      xhr.setRequestHeader('X-Requested-With', 'FMBY-Web');
      const csrf = readCookie('fmby_csrf');
      if (csrf) xhr.setRequestHeader('X-CSRF-Token', csrf);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const raw: RawUpload = JSON.parse(xhr.responseText);
            resolve({
              id: raw.id,
              sha1: raw.sha1,
              size: raw.size,
              mime: raw.mime,
              mirrorStatus: raw.mirror_status as Pan115ImghostUploadResponse['mirrorStatus'],
              localUrl: raw.local_url,
              hostUrl: raw.host_url,
            });
          } catch {
            reject(new Error('响应解析失败'));
          }
        } else {
          try {
            const body = JSON.parse(xhr.responseText);
            reject(new Error(body?.message ?? `上传失败（HTTP ${xhr.status}）`));
          } catch {
            reject(new Error(`上传失败（HTTP ${xhr.status}）`));
          }
        }
      };

      xhr.onerror = () => reject(new Error('网络错误，请检查连接后重试。'));
      xhr.send(formData);
    });
  },

  async listAssets(page = 1, pageSize = 50): Promise<Pan115ImghostAssetListResponse> {
    const raw = await httpClient.get<RawAssetList>(`${BASE}/assets`, {
      params: { page, page_size: pageSize },
    });
    return {
      total: raw.total,
      page: raw.page,
      pageSize: raw.page_size,
      items: raw.items.map(fromAsset),
    };
  },
};
