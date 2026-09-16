import { httpClient } from "@fmby/v2-shared/api/client";
import { isApiError } from "@fmby/v2-shared/errors";
import type {
  UpstreamCategoryBindingInput,
  UpstreamCategoryListResponse,
  UpstreamCategoryRecord,
  UpstreamHealthCheck,
  UpstreamLanDiscoveryItem,
  UpstreamLanDiscoveryResult,
  UpstreamMappingApplyResult,
  UpstreamMappingOverrideInput,
  UpstreamMappingPresetListResponse,
  UpstreamMappingPresetRecord,
  UpstreamMappingPresetWriteInput,
  UpstreamMappingPreviewInput,
  UpstreamMappingPreviewItem,
  UpstreamMappingPreviewResult,
  UpstreamSourceListQuery,
  UpstreamSourceListResponse,
  UpstreamSourceRecord,
  UpstreamSourceWriteInput,
} from "./types";

interface RawUpstreamSource {
  id: string;
  name: string;
  source_type: string;
  source_type_label: string;
  base_url: string;
  auth_method: string;
  status: string;
  username: string | null;
  user_agent: string | null;
  referer: string | null;
  extra_headers: Record<string, string>;
  has_secret: boolean;
  last_health_check_at: number | null;
  last_sync_at: number | null;
  last_error_at: number | null;
  last_error_message: string | null;
  created_by: string | null;
  created_at: number;
  updated_at: number;
}

interface RawUpstreamSourceList {
  items: RawUpstreamSource[];
  total: number;
}

interface RawUpstreamHealthCheck {
  source_id: string;
  source_type: string;
  status: string;
  health_status: string;
  checked_at: number;
  message: string;
  server_name: string | null;
  server_version: string | null;
  server_id: string | null;
}

interface RawLanDiscoveryItem {
  name: string;
  server_id: string | null;
  base_url: string;
  endpoint_address: string | null;
}

interface RawLanDiscoveryList {
  items: RawLanDiscoveryItem[];
  total: number;
}

interface RawUpstreamCategory {
  id: string;
  source_id: string;
  upstream_category_id: string;
  parent_upstream_category_id: string | null;
  name: string;
  kind: string;
  library_id: string | null;
  library_name: string | null;
  discovered_at: number;
  updated_at: number;
}

interface RawUpstreamCategoryList {
  items: RawUpstreamCategory[];
  total: number;
}

interface RawMappingPreset {
  id: string;
  source_id: string;
  name: string;
  include_keywords: string[];
  exclude_keywords: string[];
  include_category_ids: string[];
  exclude_category_ids: string[];
  default_library_type: string;
  create_missing_libraries: boolean;
  enabled: boolean;
  created_by: string | null;
  created_at: number;
  updated_at: number;
}

interface RawMappingPresetList {
  items: RawMappingPreset[];
  total: number;
}

interface RawPreviewItem {
  category_id: string;
  upstream_category_id: string;
  category_name: string;
  selected: boolean;
  action: string;
  library_id: string | null;
  library_name: string | null;
  create_key: string | null;
  create_library_name: string | null;
  create_library_type: string | null;
  skip_reason: string | null;
  conflict_message: string | null;
}

interface RawPreviewResult {
  source_id: string;
  items: RawPreviewItem[];
  creates: {
    key: string;
    name: string;
    library_type: string;
    category_ids: string[];
  }[];
  bind_count: number;
  create_count: number;
  skip_count: number;
  conflict_count: number;
}

interface RawApplyResult {
  source_id: string;
  created_library_count: number;
  bound_category_count: number;
  preset: RawMappingPreset | null;
}

/** 后端端口未装配 / 能力未实现时的 fail-closed 判定。 */
export function isUpstreamsUnwiredError(error: unknown): boolean {
  if (!isApiError(error)) {
    return false;
  }
  const code = error.code;
  if (
    code === "not_found" ||
    code === "NOT_FOUND" ||
    code === "HTTP_404" ||
    code === "not_implemented" ||
    code === "NOT_IMPLEMENTED" ||
    code === "HTTP_501" ||
    code === "internal" ||
    code === "HTTP_500"
  ) {
    return true;
  }
  const status = (error as { status?: unknown }).status;
  return status === 404 || status === 501 || status === 500;
}

