import type { ManageMountDetailRecord } from "../types";
import type { RawManagedMountDetailResponse, RawManagedMountRecord } from "../raw-types";
export declare function mapManagedMountRecord(raw: RawManagedMountRecord): {
    id: string;
    name: string;
    mountType: import("..").ManageMountProviderType;
    typeLabel: string;
    path: string;
    pathLabel: string;
    healthStatus: "critical" | "healthy" | "attention";
    description: string | undefined;
    statusMessage: string | undefined;
    lastCheckedAt: string | undefined;
    capabilities: string[];
    linkedLibraries: {
        id: string;
        name: string;
    }[];
    referenceCounts: {
        librarySourceCount: number;
        mediaSourceCount: number;
        sidecarAssetCount: number;
    };
    unavailableBindingCount: number;
};
export declare function mapManagedMountDetailResponse(raw: RawManagedMountDetailResponse): ManageMountDetailRecord;
//# sourceMappingURL=mounts.d.ts.map