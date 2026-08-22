import type { CreateManageMountRequest, ManageMountProviderType } from './types';

export function mapProviderTypeToApi(raw: CreateManageMountRequest['providerType']) {
  switch (raw) {
    case 'local':
      return 'Local';
    case 'webdav':
      return 'WebDAV';
    case 's3-compatible':
      return 'S3Compatible';
    case 'alist':
      return 'AList';
    case 'pan115':
      return 'Pan115';
    default:
      return 'OpenList';
  }
}

export function mapProviderTypeFromApi(
  raw?: string | null,
): ManageMountProviderType {
  switch ((raw ?? '').trim().toLowerCase()) {
    case 'local':
      return 'local';
    case 'webdav':
      return 'webdav';
    case 's3compatible':
    case 's3_compatible':
    case 's3-compatible':
      return 's3-compatible';
    case 'alist':
      return 'alist';
    case 'pan115':
      return 'pan115';
    default:
      return 'openlist';
  }
}
