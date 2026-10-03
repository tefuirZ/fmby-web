import { httpClient } from "@fmby/v2-shared/api/client";
import { isApiError } from "@fmby/v2-shared/errors";
import type { StorageFootprintResponse } from "./types";

/** 端口未装配等内部错误（500）——与 system-about 同口径 fail-closed 判定。 */
export function isStorageFootprintUnwiredError(error: unknown): boolean {
  if (!isApiError(error)) {
    return false;
  }
  const status = (error as { status?: unknown }).status;
  return status === 500;
}

interface RawStorageFootprintResponse {
  backend: string;
  supported: boolean;
  reason?: string | null;
  generated_at: number;
  postgres?: {
    database_size_bytes: number;
    largest_relations: Array<{
      relation_name: string;
      relation_kind: string;
      total_size_bytes: number;
      table_size_bytes: number;
      index_size_bytes: number;
      live_tuples: number;
      dead_tuples: number;
    }>;
    settings: Array<{
      name: string;
      setting: string;
      unit?: string | null;
      source: string;
    }>;
  } | null;
  file_search?: unknown | null;
}

function fromRaw(raw: RawStorageFootprintResponse): StorageFootprintResponse {
  return {
    backend: raw.backend,
    supported: raw.supported,
    reason: raw.reason ?? null,
    generatedAt: raw.generated_at,
    postgres: raw.postgres
      ? {
          databaseSizeBytes: raw.postgres.database_size_bytes,
          largestRelations: raw.postgres.largest_relations.map((r) => ({
            relationName: r.relation_name,
            relationKind: r.relation_kind,
            totalSizeBytes: r.total_size_bytes,
            tableSizeBytes: r.table_size_bytes,
            indexSizeBytes: r.index_size_bytes,
            liveTuples: r.live_tuples,
            deadTuples: r.dead_tuples,
          })),
          settings: raw.postgres.settings.map((s) => ({
            name: s.name,
            setting: s.setting,
            unit: s.unit ?? null,
            source: s.source,
          })),
        }
      : null,
    fileSearch: raw.file_search ?? null,
  };
}

/** 系统存储占用 API（capability ManageAccess；SQLite 后端 200 优雅降级 supported=false）。 */
export const storageFootprintApi = {
  async footprint(): Promise<StorageFootprintResponse> {
    const raw = await httpClient.get<RawStorageFootprintResponse>(
      "/api/manage/system/storage-footprint",
    );
    return fromRaw(raw);
  },
};
