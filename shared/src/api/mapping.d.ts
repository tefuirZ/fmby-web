export type UnknownRecord = Record<string, unknown>;
export declare function asRecord(value: unknown): UnknownRecord;
export declare function readString(...values: unknown[]): string | undefined;
export declare function readNumber(...values: unknown[]): number | undefined;
export declare function readBoolean(...values: unknown[]): boolean | undefined;
export declare function readStringArray(value: unknown): string[];
export declare function readArray<T>(value: unknown, mapItem: (item: unknown) => T | null | undefined): T[];
export declare function ticksToSeconds(value: unknown): number | undefined;
export declare function clampProgress(value: number | undefined): number;
//# sourceMappingURL=mapping.d.ts.map