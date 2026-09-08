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

/** 单页目录条数（服务端 browse 无分页参数，客户端按页切片，见下方 toPaged）。 */
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

  const browseMutation = useMutation({
    mutationFn: (path: string) => pan115Api.browseDirectory(mountId, path),
    onSuccess: (data) => {
      setBrowseResult(data);
      setBrowseError(null);
      setPage(1);
    },
    onError: (error) => {
      setBrowseResult(null);
      setBrowseError(isCredentialError(error) ? PAN115_CREDENTIAL_HINT : getErrorMessage(error));
    },
  });

  const browser = browseResult ? toBrowserResponse(browseResult) : null;
  // 契约缺口：browse 端点无 offset/limit，服务端全量返回；此处客户端按页切片。
  const total = browser?.directories.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paged = useMemo<ManageMountDirectoryBrowserResponse | null>(() => {
    if (!browser) return null;
    const start = (page - 1) * PAGE_SIZE;
    return { ...browser, directories: browser.directories.slice(start, start + PAGE_SIZE) };
  }, [browser, page]);

  return (
    <MountDirectoryBrowserCard
      providerType="pan115"
      value={value}
      browser={paged}
      error={browseError ?? undefined}
      disabled={disabled}
      isLoading={browseMutation.isPending}
      onBrowse={(path) => browseMutation.mutate(path || '/')}
      onChange={onChange}
      pagination={
        total > PAGE_SIZE
          ? { page, pageSize: PAGE_SIZE, total, totalPages, onPageChange: setPage }
          : undefined
      }
    />
  );
}
