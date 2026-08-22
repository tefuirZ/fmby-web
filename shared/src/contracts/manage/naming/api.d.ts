import type { NamingCleanupPreviewRequest, NamingCleanupPreviewResponse, NamingCleanupReplayIdentifyRequest, NamingCleanupReplayIdentifyResponse, NamingScrapeBatchRepairRequest, NamingScrapeBatchRepairResponse, NamingScrapeSettings, NamingCleanupSettings, UpdateNamingScrapeSettingsRequest, UpdateNamingCleanupSettingsRequest } from './types';
export declare const namingCleanupApi: {
    getScrapeSettings(): Promise<NamingScrapeSettings>;
    updateScrapeSettings(payload: UpdateNamingScrapeSettingsRequest): Promise<NamingScrapeSettings>;
    getSettings(): Promise<NamingCleanupSettings>;
    updateSettings(payload: UpdateNamingCleanupSettingsRequest): Promise<NamingCleanupSettings>;
    preview(payload: NamingCleanupPreviewRequest): Promise<NamingCleanupPreviewResponse>;
    replayIdentify(payload: NamingCleanupReplayIdentifyRequest): Promise<NamingCleanupReplayIdentifyResponse>;
    batchRepair(payload: NamingScrapeBatchRepairRequest): Promise<NamingScrapeBatchRepairResponse>;
};
//# sourceMappingURL=api.d.ts.map