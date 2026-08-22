/**
 * @file Mutation APIs (Write Operations)
 * @description 全部写类 API (POST / PATCH / DELETE / upload / refresh / scan / scrape)
 */

import { httpClient } from '@/shared/api/client';
import { mapDangerousActionPayloadToApi } from '../../mapping';
import type { DangerousActionRequest, ManageActionResult } from '../../types';
import type {
  ManageMediaItemDetailRecord,
  RequestManageMediaItemScrapeOptions,
  RequestManageMediaItemScrapeResult,
  UpdateManageMediaItemMetadataRequest,
  UpdateManageMediaItemSubtitleOverrideRequest,
  UploadManageMediaItemArtworkRequest,
  UploadManageMediaItemSubtitleRequest,
} from '../types';
import { assertArtworkKind } from './mappers-enum';
import { mapDetailRecord, mapScrapeResponse } from './mappers-metadata';
import {
  buildArtworkUploadFormData,
  buildSubtitleUploadFormData,
  mapSubtitleUpdatePayloadToApi,
  mapUpdatePayloadToApi,
} from './mappers-payload';
import type {
  RawManageMediaItemDetailRecord,
  RawRequestManageMediaItemScrapeResponse,
} from './types';

export const mediaItemsMutations = {
  // ========== Metadata Mutations ==========

  /**
   * 更新媒体项元数据（本地覆盖）
   */
  async updateMediaItemMetadata(
    itemId: string,
    payload: UpdateManageMediaItemMetadataRequest,
  ): Promise<ManageMediaItemDetailRecord> {
    const raw = await httpClient.patch<RawManageMediaItemDetailRecord>(
      `/api/manage/media-items/${itemId}/metadata`,
      {
        body: mapUpdatePayloadToApi(payload),
      },
    );
    return mapDetailRecord(raw);
  },

  /**
   * 重置媒体项元数据（删除本地覆盖）
   */
  async resetMediaItemMetadata(
    itemId: string,
    payload: DangerousActionRequest = {
      confirmAction: 'reset-media-item-metadata',
    },
  ): Promise<ManageActionResult> {
    return httpClient.post<{ id: string; result: string; message: string }>(
      `/api/manage/media-items/${itemId}/metadata/reset`,
      {
        body: mapDangerousActionPayloadToApi(payload),
      },
    );
  },

  /**
   * 刷新媒体项元数据（重新读取远程源）
   */
  async refreshMediaItemMetadata(itemId: string): Promise<ManageMediaItemDetailRecord> {
    const raw = await httpClient.post<RawManageMediaItemDetailRecord>(
      `/api/manage/media-items/${itemId}/refresh-metadata`,
    );
    return mapDetailRecord(raw);
  },

  // ========== Artwork Mutations ==========

  /**
   * 上传媒体项封面/背景/缩略图
   */
  async uploadMediaItemArtwork(
    itemId: string,
    payload: UploadManageMediaItemArtworkRequest,
  ): Promise<ManageMediaItemDetailRecord> {
    const raw = await httpClient.post<RawManageMediaItemDetailRecord>(
      `/api/manage/media-items/${itemId}/artwork`,
      {
        body: buildArtworkUploadFormData({
          ...payload,
          artworkKind: assertArtworkKind(payload.artworkKind),
        }),
      },
    );
    return mapDetailRecord(raw);
  },

  /**
   * 删除媒体项自定义封面/背景/缩略图
   */
  async deleteMediaItemArtwork(
    itemId: string,
    overrideId: string,
    payload: DangerousActionRequest = {
      confirmAction: 'delete-media-item-artwork',
    },
  ): Promise<ManageActionResult> {
    return httpClient.delete<ManageActionResult>(
      `/api/manage/media-items/${itemId}/artwork/${overrideId}`,
      {
        body: mapDangerousActionPayloadToApi(payload),
      },
    );
  },

  // ========== Subtitle Mutations ==========

  /**
   * 上传媒体项字幕
   */
  async uploadMediaItemSubtitle(
    itemId: string,
    payload: UploadManageMediaItemSubtitleRequest,
  ): Promise<ManageMediaItemDetailRecord> {
    const raw = await httpClient.post<RawManageMediaItemDetailRecord>(
      `/api/manage/media-items/${itemId}/subtitles`,
      {
        body: buildSubtitleUploadFormData(payload),
      },
    );
    return mapDetailRecord(raw);
  },

  /**
   * 更新媒体项字幕设置（激活状态、默认、排序等）
   */
  async updateMediaItemSubtitle(
    itemId: string,
    overrideId: string,
    payload: UpdateManageMediaItemSubtitleOverrideRequest,
  ): Promise<ManageMediaItemDetailRecord> {
    const raw = await httpClient.patch<RawManageMediaItemDetailRecord>(
      `/api/manage/media-items/${itemId}/subtitles/${overrideId}`,
      {
        body: mapSubtitleUpdatePayloadToApi(payload),
      },
    );
    return mapDetailRecord(raw);
  },

  /**
   * 删除媒体项字幕
   */
  async deleteMediaItemSubtitle(
    itemId: string,
    overrideId: string,
    payload: DangerousActionRequest = {
      confirmAction: 'delete-media-item-subtitle',
    },
  ): Promise<ManageActionResult> {
    return httpClient.delete<ManageActionResult>(
      `/api/manage/media-items/${itemId}/subtitles/${overrideId}`,
      {
        body: mapDangerousActionPayloadToApi(payload),
      },
    );
  },

  // ========== Source Mutations ==========

  /**
   * 删除媒体项的某个源文件绑定
   */
  async deleteMediaItemSource(
    itemId: string,
    sourceId: string,
    payload: DangerousActionRequest = {
      confirmAction: 'delete-media-item-source',
    },
  ): Promise<ManageActionResult> {
    return httpClient.delete<ManageActionResult>(
      `/api/manage/media-items/${itemId}/sources/${sourceId}`,
      {
        body: mapDangerousActionPayloadToApi(payload),
      },
    );
  },

  // ========== Action Mutations ==========

  /**
   * 扫描单个媒体项（重新扫描文件、元数据等）
   */
  async scanMediaItem(itemId: string): Promise<ManageActionResult> {
    return httpClient.post<ManageActionResult>(`/api/manage/media-items/${itemId}/scan`);
  },

  /**
   * 请求刮削媒体项元数据（加入刮削队列）
   */
  async enqueueMediaItemScrape(
    itemId: string,
    options: RequestManageMediaItemScrapeOptions = {},
  ): Promise<RequestManageMediaItemScrapeResult> {
    const force = options.force === true;
    const path = force
      ? `/api/manage/media-items/${itemId}/scrape/refresh`
      : `/api/manage/media-items/${itemId}/scrape`;
    const body: { reason?: string; force?: boolean } = {};
    if (options.reason !== undefined) {
      body.reason = options.reason;
    }
    body.force = force;
    const raw = await httpClient.post<RawRequestManageMediaItemScrapeResponse>(path, {
      body,
    });
    return mapScrapeResponse(raw);
  },
};
