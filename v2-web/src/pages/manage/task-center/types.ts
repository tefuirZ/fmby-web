import type { TaskCenterCategory } from '@/domains/manage/task-center';

export interface SelectedTaskRef {
  category: TaskCenterCategory;
  id: string;
}

export interface FlashState {
  title: string;
  description: string;
}

export type RangePreset = 'all' | 'today' | '7d' | '30d';
