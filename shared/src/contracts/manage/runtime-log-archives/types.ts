/** 运行日志归档（GET /api/manage/runtime-log-archives + /{archiveId}/download；K3/B08-B09）。 */

/** 单条归档（wire snake_case 直出字段见 raw-types）。 */
export interface RuntimeLogArchiveRecord {
  /** sha256(file_name)，下载与路径穿越防护共用。 */
  id: string;
  fileName: string;
  /** 日志日 YYYY-MM-DD；文件名日期无法解析时为 null。 */
  logDate: string | null;
  compressedSizeBytes: number;
  originalSizeBytes: number;
  compressionRatio: number;
  /** 文件 mtime（RFC3339 UTC）。 */
  createdAt: string;
  /** 保留到期（log_date + retention_days 上海零点）；无法解析时 null。 */
  expiresAt: string | null;
}

/** 归档清单响应。 */
export interface RuntimeLogArchivesResponse {
  items: RuntimeLogArchiveRecord[];
  total: number;
  /** 归档目录绝对路径（管理面可见，与 V1 log_dir 同语义）。 */
  logDir: string;
  /** 保留窗（天）。 */
  retentionDays: number;
}

/** 归档清单查询参数（后端 wire 主名 pageSize；QUERY-CAMELCASE）。 */
export interface RuntimeLogArchivesQuery {
  page?: number;
  pageSize?: number;
}
