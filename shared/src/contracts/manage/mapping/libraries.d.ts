import type { ManageLibraryDetailRecord } from "../types";
import type { RawManagedLibraryDetailResponse, RawManagedLibraryRecord } from "../raw-types";
export declare function mapManagedLibraryRecord(raw: RawManagedLibraryRecord): {
    id: string;
    name: string;
    libraryType: "movie" | "series" | "music" | "mixed";
    typeLabel: string;
    description: string | undefined;
    itemCount: number;
    status: "critical" | "healthy" | "attention";
    visibilityLabel: string | undefined;
    updatedAt: string;
    lastScanAt: string | undefined;
    sourceNames: string[];
    actualSourceNames: string[];
};
export declare function mapManagedLibraryDetailResponse(raw: RawManagedLibraryDetailResponse): ManageLibraryDetailRecord;
//# sourceMappingURL=libraries.d.ts.map