import { httpClient } from '@fmby/v2-shared/api/client';
import {
  fromCollection,
  fromDetail,
  type ManagedCollectionDetailRecord,
  type ManagedCollectionRecord,
  type RawManagedCollection,
  type RawManagedCollectionDetail,
} from '@fmby/v2-shared/contracts/manage/peripherals';

/**
 * 用户面合集读面（后端 USER-COLLECTIONS-SURFACE-BE / USER-COLLECTIONS-LIST-BE 信封）。
 *
 * ponytail：与 manage 面**同 DTO**，仅路径与门不同（session + BROWSE；Active 可见性闸）。
 * 复用 manage 的 `fromCollection` / `fromDetail` mapper，零重复映射、零新类型、零新依赖。
 */

/** 后端 `CollectionsListResponse`（`GET /api/collections`，USER-COLLECTIONS-LIST-BE）。 */
export interface RawCollectionsListResponse {
  items: RawManagedCollection[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

/** 用户面合集列表页视图记录（snake→camel 已映射）。 */
export interface CollectionsListPageRecord {
  items: ManagedCollectionRecord[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/** 列表分页参数（后端缺省 page=1 / pageSize=20 clamp[1,200]）。 */
export interface CollectionsListParams {
  page?: number;
  pageSize?: number;
  /**
   * 检索（FE-COLLECTIONS-SEARCH-INPUT）：后端主名 `search`（alias q/searchTerm），
   * 语义 = trim+lowercase 标题子串，在 Active 可见性闸之后应用；空白/缺省 = 全量。
   */
  search?: string;
}

export const collectionsBrowseApi = {
  async getCollection(id: string): Promise<ManagedCollectionDetailRecord> {
    const raw = await httpClient.get<RawManagedCollectionDetail>(
      `/api/collections/${encodeURIComponent(id)}`,
    );
    return fromDetail(raw);
  },

  /**
   * 用户面合集列表：`GET /api/collections`（USER-COLLECTIONS-LIST-BE）。
   * 可见性闸由后端保证（Hidden 不出现）；检索参数暂无（COLLECTIONS-LIST-SEARCH 在途）。
   */
  async listCollections(params: CollectionsListParams = {}): Promise<CollectionsListPageRecord> {
    const trimmedSearch = params.search?.trim() ?? '';
    const raw = await httpClient.get<RawCollectionsListResponse>('/api/collections', {
      params: {
        page: params.page,
        pageSize: params.pageSize,
        // 空白不传（后端 trim 空白 = 全量，等价缺省）；特殊字符交 URLSearchParams 转义。
        search: trimmedSearch === '' ? undefined : trimmedSearch,
      },
    });
    return {
      items: raw.items.map(fromCollection),
      total: raw.total,
      page: raw.page,
      pageSize: raw.page_size,
      hasMore: raw.has_more,
    };
  },
};