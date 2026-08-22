export type CredentialProbeStatus = 'idle' | 'probing' | 'success' | 'error';
export interface CredentialProbeResult {
    status: CredentialProbeStatus;
    message?: string;
}
interface CredentialProbeConfig {
    enabled?: boolean;
    providerType: string;
    endpoint: string;
    authMode: string;
    username: string;
    password: string;
    token: string;
}
/**
 * 凭证自动探测 hook
 *
 * 监听连接配置变化，防抖 500ms 后自动调用后端 validate API。
 * 仅在必要字段都填写后才触发探测。
 */
export declare function useCredentialProbe(config: CredentialProbeConfig): CredentialProbeResult;
export {};
//# sourceMappingURL=useCredentialProbe.d.ts.map