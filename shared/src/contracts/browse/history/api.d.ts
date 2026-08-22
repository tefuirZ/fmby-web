import type { HistoryEntry, HistoryOverviewResponse } from './types';
export declare const historyApi: {
    getOverview(): Promise<HistoryOverviewResponse>;
    getContinueWatching(limit?: number): Promise<HistoryEntry[]>;
    getRecentlyPlayed(limit?: number): Promise<HistoryEntry[]>;
};
//# sourceMappingURL=api.d.ts.map