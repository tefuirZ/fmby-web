import type { ManageLibraryRecord, ManageLibraryType } from '@/domains/manage';

export type LibraryHealthStatus = 'healthy' | 'attention' | 'critical';
export type LibraryDrawerMode = 'create' | 'view' | 'edit';

export interface LibraryDrawerState {
  mode: LibraryDrawerMode;
  libraryId?: string;
}

export interface LibraryFormState {
  name: string;
  libraryType: ManageLibraryType;
  description: string;
  sourceBindings: Array<{
    id?: string;
    mountId: string;
    subPath: string;
    scanPriority: number;
  }>;
  grantUserIds: string[];
}

export interface PendingLibraryDeleteState {
  library: ManageLibraryRecord;
  sourceBindingCount: number;
  accessGrantCount?: number;
}

export const LIBRARY_TYPE_OPTIONS: Array<{ value: ManageLibraryType; label: string }> = [
  { value: 'movie', label: '电影' },
  { value: 'series', label: '剧集' },
  { value: 'music', label: '音乐' },
  { value: 'mixed', label: '混合' },
];
