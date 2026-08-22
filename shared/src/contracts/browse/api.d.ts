import type { BrowseHomeData, BrowseHero, LibraryDetailResponse, LibrarySummary, MediaCardSummary } from './types';
interface LibraryDetailParams {
    page?: number;
    pageSize?: number;
    mediaType?: string;
    resolution?: string;
    watched?: string;
    sort?: string;
}
export declare const browseApi: {
    /** 单次请求获取首页首屏核心区块（hero + 最近添加 + 继续观看） */
    getHomeData(limits?: {
        hot?: number;
        recentlyAdded?: number;
        continueWatching?: number;
    }): Promise<BrowseHomeData>;
    /** @deprecated 请使用 getHomeData() */
    getHomeHero(): Promise<BrowseHero | null>;
    /** @deprecated 请使用 getHomeData() */
    getRecentlyAdded(limit?: number): Promise<MediaCardSummary[]>;
    /** @deprecated 请使用 getHomeData() */
    getContinueWatchingHome(limit?: number): Promise<MediaCardSummary[]>;
    getLibraries(): Promise<LibrarySummary[]>;
    getLibraryDetail(libraryId: string, params?: LibraryDetailParams): Promise<LibraryDetailResponse>;
};
export declare function mapMediaCard(raw: unknown): MediaCardSummary | null;
export {};
//# sourceMappingURL=api.d.ts.map