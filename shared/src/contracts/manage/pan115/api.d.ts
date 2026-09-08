import type { Pan115AccountInfo, Pan115BrowseResponse, Pan115ActivateRequest, Pan115ActivateResponse, Pan115HealthReport, Pan115QrLoginRequest, Pan115QrLoginResponse, Pan115QrStatusResponse } from "./types";
export declare const pan115Api: {
    startQrLogin(req?: Pan115QrLoginRequest): Promise<Pan115QrLoginResponse>;
    pollQrStatus(sessionId: string): Promise<Pan115QrStatusResponse>;
    activate(req: Pan115ActivateRequest): Promise<Pan115ActivateResponse>;
    getAccount(mountId: string): Promise<Pan115AccountInfo>;
    refreshOpenToken(mountId: string): Promise<void>;
    healthCheck(mountId: string): Promise<Pan115HealthReport>;
    browseDirectory(mountId: string, path?: string, offset?: number, limit?: number): Promise<Pan115BrowseResponse>;
    unbind(mountId: string): Promise<void>;
};
//# sourceMappingURL=api.d.ts.map