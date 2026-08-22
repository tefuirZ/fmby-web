import type { ItemDetailResponse } from '@fmby/v2-shared/contracts/browse/item';

export type StreamInfo = ItemDetailResponse['technical']['videoStreams'][number];
export type StreamType = 'video' | 'audio' | 'subtitle';

export interface TechnicalCard {
  label: string;
  value: string;
  hint?: string;
}
