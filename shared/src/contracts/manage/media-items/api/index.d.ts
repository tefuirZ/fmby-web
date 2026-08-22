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
export declare const mediaItemsApi: {
    getMediaItems: (query?: import("..").ManageMediaItemsQuery) => Promise<import("..").ManageMediaItemsResponse>;
    getMediaItemDetail: (itemId: string) => Promise<import("..").ManageMediaItemDetailRecord>;
    getMediaItemPipeline: (itemId: string) => Promise<import("..").ManageMediaItemPipelineRecord>;
    updateMediaItemMetadata: (itemId: string, payload: import("..").UpdateManageMediaItemMetadataRequest) => Promise<import("..").ManageMediaItemDetailRecord>;
    resetMediaItemMetadata: (itemId: string, payload?: import("../..").DangerousActionRequest) => Promise<import("../..").ManageActionResult>;
    refreshMediaItemMetadata: (itemId: string) => Promise<import("..").ManageMediaItemDetailRecord>;
    uploadMediaItemArtwork: (itemId: string, payload: import("..").UploadManageMediaItemArtworkRequest) => Promise<import("..").ManageMediaItemDetailRecord>;
    deleteMediaItemArtwork: (itemId: string, overrideId: string, payload?: import("../..").DangerousActionRequest) => Promise<import("../..").ManageActionResult>;
    uploadMediaItemSubtitle: (itemId: string, payload: import("..").UploadManageMediaItemSubtitleRequest) => Promise<import("..").ManageMediaItemDetailRecord>;
    updateMediaItemSubtitle: (itemId: string, overrideId: string, payload: import("..").UpdateManageMediaItemSubtitleOverrideRequest) => Promise<import("..").ManageMediaItemDetailRecord>;
    deleteMediaItemSubtitle: (itemId: string, overrideId: string, payload?: import("../..").DangerousActionRequest) => Promise<import("../..").ManageActionResult>;
    deleteMediaItemSource: (itemId: string, sourceId: string, payload?: import("../..").DangerousActionRequest) => Promise<import("../..").ManageActionResult>;
    scanMediaItem: (itemId: string) => Promise<import("../..").ManageActionResult>;
    enqueueMediaItemScrape: (itemId: string, options?: import("..").RequestManageMediaItemScrapeOptions) => Promise<import("..").RequestManageMediaItemScrapeResult>;
};
export type * from './types';
export * from './mappers-enum';
export * from './mappers-simple';
export * from './mappers-record';
export * from './mappers-metadata';
export * from './mappers-payload';
//# sourceMappingURL=index.d.ts.map