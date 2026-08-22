/**
 * @file Simple Object Mappers
 * @description 简单对象映射（person / external-id / metadata / stream）
 */
import type { ManageMediaExternalId, ManageMediaItemMetadataRecord, ManageMediaPerson } from '../types';
import type { RawManageMediaExternalId, RawManageMediaItemMetadata, RawManageMediaPerson, RawManageProbeTaskStreamRecord } from './types';
export declare function mapMediaPerson(raw: RawManageMediaPerson): ManageMediaPerson;
export declare function mapExternalId(raw: RawManageMediaExternalId): ManageMediaExternalId;
export declare function mapMetadata(raw: RawManageMediaItemMetadata): ManageMediaItemMetadataRecord;
export declare function mapProbeStream(raw: RawManageProbeTaskStreamRecord): {
    index: number | undefined;
    codecName: string | undefined;
    codecTag: string | undefined;
    title: string | undefined;
    language: string | undefined;
    channels: number | undefined;
    channelLayout: string | undefined;
    width: number | undefined;
    height: number | undefined;
    profile: string | undefined;
    bitRate: number | undefined;
    bitDepth: number | undefined;
    pixelFormat: string | undefined;
    colorPrimaries: string | undefined;
    colorSpace: string | undefined;
    colorTransfer: string | undefined;
    aspectRatio: string | undefined;
    averageFrameRate: number | undefined;
    realFrameRate: number | undefined;
    dynamicRangeLabel: string | undefined;
    dvVersionMajor: number | undefined;
    dvVersionMinor: number | undefined;
    dvProfile: number | undefined;
    dvLevel: number | undefined;
    rpuPresentFlag: number | undefined;
    elPresentFlag: number | undefined;
    blPresentFlag: number | undefined;
    dvBlSignalCompatibilityId: number | undefined;
    hdr10PlusPresentFlag: boolean | undefined;
    isDefault: boolean;
    isForced: boolean;
};
//# sourceMappingURL=mappers-simple.d.ts.map