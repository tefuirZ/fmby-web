import type { ItemDetailResponse } from '@/domains/item';

export type StreamInfo = ItemDetailResponse['technical']['videoStreams'][number];
export type StreamType = 'video' | 'audio' | 'subtitle';

export interface TechnicalCard {
  label: string;
  value: string;
  hint?: string;
}
