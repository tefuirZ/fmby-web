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
/** 上游分类 / 媒体库条目（V1F-02 S2，wire snake_case → camelCase）。 */
export interface UpstreamCategoryRecord {
  id: string;
  sourceId: string;
  upstreamCategoryId: string;
  parentUpstreamCategoryId: string | null;
  name: string;
  /** `category`（AppleCMS 分类） / `library`（Emby 库）。 */
  kind: string;
  /** 已绑定本地库 id（未绑定为 null）。 */
  libraryId: string | null;
  libraryName: string | null;
  discoveredAt: number;
  updatedAt: number;
}

/** 分类 / 库列表响应。 */
export interface UpstreamCategoryListResponse {
  items: UpstreamCategoryRecord[];
  total: number;
}

/** 绑定写入项（整表替换语义）。 */
export interface UpstreamCategoryBindingInput {
  categoryId: string;
  libraryId: string;
}

/** 映射预设。 */
export interface UpstreamMappingPresetRecord {
  id: string;
  sourceId: string;
  name: string;
  includeKeywords: string[];
  excludeKeywords: string[];
  includeCategoryIds: string[];
  excludeCategoryIds: string[];
  /** PascalCase `Movie` / `Series` / `Mixed`。 */
  defaultLibraryType: string;
  createMissingLibraries: boolean;
  enabled: boolean;
  createdBy: string | null;
  createdAt: number;
  updatedAt: number;
}

/** 预设列表响应。 */
export interface UpstreamMappingPresetListResponse {
  items: UpstreamMappingPresetRecord[];
  total: number;
}

/** 预设写入请求。 */
export interface UpstreamMappingPresetWriteInput {
  name: string;
  includeKeywords: string[];
  excludeKeywords: string[];
  includeCategoryIds: string[];
  excludeCategoryIds: string[];
  defaultLibraryType?: string;
  createMissingLibraries: boolean;
  enabled: boolean;
}

/** 单类目覆盖指令。 */
export interface UpstreamMappingOverrideInput {
  categoryId: string;
  selected: boolean;
  action?: string;
  libraryId?: string;
  libraryName?: string;
  libraryType?: string;
}

/** 映射预览请求（纯计算，不写库）。 */
export interface UpstreamMappingPreviewInput {
  presetId?: string;
  includeKeywords: string[];
  excludeKeywords: string[];
  includeCategoryIds: string[];
  excludeCategoryIds: string[];
  selectedCategoryIds?: string[];
  defaultLibraryType?: string;
  createMissingLibraries?: boolean;
  overrides: UpstreamMappingOverrideInput[];
}

/** 预览项。 */
export interface UpstreamMappingPreviewItem {
  categoryId: string;
  upstreamCategoryId: string;
  categoryName: string;
  selected: boolean;
  /** `bind_existing` / `create_library` / `skip` / `conflict`。 */
  action: string;
  libraryId: string | null;
  libraryName: string | null;
  createKey: string | null;
  createLibraryName: string | null;
  createLibraryType: string | null;
  skipReason: string | null;
  conflictMessage: string | null;
}

/** 建库计划。 */
export interface UpstreamMappingCreatePlan {
  key: string;
  name: string;
  libraryType: string;
  categoryIds: string[];
}

/** 预览响应（含四计数）。 */
export interface UpstreamMappingPreviewResult {
  sourceId: string;
  items: UpstreamMappingPreviewItem[];
  creates: UpstreamMappingCreatePlan[];
  bindCount: number;
  createCount: number;
  skipCount: number;
  conflictCount: number;
}

/** 应用结果（不可逆写操作）。 */
export interface UpstreamMappingApplyResult {
  sourceId: string;
  createdLibraryCount: number;
  boundCategoryCount: number;
  preset: UpstreamMappingPresetRecord | null;
}
