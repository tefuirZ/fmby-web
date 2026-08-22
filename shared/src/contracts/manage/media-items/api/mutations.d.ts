/**
 * @file Mutation APIs (Write Operations)
 * @description 全部写类 API (POST / PATCH / DELETE / upload / refresh / scan / scrape)
 */
import type { DangerousActionRequest, ManageActionResult } from '../../types';
import type { ManageMediaItemDetailRecord, RequestManageMediaItemScrapeOptions, RequestManageMediaItemScrapeResult, UpdateManageMediaItemMetadataRequest, UpdateManageMediaItemSubtitleOverrideRequest, UploadManageMediaItemArtworkRequest, UploadManageMediaItemSubtitleRequest } from '../types';
export declare const mediaItemsMutations: {
    /**
     * 更新媒体项元数据（本地覆盖）
     */
    updateMediaItemMetadata(itemId: string, payload: UpdateManageMediaItemMetadataRequest): Promise<ManageMediaItemDetailRecord>;
    /**
     * 重置媒体项元数据（删除本地覆盖）
     */
    resetMediaItemMetadata(itemId: string, payload?: DangerousActionRequest): Promise<ManageActionResult>;
    /**
     * 刷新媒体项元数据（重新读取远程源）
     */
    refreshMediaItemMetadata(itemId: string): Promise<ManageMediaItemDetailRecord>;
    /**
     * 上传媒体项封面/背景/缩略图
     */
    uploadMediaItemArtwork(itemId: string, payload: UploadManageMediaItemArtworkRequest): Promise<ManageMediaItemDetailRecord>;
    /**
     * 删除媒体项自定义封面/背景/缩略图
     */
    deleteMediaItemArtwork(itemId: string, overrideId: string, payload?: DangerousActionRequest): Promise<ManageActionResult>;
    /**
     * 上传媒体项字幕
     */
    uploadMediaItemSubtitle(itemId: string, payload: UploadManageMediaItemSubtitleRequest): Promise<ManageMediaItemDetailRecord>;
    /**
     * 更新媒体项字幕设置（激活状态、默认、排序等）
     */
    updateMediaItemSubtitle(itemId: string, overrideId: string, payload: UpdateManageMediaItemSubtitleOverrideRequest): Promise<ManageMediaItemDetailRecord>;
    /**
     * 删除媒体项字幕
     */
    deleteMediaItemSubtitle(itemId: string, overrideId: string, payload?: DangerousActionRequest): Promise<ManageActionResult>;
    /**
     * 删除媒体项的某个源文件绑定
     */
    deleteMediaItemSource(itemId: string, sourceId: string, payload?: DangerousActionRequest): Promise<ManageActionResult>;
    /**
     * 扫描单个媒体项（重新扫描文件、元数据等）
     */
    scanMediaItem(itemId: string): Promise<ManageActionResult>;
    /**
     * 请求刮削媒体项元数据（加入刮削队列）
     */
    enqueueMediaItemScrape(itemId: string, options?: RequestManageMediaItemScrapeOptions): Promise<RequestManageMediaItemScrapeResult>;
};
//# sourceMappingURL=mutations.d.ts.map