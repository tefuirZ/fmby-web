import type { CreateManageMountRequest, ManageMountProviderType } from './types';
export declare function mapProviderTypeToApi(raw: CreateManageMountRequest['providerType']): "Local" | "WebDAV" | "S3Compatible" | "AList" | "Pan115" | "OpenList";
export declare function mapProviderTypeFromApi(raw?: string | null): ManageMountProviderType;
//# sourceMappingURL=provider-mapping.d.ts.map