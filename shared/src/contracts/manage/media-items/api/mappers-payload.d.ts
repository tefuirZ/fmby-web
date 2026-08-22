/**
 * @file ToApi Mappers (Payload Builders)
 * @description 领域模型 → API 请求体映射（query params / form data / request body）
 */
import type { ManageMediaItemsQuery, UpdateManageMediaItemMetadataRequest, UpdateManageMediaItemSubtitleOverrideRequest, UploadManageMediaItemArtworkRequest, UploadManageMediaItemSubtitleRequest } from '../types';
export declare function mapQueryParams(query?: ManageMediaItemsQuery): {
    page: number | undefined;
    pageSize: number | undefined;
    keyword: string | undefined;
    libraryId: string | undefined;
    mediaType: string | undefined;
    sourceStatus: string | undefined;
    mountStatus: "active" | "disabled" | "unreachable" | undefined;
    metadataStatus: string | undefined;
    hasLocalOverride: boolean | undefined;
    hasPoster: boolean | undefined;
    hasSubtitle: boolean | undefined;
    sortBy: string | undefined;
    sortOrder: import("..").ManageMediaItemSortOrder | undefined;
} | undefined;
export declare function mapUpdatePayloadToApi(payload: UpdateManageMediaItemMetadataRequest): {
    title: string | undefined;
    original_title: string | undefined;
    sort_title: string | undefined;
    year: number | undefined;
    overview: string | undefined;
    community_rating: number | undefined;
    genres: string[] | undefined;
    directors: string[] | undefined;
    actors: {
        name: string;
        role: string | undefined;
        thumb_url: string | undefined;
        profile: string | undefined;
    }[] | undefined;
    studios: string[] | undefined;
    premiered: string | undefined;
};
export declare function buildArtworkUploadFormData(payload: UploadManageMediaItemArtworkRequest): FormData;
export declare function buildSubtitleUploadFormData(payload: UploadManageMediaItemSubtitleRequest): FormData;
export declare function mapSubtitleUpdatePayloadToApi(payload: UpdateManageMediaItemSubtitleOverrideRequest): {
    language: string | undefined;
    is_active: boolean | undefined;
    is_default: boolean | undefined;
    sort_order: number | undefined;
};
//# sourceMappingURL=mappers-payload.d.ts.map