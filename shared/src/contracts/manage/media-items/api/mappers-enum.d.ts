/**
 * @file Enum & Status Mappers
 * @description 枚举类型、状态字段映射
 */
import type { ManageMediaItemArtworkKind, ManageMediaItemMediaType, ManageMediaItemMetadataSourceType, ManageMediaItemMetadataStatus, ManageMediaItemMountStatus, ManageMediaItemSourceStatus } from '../types';
export declare function mapMediaType(raw?: string | null): ManageMediaItemMediaType;
export declare function mapSourceStatus(raw?: string | null): ManageMediaItemSourceStatus;
export declare function mapMountStatus(raw?: string | null): ManageMediaItemMountStatus;
export declare function mapMetadataStatus(raw?: string | null): ManageMediaItemMetadataStatus;
export declare function mapMetadataSourceType(raw?: string | null): ManageMediaItemMetadataSourceType;
export declare function assertArtworkKind(value: string): ManageMediaItemArtworkKind;
export declare function mapMediaTypeToApi(value: ManageMediaItemMediaType): "movie" | "series" | "episode" | "season" | "music" | "unknown" | "music_album" | "music_artist";
export declare function mapSourceStatusToApi(value: ManageMediaItemSourceStatus): "playable" | "unreachable" | "unsupported" | "pending_validation" | "auth_expired" | undefined;
export declare function mapMountStatusToApi(value: ManageMediaItemMountStatus): "active" | "disabled" | "unreachable" | undefined;
export declare function mapMetadataStatusToApi(value: ManageMediaItemMetadataStatus): "success" | "pending" | "failed" | "missing";
//# sourceMappingURL=mappers-enum.d.ts.map