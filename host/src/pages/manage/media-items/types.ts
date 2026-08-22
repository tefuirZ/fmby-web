import type {
  ManageMediaItemMediaType,
  ManageMediaItemSourceStatus,
  ManageMediaItemMetadataStatus,
} from '@fmby/v2-shared/contracts/manage/media-items';

export type MediaTypeFilter = 'all' | ManageMediaItemMediaType;
export type SourceStatusFilter = 'all' | ManageMediaItemSourceStatus;
export type MetadataStatusFilter = 'all' | ManageMediaItemMetadataStatus;
export type OverrideFilter = 'all' | 'only' | 'none';

export interface PendingSourceDeleteState {
  itemId: string;
  itemTitle: string;
  sourceId: string;
  mountName: string;
  filePath: string;
  sourceStatus: ManageMediaItemSourceStatus;
}
