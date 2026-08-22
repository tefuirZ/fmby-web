/**
 * @file Media Items API
 * @description 统一导出所有 media-items 领域 API，保持外部 import 兼容性
 */

import { mediaItemsQueries } from './queries';
import { mediaItemsMutations } from './mutations';

export { mediaItemsQueries, mediaItemsMutations };

/**
 * 统一 API 对象，保持与原 api.ts 完全兼容
 */
export const mediaItemsApi = {
  // 查询类 API
  getMediaItems: mediaItemsQueries.getMediaItems,
  getMediaItemDetail: mediaItemsQueries.getMediaItemDetail,
  getMediaItemPipeline: mediaItemsQueries.getMediaItemPipeline,

  // 写入类 API
  updateMediaItemMetadata: mediaItemsMutations.updateMediaItemMetadata,
  resetMediaItemMetadata: mediaItemsMutations.resetMediaItemMetadata,
  refreshMediaItemMetadata: mediaItemsMutations.refreshMediaItemMetadata,
  uploadMediaItemArtwork: mediaItemsMutations.uploadMediaItemArtwork,
  deleteMediaItemArtwork: mediaItemsMutations.deleteMediaItemArtwork,
  uploadMediaItemSubtitle: mediaItemsMutations.uploadMediaItemSubtitle,
  updateMediaItemSubtitle: mediaItemsMutations.updateMediaItemSubtitle,
  deleteMediaItemSubtitle: mediaItemsMutations.deleteMediaItemSubtitle,
  deleteMediaItemSource: mediaItemsMutations.deleteMediaItemSource,
  scanMediaItem: mediaItemsMutations.scanMediaItem,
  enqueueMediaItemScrape: mediaItemsMutations.enqueueMediaItemScrape,
};

// 重新导出内部类型和映射函数（供其他 domain 使用）
export type * from './types';
export * from './mappers-enum';
export * from './mappers-simple';
export * from './mappers-record';
export * from './mappers-metadata';
export * from './mappers-payload';