function fromSource(r: RawUpstreamSource): UpstreamSourceRecord {
  return {
    id: r.id,
    name: r.name,
    sourceType: r.source_type,
    sourceTypeLabel: r.source_type_label,
    baseUrl: r.base_url,
    authMethod: r.auth_method,
    status: r.status,
    username: r.username,
    userAgent: r.user_agent,
    referer: r.referer,
    extraHeaders: r.extra_headers ?? {},
    hasSecret: r.has_secret,
    lastHealthCheckAt: r.last_health_check_at,
    lastSyncAt: r.last_sync_at,
    lastErrorAt: r.last_error_at,
    lastErrorMessage: r.last_error_message,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function fromHealthCheck(r: RawUpstreamHealthCheck): UpstreamHealthCheck {
  return {
    sourceId: r.source_id,
    sourceType: r.source_type,
    status: r.status,
    healthStatus: r.health_status,
    checkedAt: r.checked_at,
    message: r.message,
    serverName: r.server_name,
    serverVersion: r.server_version,
    serverId: r.server_id,
  };
}

function fromDiscoveryItem(r: RawLanDiscoveryItem): UpstreamLanDiscoveryItem {
  return {
    name: r.name,
    serverId: r.server_id,
    baseUrl: r.base_url,
    endpointAddress: r.endpoint_address,
  };
}

function toWriteBody(input: UpstreamSourceWriteInput): Record<string, unknown> {
  return {
    name: input.name,
    sourceType: input.sourceType,
    baseUrl: input.baseUrl,
    authMethod: input.authMethod,
    username: input.username ?? undefined,
    password: input.password ?? undefined,
    apiKey: input.apiKey ?? undefined,
    userAgent: input.userAgent ?? undefined,
    referer: input.referer ?? undefined,
    extraHeaders: input.extraHeaders ?? {},
    retainSecret: input.retainSecret ?? false,
    enabled: input.enabled ?? true,
  };
}

/** 上游源 API（V1F-02-A + S1..S4，capability ManageMount）。 */
export const upstreamsApi = {
  async list(query: UpstreamSourceListQuery = {}): Promise<UpstreamSourceListResponse> {
    const raw = await httpClient.get<RawUpstreamSourceList>("/api/manage/upstreams", {
      params: {
        sourceType: query.sourceType || undefined,
        status: query.status || undefined,
      },
    });
    return {
      items: raw.items.map(fromSource),
      total: raw.total,
    };
  },

  async get(id: string): Promise<UpstreamSourceRecord> {
    const raw = await httpClient.get<RawUpstreamSource>(
      `/api/manage/upstreams/${encodeURIComponent(id)}`,
    );
    return fromSource(raw);
  },

  async create(input: UpstreamSourceWriteInput): Promise<UpstreamSourceRecord> {
    const raw = await httpClient.post<RawUpstreamSource>("/api/manage/upstreams", {
      body: toWriteBody(input),
    });
    return fromSource(raw);
  },

  async update(id: string, input: UpstreamSourceWriteInput): Promise<UpstreamSourceRecord> {
    const raw = await httpClient.patch<RawUpstreamSource>(
      `/api/manage/upstreams/${encodeURIComponent(id)}`,
      { body: toWriteBody(input) },
    );
    return fromSource(raw);
  },

  async remove(id: string): Promise<void> {
    await httpClient.delete<{ ok: boolean }>(
      `/api/manage/upstreams/${encodeURIComponent(id)}`,
    );
  },

  async enable(id: string): Promise<UpstreamSourceRecord> {
    const raw = await httpClient.post<RawUpstreamSource>(
      `/api/manage/upstreams/${encodeURIComponent(id)}/enable`,
    );
    return fromSource(raw);
  },

  async disable(id: string): Promise<UpstreamSourceRecord> {
    const raw = await httpClient.post<RawUpstreamSource>(
      `/api/manage/upstreams/${encodeURIComponent(id)}/disable`,
    );
    return fromSource(raw);
  },

  async healthCheck(id: string): Promise<UpstreamHealthCheck> {
    const raw = await httpClient.post<RawUpstreamHealthCheck>(
      `/api/manage/upstreams/${encodeURIComponent(id)}/health-check`,
    );
    return fromHealthCheck(raw);
  },

  async listAppleCmsCategories(
    id: string,
  ): Promise<UpstreamCategoryListResponse> {
    const raw = await httpClient.get<RawUpstreamCategoryList>(
      `/api/manage/upstreams/${encodeURIComponent(id)}/apple-cms/categories`,
    );
    return { items: raw.items.map(fromCategory), total: raw.total };
  },

  async listEmbyLibraries(id: string): Promise<UpstreamCategoryListResponse> {
    const raw = await httpClient.get<RawUpstreamCategoryList>(
      `/api/manage/upstreams/${encodeURIComponent(id)}/emby/libraries`,
    );
    return { items: raw.items.map(fromCategory), total: raw.total };
  },

  async listBindings(id: string, libraryId?: string): Promise<UpstreamCategoryListResponse> {
    const raw = await httpClient.get<RawUpstreamCategoryList>(
      `/api/manage/upstreams/${encodeURIComponent(id)}/bindings`,
      { params: { libraryId: libraryId || undefined } },
    );
    return { items: raw.items.map(fromCategory), total: raw.total };
  },

  /** AppleCMS 真实分类发现（S3，外部调用 + 凭据开封）。 */
  async discoverAppleCmsCategories(
    id: string,
  ): Promise<UpstreamCategoryListResponse> {
    const raw = await httpClient.post<RawUpstreamCategoryList>(
      `/api/manage/upstreams/${encodeURIComponent(id)}/apple-cms/discover-categories`,
    );
    return { items: raw.items.map(fromCategory), total: raw.total };
  },

  /** Emby 真实媒体库发现（S3）。 */
  async discoverEmbyLibraries(id: string): Promise<UpstreamCategoryListResponse> {
    const raw = await httpClient.post<RawUpstreamCategoryList>(
      `/api/manage/upstreams/${encodeURIComponent(id)}/emby/discover-libraries`,
    );
    return { items: raw.items.map(fromCategory), total: raw.total };
  },

  /** 绑定整表替换（全量覆盖，非增量）。 */
  async replaceAppleCmsCategoryBindings(
    id: string,
    bindings: UpstreamCategoryBindingInput[],
  ): Promise<UpstreamCategoryListResponse> {
    const raw = await httpClient.put<RawUpstreamCategoryList>(
      `/api/manage/upstreams/${encodeURIComponent(id)}/apple-cms/category-bindings`,
      {
        body: {
          bindings: bindings.map((b) => ({
            categoryId: b.categoryId,
            libraryId: b.libraryId,
          })),
        },
      },
    );
    return { items: raw.items.map(fromCategory), total: raw.total };
  },

  /** 绑定整表替换（Emby 库）。 */
  async replaceEmbyLibraryBindings(
    id: string,
    bindings: UpstreamCategoryBindingInput[],
  ): Promise<UpstreamCategoryListResponse> {
    const raw = await httpClient.put<RawUpstreamCategoryList>(
      `/api/manage/upstreams/${encodeURIComponent(id)}/emby/library-bindings`,
      {
        body: {
          bindings: bindings.map((b) => ({
            categoryId: b.categoryId,
            libraryId: b.libraryId,
          })),
        },
      },
    );
    return { items: raw.items.map(fromCategory), total: raw.total };
  },

  async listPresets(id: string): Promise<UpstreamMappingPresetListResponse> {
    const raw = await httpClient.get<RawMappingPresetList>(
      `/api/manage/upstreams/${encodeURIComponent(id)}/mapping/presets`,
    );
    return { items: raw.items.map(fromPreset), total: raw.total };
  },

  async createPreset(
    id: string,
    input: UpstreamMappingPresetWriteInput,
  ): Promise<UpstreamMappingPresetRecord> {
    const raw = await httpClient.post<RawMappingPreset>(
      `/api/manage/upstreams/${encodeURIComponent(id)}/mapping/presets`,
      { body: toPresetBody(input) },
    );
    return fromPreset(raw);
  },

  async updatePreset(
    id: string,
    presetId: string,
    input: UpstreamMappingPresetWriteInput,
  ): Promise<UpstreamMappingPresetRecord> {
    const raw = await httpClient.put<RawMappingPreset>(
      `/api/manage/upstreams/${encodeURIComponent(id)}/mapping/presets/${encodeURIComponent(presetId)}`,
      { body: toPresetBody(input) },
    );
    return fromPreset(raw);
  },

  async deletePreset(id: string, presetId: string): Promise<void> {
    await httpClient.delete<void>(
      `/api/manage/upstreams/${encodeURIComponent(id)}/mapping/presets/${encodeURIComponent(presetId)}`,
    );
  },

  /** 预览（纯计算，不写库）。 */
  async previewMapping(
    id: string,
    input: UpstreamMappingPreviewInput,
  ): Promise<UpstreamMappingPreviewResult> {
    const raw = await httpClient.post<RawPreviewResult>(
      `/api/manage/upstreams/${encodeURIComponent(id)}/mapping/preview`,
      { body: toPreviewBody(input) },
    );
    return {
      sourceId: raw.source_id,
      items: raw.items.map(fromPreviewItem),
      creates: raw.creates.map((c) => ({
        key: c.key,
        name: c.name,
        libraryType: c.library_type,
        categoryIds: c.category_ids,
      })),
      bindCount: raw.bind_count,
      createCount: raw.create_count,
      skipCount: raw.skip_count,
      conflictCount: raw.conflict_count,
    };
  },

  /** 应用（落库，不可逆）——映射写操作，前端需二次确认。 */
  async applyMapping(
    id: string,
    input: UpstreamMappingPreviewInput,
    savePresetName?: string,
  ): Promise<UpstreamMappingApplyResult> {
    const raw = await httpClient.post<RawApplyResult>(
      `/api/manage/upstreams/${encodeURIComponent(id)}/mapping/apply`,
      {
        body: {
          ...toPreviewBody(input),
          savePresetName: savePresetName || undefined,
        },
      },
    );
    return {
      sourceId: raw.source_id,
      createdLibraryCount: raw.created_library_count,
      boundCategoryCount: raw.bound_category_count,
      preset: raw.preset ? fromPreset(raw.preset) : null,
    };
  },

  async discoverLan(): Promise<UpstreamLanDiscoveryResult> {
    const raw = await httpClient.post<RawLanDiscoveryList>(
      "/api/manage/upstreams/emby/discover-lan",
    );
    return {
      items: raw.items.map(fromDiscoveryItem),
      total: raw.total,
    };
  },
};

function fromCategory(r: RawUpstreamCategory): UpstreamCategoryRecord {
  return {
    id: r.id,
    sourceId: r.source_id,
    upstreamCategoryId: r.upstream_category_id,
    parentUpstreamCategoryId: r.parent_upstream_category_id,
    name: r.name,
    kind: r.kind,
    libraryId: r.library_id,
    libraryName: r.library_name,
    discoveredAt: r.discovered_at,
    updatedAt: r.updated_at,
  };
}

function fromPreset(r: RawMappingPreset): UpstreamMappingPresetRecord {
  return {
    id: r.id,
    sourceId: r.source_id,
    name: r.name,
    includeKeywords: r.include_keywords ?? [],
    excludeKeywords: r.exclude_keywords ?? [],
    includeCategoryIds: r.include_category_ids ?? [],
    excludeCategoryIds: r.exclude_category_ids ?? [],
    defaultLibraryType: r.default_library_type,
    createMissingLibraries: r.create_missing_libraries,
    enabled: r.enabled,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function fromPreviewItem(r: RawPreviewItem): UpstreamMappingPreviewItem {
  return {
    categoryId: r.category_id,
    upstreamCategoryId: r.upstream_category_id,
    categoryName: r.category_name,
    selected: r.selected,
    action: r.action,
    libraryId: r.library_id,
    libraryName: r.library_name,
    createKey: r.create_key,
    createLibraryName: r.create_library_name,
    createLibraryType: r.create_library_type,
    skipReason: r.skip_reason,
    conflictMessage: r.conflict_message,
  };
}

function toPresetBody(input: UpstreamMappingPresetWriteInput): Record<string, unknown> {
  return {
    name: input.name,
    includeKeywords: input.includeKeywords,
    excludeKeywords: input.excludeKeywords,
    includeCategoryIds: input.includeCategoryIds,
    excludeCategoryIds: input.excludeCategoryIds,
    defaultLibraryType: input.defaultLibraryType ?? undefined,
    createMissingLibraries: input.createMissingLibraries,
    enabled: input.enabled,
  };
}

function toOverrideBody(o: UpstreamMappingOverrideInput): Record<string, unknown> {
  return {
    categoryId: o.categoryId,
    selected: o.selected,
    action: o.action ?? undefined,
    libraryId: o.libraryId ?? undefined,
    libraryName: o.libraryName ?? undefined,
    libraryType: o.libraryType ?? undefined,
  };
}

/** 预览请求体（apply 用 flatten 语义平铺同套字段 + savePresetName）。 */
function toPreviewBody(input: UpstreamMappingPreviewInput): Record<string, unknown> {
  return {
    presetId: input.presetId ?? undefined,
    includeKeywords: input.includeKeywords,
    excludeKeywords: input.excludeKeywords,
    includeCategoryIds: input.includeCategoryIds,
    excludeCategoryIds: input.excludeCategoryIds,
    selectedCategoryIds: input.selectedCategoryIds ?? undefined,
    defaultLibraryType: input.defaultLibraryType ?? undefined,
    createMissingLibraries: input.createMissingLibraries ?? undefined,
    overrides: input.overrides.map(toOverrideBody),
  };
}
