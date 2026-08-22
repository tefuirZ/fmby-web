export interface SearchTermsDocument {
    normalizedTexts: string[];
    compactAsciiTerms: string[];
    compactPinyinTerms: string[];
    compactInitialTerms: string[];
}
export declare class SearchTermsFactory {
    static fromOptionalFields(fields: Array<string | null | undefined>): SearchTermsDocument;
}
export declare function getCachedSearchTermsDocument(...fields: Array<string | null | undefined>): SearchTermsDocument;
export declare function normalizeKeyword(value: string): string;
export declare function normalizeAsciiCompact(value: string): string;
//# sourceMappingURL=searchTerms.d.ts.map