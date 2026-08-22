import type { Pan115ImghostActivateRequest, Pan115ImghostAssetListResponse, Pan115ImghostCredentials, Pan115ImghostQrLoginRequest, Pan115ImghostQrLoginResponse, Pan115ImghostQrStatusResponse, Pan115ImghostUploadResponse } from './types';
export declare const pan115ImghostApi: {
    startQrLogin(req?: Pan115ImghostQrLoginRequest): Promise<Pan115ImghostQrLoginResponse>;
    pollQrStatus(sessionId: string): Promise<Pan115ImghostQrStatusResponse>;
    activate(req: Pan115ImghostActivateRequest): Promise<{
        ok: boolean;
    }>;
    getCredentials(): Promise<Pan115ImghostCredentials>;
    deleteCredentials(): Promise<{
        ok: boolean;
    }>;
    /**
     * 上传图片（支持进度回调）。
     * 若传入 onProgress，内部使用 XHR 实现实时进度；否则退化到 httpClient.post。
     */
    uploadAsset(file: File, mode?: "permanent" | "oneshot", onProgress?: (pct: number) => void): Promise<Pan115ImghostUploadResponse>;
    listAssets(page?: number, pageSize?: number): Promise<Pan115ImghostAssetListResponse>;
};
//# sourceMappingURL=api.d.ts.map