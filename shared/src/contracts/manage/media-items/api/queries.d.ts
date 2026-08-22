/**
 * @file Query APIs (Read Operations)
 * @description 全部读类 API (GET / list / detail / pipeline)
 */
import type { ManageMediaItemDetailRecord, ManageMediaItemPipelineRecord, ManageMediaItemsQuery, ManageMediaItemsResponse } from '../types';
export declare const mediaItemsQueries: {
    /**
     * 获取媒体项列表（支持分页、筛选、排序）
     */
    getMediaItems(query?: ManageMediaItemsQuery): Promise<ManageMediaItemsResponse>;
    /**
     * 获取单个媒体项详细信息
     */
    getMediaItemDetail(itemId: string): Promise<ManageMediaItemDetailRecord>;
    /**
     * 获取媒体项元数据流水线状态（识别任务、绑定关系、刮削任务）
     */
    getMediaItemPipeline(itemId: string): Promise<ManageMediaItemPipelineRecord>;
};
//# sourceMappingURL=queries.d.ts.map