import type { MediaCardSummary } from '../types';

export interface HistoryEntry extends MediaCardSummary {
  playedAt?: string;
  completedAt?: string;
}

export interface HistoryOverviewResponse {
  continueWatching: HistoryEntry[];
  recentlyPlayed: HistoryEntry[];
  completed: HistoryEntry[];
}
