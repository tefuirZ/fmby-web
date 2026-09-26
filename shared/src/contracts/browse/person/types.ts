import type { MediaCardSummary } from '../types';

/**
 * 人物详情视图类型（V1F-10）。
 *
 * 字段只取 V2 真值持有者（`catalog_person` 的 id/name/poster_key + 关联作品数）。
 * **不定义** provider/overview/生日等 V2 无数据源的字段——诚实窄优于假字段
 * （后端 `PersonDetailDto` 同口径）。
 */
export interface PersonDetail {
  id: string;
  name: string;
  /** 头像 asset 键（可空）；前端据此拼 `/api/assets/{key}`。 */
  posterUrl?: string;
  /** 关联作品数（真值）。 */
  itemCount: number;
}

/** 人物作品单页（单页硬上限，无 keyset 游标）。 */
export interface PersonItemsPage {
  items: MediaCardSummary[];
  total: number;
  /** 是否被硬上限截断（后端当前单页取完，恒 false；保留语义供后续 keyset 端口）。 */
  hasMore: boolean;
}
