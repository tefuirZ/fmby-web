import { httpClient } from '@/shared/api/client';
import { asRecord, readArray } from '@/shared/api/mapping';
import { mapMediaCard } from '@/domains/browse/api';
import type { HistoryEntry, HistoryOverviewResponse } from './types';

export const historyApi = {
  async getOverview(): Promise<HistoryOverviewResponse> {
    const items = await fetchHistoryItems(120);
    const continueWatching = items.filter((item) => Boolean(item.progress) && !item.progress?.completed);
    const continueIds = new Set(continueWatching.map((item) => item.id));
    const recentlyPlayed = items
      .filter((item) => !continueIds.has(item.id))
      .slice(0, 24);
    const recentIds = new Set([...continueIds, ...recentlyPlayed.map((item) => item.id)]);
    const completed = items.filter((item) => item.progress?.completed && !recentIds.has(item.id));

    return {
      continueWatching,
      recentlyPlayed,
      completed,
    };
  },

  async getContinueWatching(limit = 12): Promise<HistoryEntry[]> {
    const items = await fetchHistoryItems(Math.max(limit * 3, 24));
    return items
      .filter((item) => Boolean(item.progress) && !item.progress?.completed)
      .slice(0, limit);
  },

  async getRecentlyPlayed(limit = 12): Promise<HistoryEntry[]> {
    const items = await fetchHistoryItems(Math.max(limit * 2, 24));
    return items.slice(0, limit);
  },
};

function mapHistoryEntry(raw: unknown): HistoryEntry | null {
  const base = mapMediaCard(raw);
  if (!base) {
    return null;
  }

  const record = asRecord(raw);
  return {
    ...base,
    playedAt: typeof record.played_at === 'string' ? record.played_at : typeof record.playedAt === 'string' ? record.playedAt : base.lastPlayedAt,
    completedAt:
      typeof record.completed_at === 'string'
        ? record.completed_at
        : typeof record.completedAt === 'string'
          ? record.completedAt
          : undefined,
  };
}

async function fetchHistoryItems(limit: number) {
  const raw = await httpClient.get<unknown>('/api/browse/history', {
    params: { page: 1, pageSize: limit },
  });
  const record = asRecord(raw);
  const items = readArray(record.items ?? raw, mapHistoryEntry);
  return items.sort((left, right) => {
    const leftTime = new Date(left.completedAt ?? left.playedAt ?? left.lastPlayedAt ?? 0).getTime();
    const rightTime = new Date(right.completedAt ?? right.playedAt ?? right.lastPlayedAt ?? 0).getTime();
    return rightTime - leftTime;
  });
}
