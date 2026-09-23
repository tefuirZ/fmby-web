import type { ManageScanTriggerResult } from "../types";
import type { RawManageLibraryScanTriggerResponse, RawManagedScanTaskRecord } from "../raw-types";
export declare function mapManagedScanTaskRecord(raw: RawManagedScanTaskRecord): {
    id: string;
    librarySourceId: string;
    libraryId: string;
    libraryName: string;
    mountId: string;
    mountName: string;
    sourcePath: string;
    taskType: "full-scan" | "incremental-refresh" | "manual-refresh";
    status: "pending" | "running" | "completed" | "failed";
    itemsFound: number;
    itemsUpdated: number;
    errorMessage: string | undefined;
    startedAt: string | undefined;
    completedAt: string | undefined;
    createdAt: string;
};
export declare function mapManageScanTriggerResponse(raw: RawManageLibraryScanTriggerResponse): ManageScanTriggerResult;
//# sourceMappingURL=scans.d.ts.map