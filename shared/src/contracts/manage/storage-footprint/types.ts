/** 存储占用（GET /api/manage/system/storage-footprint；FASTWINS-A，V1 about.rs 对位）。 */

/** PG 单关系占用行。 */
export interface StorageRelationFootprint {
  relationName: string;
  /** table / index / materialized view 等。 */
  relationKind: string;
  totalSizeBytes: number;
  tableSizeBytes: number;
  indexSizeBytes: number;
  liveTuples: number;
  deadTuples: number;
}

/** PG 单设置项行（对位 V1 ManagePostgresSettingDto）。 */
export interface StorageSettingFootprint {
  name: string;
  setting: string;
  unit?: string | null;
  source: string;
}

/** PG 存储足迹组（`supported=false` 时整体缺席）。 */
export interface PostgresStorageFootprint {
  databaseSizeBytes: number;
  largestRelations: StorageRelationFootprint[];
  settings: StorageSettingFootprint[];
}

/**
 * 系统存储占用响应（snake_case wire 经 mapper 转 camelCase）。
 *
 * - `supported=false`（SQLite 后端）⇒ `postgres=null` 且 `reason` 说明——
 *   调用方按 reason 做减实缺口提示，**不区分**「未实现/旧后端」（后端口径）；
 * - `fileSearch` 恒 null（V2 无该子系统），原因并入 `reason`。
 */
export interface StorageFootprintResponse {
  /** postgres / sqlite。 */
  backend: string;
  supported: boolean;
  reason?: string | null;
  /** 生成时刻（UTC epoch ms）。 */
  generatedAt: number;
  postgres?: PostgresStorageFootprint | null;
  /** 恒 null（V2 未实现 file-search 子系统）。 */
  fileSearch?: unknown | null;
}

/** PG 关系种类 → 展示标签（未知值原样回显，勿造文案）。 */
export function storageRelationKindLabel(kind: string): string {
  switch ((kind ?? '').trim().toLowerCase()) {
    case 'table':
      return '表';
    case 'index':
      return '索引';
    case 'materialized view':
      return '物化视图';
    case 'view':
      return '视图';
    default:
      return kind || '未知';
  }
}
