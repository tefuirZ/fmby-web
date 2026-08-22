import type { RawManagedSessionRecord } from "./raw-types";
export declare function parseClientInfo(raw?: string | null): {
    deviceName: string | undefined;
    clientName: string | undefined;
    headerLabel: string | undefined;
};
export declare function buildSessionDeviceFallback(raw: RawManagedSessionRecord, status: "active" | "idle" | "expired" | "revoked"): string;
export declare function buildSessionClientFallback(raw: RawManagedSessionRecord, status: "active" | "idle" | "expired" | "revoked"): "本机客户端" | "历史客户端" | "未知客户端";
export declare function buildDeviceNameFromUserAgent(userAgent?: string | null): string | undefined;
export declare function buildClientName(requestedWith?: string | null, userAgent?: string | null): string | undefined;
export declare function looksLikeUserAgent(value: string): boolean;
export declare function detectClientLabel(userAgent?: string | null): "Hills Windows" | "Infuse" | "Emby" | "Edge" | "Chrome" | "Firefox" | "Safari" | undefined;
export declare function detectOsLabel(userAgent?: string | null): "Windows" | "macOS" | "Android" | "iOS" | "Linux" | undefined;
export declare function formatUserAgentLabel(userAgent?: string | null): string | undefined;
//# sourceMappingURL=ua-parser.d.ts.map