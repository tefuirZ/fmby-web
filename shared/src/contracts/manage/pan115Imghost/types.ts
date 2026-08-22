/**
 * Pan115 图床 — API 类型定义
 *
 * 注意：图床凭据独立于挂载凭据。即使已绑定 Mount，也需单独扫码绑定图床。
 */

// ─── 二维码状态 ─────────────────────────────────────────────────────────────

export type Pan115ImghostQrcodeStatus =
  | 'waiting'
  | 'scanned'
  | 'signed'
  | 'expired'
  | 'canceled'
  | 'aborted'
  | 'unknown';

// ─── 凭据状态 ────────────────────────────────────────────────────────────────

export type Pan115ImghostCredentialStatus =
  | 'Active'
  | 'Pending'
  | 'Expired'
  | 'Unbound';

// ─── 镜像状态 ────────────────────────────────────────────────────────────────

export type Pan115ImghostMirrorStatus =
  | 'Uploading'
  | 'Ok'
  | 'Failed'
  | 'Unreachable'
  | 'Disabled';

// ─── 扫码登录 ────────────────────────────────────────────────────────────────

export interface Pan115ImghostQrLoginRequest {
  appId?: string;
}

export interface Pan115ImghostQrLoginResponse {
  sessionId: string;
  uid: string;
  qrUrl: string;
  qrImage?: string;
}

export interface Pan115ImghostQrStatusResponse {
  status: Pan115ImghostQrcodeStatus;
}

export interface Pan115ImghostActivateRequest {
  sessionId: string;
  /** 默认 alipaymini */
  cookieApp?: string;
}

// ─── 凭据信息 ────────────────────────────────────────────────────────────────

export interface Pan115ImghostCredentials {
  id: string;
  status: Pan115ImghostCredentialStatus;
  hasCookie: boolean;
  lastActiveAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── 资产 ────────────────────────────────────────────────────────────────────

export interface Pan115ImghostAsset {
  id: string;
  sha1: string;
  size: number;
  mime: string;
  ext: string;
  originalFilename: string;
  mirrorStatus: Pan115ImghostMirrorStatus;
  /** 本地兜底链接，形如 /api/manage/pan115/imghost/raw/<sha1> */
  localUrl: string;
  /** 115 永久直链，镜像完成前为 null */
  hostUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Pan115ImghostAssetListResponse {
  total: number;
  page: number;
  pageSize: number;
  items: Pan115ImghostAsset[];
}

export interface Pan115ImghostUploadResponse {
  id: string;
  sha1: string;
  size: number;
  mime: string;
  mirrorStatus: Pan115ImghostMirrorStatus;
  localUrl: string;
  hostUrl: string | null;
}
