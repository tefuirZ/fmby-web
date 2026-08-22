import type { MediaCardSummary } from '@fmby/v2-shared/contracts/browse';
export interface HistoryEntry extends MediaCardSummary {
    playedAt?: string;
    completedAt?: string;
}
export interface HistoryOverviewResponse {
    continueWatching: HistoryEntry[];
    recentlyPlayed: HistoryEntry[];
    completed: HistoryEntry[];
}
//# sourceMappingURL=types.d.ts.map