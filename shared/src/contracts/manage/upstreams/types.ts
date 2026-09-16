/** 上游源记录（V1F-02-A 读 DTO，wire snake_case → camelCase）。 */
export interface UpstreamSourceRecord {
  id: string;
  name: string;
  sourceType: string;
  sourceTypeLabel: string;
  baseUrl: string;
  authMethod: string;
  status: string;
  username: string | null;
  userAgent: string | null;
  referer: string | null;
  extraHeaders: Record<string, string>;
  /** 是否已设置凭据（读接口永不回显明文）。 */
  hasSecret: boolean;
  lastHealthCheckAt: number | null;
  lastSyncAt: number | null;
  lastErrorAt: number | null;
  lastErrorMessage: string | null;
  createdBy: string | null;
  createdAt: number;
  updatedAt: number;
}

/** 上游源列表响应。 */
export interface UpstreamSourceListResponse {
  items: UpstreamSourceRecord[];
  total: number;
}

/** 源列表查询参数（可选过滤）。 */
export interface UpstreamSourceListQuery {
  sourceType?: string;
  status?: string;
}

/** 源创建 / 更新请求。明文秘密由后端密封，读接口不回显。 */
export interface UpstreamSourceWriteInput {
  name: string;
  sourceType: string;
  baseUrl: string;
  authMethod: string;
  username?: string;
  password?: string;
  apiKey?: string;
  userAgent?: string;
  referer?: string;
  extraHeaders?: Record<string, string>;
  /** PATCH 未提供新凭据时的保留语义。 */
  retainSecret?: boolean;
  enabled?: boolean;
}

/** 源健康探活结果（V1F-02 S3）。 */
export interface UpstreamHealthCheck {
  sourceId: string;
  sourceType: string;
  status: string;
  healthStatus: string;
  checkedAt: number;
  message: string;
  serverName: string | null;
  serverVersion: string | null;
  serverId: string | null;
}

/** Emby 局域网发现条目（真实发现，UDP，无需凭据）。 */
export interface UpstreamLanDiscoveryItem {
  name: string;
  serverId: string | null;
  baseUrl: string;
  endpointAddress: string | null;
}

/** 局域网发现列表响应。 */
export interface UpstreamLanDiscoveryResult {
  items: UpstreamLanDiscoveryItem[];
  total: number;
}