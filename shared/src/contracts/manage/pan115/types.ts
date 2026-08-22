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
}
