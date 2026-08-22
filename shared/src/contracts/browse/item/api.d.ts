import type { MediaCardSummary } from '@fmby/v2-shared/contracts/browse';
import type { ItemDetailResponse } from './types';
export declare const itemApi: {
    getDetail(itemId: string): Promise<ItemDetailResponse>;
    getDescendants(itemId: string, limit?: number): Promise<MediaCardSummary[]>;
};
//# sourceMappingURL=api.d.ts.map