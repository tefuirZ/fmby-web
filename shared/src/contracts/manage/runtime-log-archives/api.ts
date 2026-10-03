import { httpClient } from "@fmby/v2-shared/api/client";
import type { RuntimeLogArchiveRecord, RuntimeLogArchivesResponse, RuntimeLogArchivesQuery } from "./types";

interface RawRuntimeLogArchiveRecord {
  id: string;
  file_name: string;
  log_date?: string | null;
  compressed_size_bytes: number;
  original_size_bytes: number;
  compression_ratio: number;
  created_at: string;
  expires_at?: string | null;
}

interface RawManagedRuntimeLogArchivesResponse {
  items: RawRuntimeLogArchiveRecord[];
  total: number;
  log_dir: string;
  retention_days: number;
}

function fromRaw(raw: RawRuntimeLogArchiveRecord): RuntimeLogArchiveRecord {
  return {
    id: raw.id,
    fileName: raw.file_name,
    logDate: raw.log_date ?? null,
    compressedSizeBytes: raw.compressed_size_bytes,
    originalSizeBytes: raw.original_size_bytes,
    compressionRatio: raw.compression_ratio,
    createdAt: raw.created_at,
    expiresAt: raw.expires_at ?? null,
  };
}

/**
 * 运行日志归档 API（capability VIEW_AUDIT，与 runtime-logs 同口径）。
 * 下载：后端流式 zip + Content-Disposition；session cookie 鉴权（same-origin）⇒
 * 原生 fetch 取 blob（httpClient.get 只出 JSON），交调用方触发浏览器保存。
 */
export const runtimeLogArchivesApi = {
  async list(query?: RuntimeLogArchivesQuery): Promise<RuntimeLogArchivesResponse> {
    const raw = await httpClient.get<RawManagedRuntimeLogArchivesResponse>(
      "/api/manage/runtime-log-archives",
      query ? { params: { page: query.page, pageSize: query.pageSize } } : undefined,
    );
    return {
      items: (raw.items ?? []).map(fromRaw),
      total: raw.total ?? 0,
      logDir: raw.log_dir,
      retentionDays: raw.retention_days,
    };
  },

  /** 下载归档 zip → Blob（same-origin 自动带 session cookie）。 */
  async download(archiveId: string): Promise<Blob> {
    const response = await fetch(`/api/manage/runtime-log-archives/${encodeURIComponent(archiveId)}/download`, {
      credentials: "same-origin",
    });
    if (!response.ok) {
      throw new Error(`归档下载失败（HTTP ${response.status}）`);
    }
    return response.blob();
  },
};
