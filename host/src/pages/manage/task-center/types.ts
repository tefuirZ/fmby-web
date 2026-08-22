import type { TaskCenterCategory } from '@fmby/v2-shared/contracts/manage/task-center';

export interface SelectedTaskRef {
  category: TaskCenterCategory;
  id: string;
}

export interface FlashState {
  title: string;
  description: string;
}

export type RangePreset = 'all' | 'today' | '7d' | '30d';
