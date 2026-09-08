import type {
  ManageMountDirectoryBrowserResponse,
  ManageMountProviderType,
} from '@fmby/v2-shared/contracts/manage';
import { DirectoryBrowser } from '@fmby/v2-shared/ui';
import styles from '../../ManagePages.module.css';
import { ManageSectionCard } from '../../components';
import {
  getDirectoryBrowserDescription,
  getDirectoryBrowserHint,
} from '../formUtils';

interface MountDirectoryBrowserPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

interface MountDirectoryBrowserCardProps {
  providerType: ManageMountProviderType;
  value: string;
  browser: ManageMountDirectoryBrowserResponse | null;
  error?: string;
  disabled?: boolean;
  isLoading?: boolean;
  /**
   * 客户端分页控件（可选）。115 等无服务端分页参数的来源传入；
   * local / alist 等保持 undefined，行为与改动前完全一致。
   */
  pagination?: MountDirectoryBrowserPagination;
  onBrowse: (path?: string) => void;
  onChange: (path: string) => void;
}

export function MountDirectoryBrowserCard({
  providerType,
  value,
  browser,
  error,
  disabled = false,
  isLoading = false,
  pagination,
  onBrowse,
  onChange,
}: MountDirectoryBrowserCardProps) {
  const isLocalDriveRoot =
    providerType === 'local'
    && browser?.currentPath === '/'
    && (browser?.directories ?? []).some((directory) => /^[A-Za-z]:\\?$/.test(directory.path));
  const canSelectCurrentDirectory = Boolean(browser) && !isLocalDriveRoot;
  const currentPathPlaceholder = providerType === 'local' ? '尚未加载本机目录' : '尚未连接上游目录';
  const idleMessage = providerType === 'local'
    ? '目录浏览器尚未加载，点击“加载目录”后选择本机根路径。'
    : '目录浏览器尚未加载，点击“加载目录”后再选择远端根路径。';

  return (
    <ManageSectionCard
      title="目录浏览器"
      description={getDirectoryBrowserDescription(providerType)}
    >
      <div className={styles.stackText}>
        <span className={styles.fieldHint}>{getDirectoryBrowserHint(providerType)}</span>
      </div>
      <DirectoryBrowser
        value={value}
        onChange={onChange}
        currentPath={browser?.currentPath}
        parentPath={browser?.parentPath}
        entries={browser?.directories}
        isLoading={isLoading}
        error={error}
        disabled={disabled}
        onNavigate={(path: string) => onBrowse(path)}
        onLoad={() => onBrowse(value || '/')}
        onRefresh={() => onBrowse(browser?.currentPath ?? value ?? '/')}
        canSelectCurrentPath={canSelectCurrentDirectory}
        selectCurrentDisabledReason={!canSelectCurrentDirectory ? '请先进入具体盘符或目录，再设置为根路径。' : undefined}
        copy={{
          currentPathLabel: '当前浏览',
          currentPathPlaceholder,
          selectedPathLabel: '已选根路径',
          selectedPathPlaceholder: '未选择',
          idleMessage,
          emptyMessage: '当前目录下没有更多子目录，可以直接选择当前目录作为根路径。',
          loadActionLabel: '加载目录',
          refreshActionLabel: '刷新目录',
          backActionLabel: '返回上级',
          navigateActionLabel: '进入',
          selectActionLabel: '设为根路径',
          selectedActionLabel: '已选中',
          selectCurrentActionLabel: '选择当前目录',
        }}
      />
      {pagination && pagination.totalPages > 1 ? (
        <div className={styles.rowActions}>
          <button
            className={styles.smallButton}
            type="button"
            disabled={disabled || pagination.page <= 1}
            onClick={() => pagination.onPageChange(pagination.page - 1)}
          >
            上一页
          </button>
          <span className={styles.mutedText}>
            第 {pagination.page} / {pagination.totalPages} 页 · 共 {pagination.total} 个目录
          </span>
          <button
            className={styles.smallButton}
            type="button"
            disabled={disabled || pagination.page >= pagination.totalPages}
            onClick={() => pagination.onPageChange(pagination.page + 1)}
          >
            下一页
          </button>
        </div>
      ) : null}
    </ManageSectionCard>
  );
}
