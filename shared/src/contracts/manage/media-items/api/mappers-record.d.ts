/**
 * @file Media Item Record Mappers
 * @description 媒体项核心记录映射（list / summary / source / asset / artwork / subtitle）
 */
import type { ManageMediaItemArtworkOverrideRecord, ManageMediaItemListRecord, ManageMediaItemRemoteAssetRecord, ManageMediaItemScrapedArtworkRecord, ManageMediaItemSourceRecord, ManageMediaItemSubtitleOverrideRecord, ManageMediaItemSummaryRecord } from '../types';
import type { RawManageMediaItemArtworkOverrideRecord, RawManageMediaItemListRecord, RawManageMediaItemRemoteAssetRecord, RawManageMediaItemScrapedArtworkRecord, RawManageMediaItemSourceRecord, RawManageMediaItemSubtitleOverrideRecord, RawManageMediaItemSummaryRecord } from './types';
export declare function mapListRecord(raw: RawManageMediaItemListRecord): ManageMediaItemListRecord;
export declare function mapSummaryRecord(raw: RawManageMediaItemSummaryRecord): ManageMediaItemSummaryRecord;
export declare function mapSourceRecord(raw: RawManageMediaItemSourceRecord): ManageMediaItemSourceRecord;
export declare function mapRemoteAssetRecord(raw: RawManageMediaItemRemoteAssetRecord): ManageMediaItemRemoteAssetRecord;
export declare function mapArtworkOverrideRecord(raw: RawManageMediaItemArtworkOverrideRecord): ManageMediaItemArtworkOverrideRecord;
export declare function mapScrapedArtworkRecord(raw: RawManageMediaItemScrapedArtworkRecord): ManageMediaItemScrapedArtworkRecord;
export declare function mapSubtitleOverrideRecord(raw: RawManageMediaItemSubtitleOverrideRecord): ManageMediaItemSubtitleOverrideRecord;
//# sourceMappingURL=mappers-record.d.ts.map