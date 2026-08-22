export interface ArtworkSet {
    bannerUrl?: string;
    posterUrl?: string;
    backdropUrl?: string;
    thumbUrl?: string;
    logoUrl?: string;
}
export declare function buildItemArtworkUrl(itemId: string, kind: 'banner' | 'poster' | 'backdrop' | 'thumb' | 'logo'): string;
export declare function buildLibraryArtworkUrl(libraryId: string, kind: 'banner' | 'poster' | 'backdrop' | 'thumb' | 'logo'): string;
export declare function mapArtwork(value: unknown, options?: {
    itemId?: string;
    libraryId?: string;
    fallbackItemUrls?: boolean;
    fallbackLibraryUrls?: boolean;
}): ArtworkSet;
//# sourceMappingURL=index.d.ts.map