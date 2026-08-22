/**
 * @file Query APIs (Read Operations)
 * @description 全部读类 API (GET / list / detail / pipeline)
 */

import { httpClient } from '@/shared/api/client';
import type {
  ManageMediaItemDetailRecord,
  ManageMediaItemPipelineRecord,
  ManageMediaItemsQuery,
  ManageMediaItemsResponse,
} from '../types';
import { mapListRecord } from './mappers-record';
import { mapDetailRecord, mapPipelineRecord } from './mappers-metadata';
import { mapQueryParams } from './mappers-payload';
import type {
  RawListResponse,
  RawManageMediaItemDetailRecord,
  RawManageMediaItemListRecord,
  RawManageMediaItemPipelineRecord,
} from './types';

export const mediaItemsQueries = {
  /**
   * 获取媒体项列表（支持分页、筛选、排序）
   */
  async getMediaItems(query?: ManageMediaItemsQuery): Promise<ManageMediaItemsResponse> {
    const raw = await httpClient.get<RawListResponse<RawManageMediaItemListRecord>>(
      '/api/manage/media-items',
      {
        params: mapQueryParams(query),
      },
    );

    return {
      items: raw.items.map(mapListRecord),
      total: raw.total ?? 0,
    };
  },

  /**
   * 获取单个媒体项详细信息
   */
  async getMediaItemDetail(itemId: string): Promise<ManageMediaItemDetailRecord> {
    const raw = await httpClient.get<RawManageMediaItemDetailRecord>(
      `/api/manage/media-items/${itemId}`,
    );
    return mapDetailRecord(raw);
  },

  /**
   * 获取媒体项元数据流水线状态（识别任务、绑定关系、刮削任务）
   */
  async getMediaItemPipeline(itemId: string): Promise<ManageMediaItemPipelineRecord> {
    const raw = await httpClient.get<RawManageMediaItemPipelineRecord>(
      `/api/manage/media-items/${itemId}/pipeline`,
    );
    return mapPipelineRecord(raw);
  },
};
