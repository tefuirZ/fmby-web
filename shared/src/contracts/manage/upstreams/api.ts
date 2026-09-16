import { httpClient } from "@fmby/v2-shared/api/client";
import { isApiError } from "@fmby/v2-shared/errors";
import type {
  UpstreamHealthCheck,
  UpstreamLanDiscoveryItem,
  UpstreamLanDiscoveryResult,
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