import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type {
  ManageMountDirectoryBrowserResponse,
  ManageMountDirectoryEntry,
} from '@fmby/v2-shared/contracts/manage';
import type { Pan115BrowseResponse } from '@fmby/v2-shared/contracts/manage/pan115';
import { pan115Api } from '@fmby/v2-shared/contracts/manage/pan115';
import { isApiError } from '@fmby/v2-shared/types';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { MountDirectoryBrowserCard } from '../../MountDirectoryBrowserCard';
import { PAN115_CREDENTIAL_HINT } from '../../../formUtils';

/** 单页目录条数（P2-07-E：服务端分页窗口大小，经 browse offset/limit 透传）。 */
const PAGE_SIZE = 50;

interface Pan115DirectoryBrowserSectionProps {
  mountId: string;
  value: string;
  disabled?: boolean;
  onChange: (path: string) => void;
}

/** 父路径：根 '/' 的父路径仍是 '/'。 */
function parentPathOf(path: string): string {
  const trimmed = (path ?? '/').replace(/\/+$/, '');
  if (!trimmed || trimmed === '/') return '/';
  const index = trimmed.lastIndexOf('/');
  return index <= 0 ? '/' : trimmed.slice(0, index);
}

/** 115 browse 只返回目录项语义（仅目录可进入/设为根路径），文件项在浏览面无意义。 */
function toBrowserResponse(res: Pan115BrowseResponse): ManageMountDirectoryBrowserResponse {
  const directories: ManageMountDirectoryEntry[] = res.entries
    .filter((entry) => entry.isDir)
    .map((entry) => ({ name: entry.name, path: entry.path }));
  return {
    currentPath: res.currentPath,
    parentPath: parentPathOf(res.currentPath),
    directories,
  };
}

/** 凭据缺失/失效（后端 credential_invalid）→ 引导扫码绑定，而非泛化报错。 */
function isCredentialError(error: unknown): boolean {
  return isApiError(error) && error.code === 'credential_invalid';
}

/**
 * P2-09：115 来源的目录浏览（编辑态选 root_path）。
 *
 * 走 accounts browse 端点（`/manage/pan115/accounts/{id}/browse`，用已绑定凭据），
 * 而不是 mount 级 `browseMountDirectories`——后者按 config_json 取凭据，115 凭据只
 * 存在于 SecretBox，不落在 config_json，必然失败。
 */
export function Pan115DirectoryBrowserSection({
  mountId,
  value,
  disabled = false,
  onChange,
}: Pan115DirectoryBrowserSectionProps) {
  const [page, setPage] = useState(1);
  const [browseResult, setBrowseResult] = useState<Pan115BrowseResponse | null>(null);
  const [browseError, setBrowseError] = useState<string | null>(null);

  // P2-07-E：服务端分页——browse 带 offset/limit 窗口（缺省 = 全量向后兼容）；
  // 页号 → offset = (page-1) * PAGE_SIZE；total/nextOffset 由服务端返回。
  const browseMutation = useMutation({
    mutationFn: ({ path, offset }: { path: string; offset: number }) =>
      pan115Api.browseDirectory(mountId, path, offset, PAGE_SIZE),
    onSuccess: (data) => {
      setBrowseResult(data);
      setBrowseError(null);
    },
    onError: (error) => {
      setBrowseResult(null);
      setBrowseError(isCredentialError(error) ? PAN115_CREDENTIAL_HINT : getErrorMessage(error));
    },
  });

  const browser = browseResult ? toBrowserResponse(browseResult) : null;
  // 服务端已按窗口切片（totalCount 为全量），无需客户端再 slice。
  const total = browseResult?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paged = useMemo<ManageMountDirectoryBrowserResponse | null>(() => {
    if (!browser) return null;
    return browser;
  }, [browser]);

  const handleBrowse = (path?: string) => {
    setPage(1);
    browseMutation.mutate({ path: path || '/', offset: 0 });
  };
  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
    const currentPath = browseResult?.currentPath ?? '/';
    browseMutation.mutate({ path: currentPath, offset: (nextPage - 1) * PAGE_SIZE });
  };

  return (
    <MountDirectoryBrowserCard
      providerType="pan115"
      value={value}
      browser={paged}
      error={browseError ?? undefined}
      disabled={disabled}
      isLoading={browseMutation.isPending}
      onBrowse={handleBrowse}
      onChange={onChange}
      pagination={
        total > PAGE_SIZE
          ? { page, pageSize: PAGE_SIZE, total, totalPages, onPageChange: handlePageChange }
          : undefined
      }
    />
  );
}
