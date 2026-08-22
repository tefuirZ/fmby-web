import { useMemo } from 'react';
import { ChevronRight, Folder, Loader2 } from 'lucide-react';
import styles from './DirectoryBrowser.module.css';

export interface DirectoryBrowserEntry {
  name: string;
  path: string;
}

export interface DirectoryBrowserCopy {
  currentPathLabel: string;
  currentPathPlaceholder: string;
  selectedPathLabel: string;
  selectedPathPlaceholder: string;
  loadingMessage: string;
  idleMessage: string;
  emptyMessage: string;
  loadActionLabel: string;
  refreshActionLabel: string;
  backActionLabel: string;
  navigateActionLabel: string;
  selectActionLabel: string;
  selectedActionLabel: string;
  selectCurrentActionLabel: string;
}

export interface DirectoryBrowserProps {
  value: string;
  onChange: (path: string) => void;
  currentPath?: string;
  parentPath?: string;
  entries?: DirectoryBrowserEntry[];
  isLoading?: boolean;
  error?: string;
  disabled?: boolean;
  onNavigate: (path: string) => void;
  onLoad: () => void;
  onRefresh?: () => void;
  canSelectCurrentPath?: boolean;
  selectCurrentDisabledReason?: string;
  copy?: Partial<DirectoryBrowserCopy>;
}

const DEFAULT_COPY: DirectoryBrowserCopy = {
  currentPathLabel: '当前浏览',
  currentPathPlaceholder: '尚未加载',
  selectedPathLabel: '已选路径',
  selectedPathPlaceholder: '未选择',
  loadingMessage: '加载目录中…',
  idleMessage: '点击下方“加载目录”开始浏览路径。',
  emptyMessage: '当前目录下没有子目录，可以直接选择当前目录。',
  loadActionLabel: '加载目录',
  refreshActionLabel: '刷新',
  backActionLabel: '返回上级',
  navigateActionLabel: '进入',
  selectActionLabel: '选择',
  selectedActionLabel: '已选',
  selectCurrentActionLabel: '选择当前目录',
};

/**
 * 通用目录浏览器，仅负责展示与交互，不感知任何具体业务或请求实现。
 */
export function DirectoryBrowser({
  value,
  onChange,
  currentPath,
  parentPath,
  entries,
  isLoading = false,
  error,
  disabled = false,
  onNavigate,
  onLoad,
  onRefresh,
  canSelectCurrentPath = true,
  selectCurrentDisabledReason,
  copy,
}: DirectoryBrowserProps) {
  const resolvedCopy = { ...DEFAULT_COPY, ...copy };
  const hasLoaded = currentPath !== undefined;
  const directoryEntries = entries ?? [];
  const activePath = currentPath ?? '/';

  const breadcrumbs = useMemo(() => {
    return buildBreadcrumbs(currentPath ?? value ?? '/');
  }, [currentPath, value]);

  const handleNavigate = (path: string) => {
    if (disabled || isLoading) return;
    onNavigate(path);
  };

  const handleSelect = (path: string) => {
    if (disabled) return;
    onChange(path);
  };

  const handleReload = () => {
    if (disabled || isLoading) return;
    if (hasLoaded) {
      if (onRefresh) {
        onRefresh();
        return;
      }
      handleNavigate(activePath);
      return;
    }
    onLoad();
  };

  return (
    <div className={styles.container} data-disabled={disabled}>
      {hasLoaded ? (
        <div className={styles.breadcrumb}>
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.path}>
              {index > 0 ? (
                <span className={styles.breadcrumbSeparator}>
                  <ChevronRight size={12} />
                </span>
              ) : null}
              <button
                className={styles.breadcrumbItem}
                type="button"
                data-current={index === breadcrumbs.length - 1}
                onClick={() => {
                  if (index < breadcrumbs.length - 1) {
                    handleNavigate(crumb.path);
                  }
                }}
                disabled={index === breadcrumbs.length - 1 || isLoading}
              >
                {crumb.label}
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className={styles.statusBar}>
        <span>
          {resolvedCopy.currentPathLabel}
          ：
          {currentPath ?? resolvedCopy.currentPathPlaceholder}
        </span>
        <span className={styles.selectedPath}>
          {resolvedCopy.selectedPathLabel}
          ：
          {value || resolvedCopy.selectedPathPlaceholder}
        </span>
      </div>

      {error ? (
        <div className={styles.errorState}>
          <span className={styles.errorMessage}>{error}</span>
        </div>
      ) : isLoading ? (
        <div className={styles.loadingState}>
          <Loader2 size={18} className="animate-spin" />
          <span>{resolvedCopy.loadingMessage}</span>
        </div>
      ) : !hasLoaded ? (
        <div className={styles.emptyState}>{resolvedCopy.idleMessage}</div>
      ) : directoryEntries.length === 0 ? (
        <div className={styles.emptyState}>{resolvedCopy.emptyMessage}</div>
      ) : (
        <div className={styles.directoryList}>
          {directoryEntries.map((entry) => {
            const isSelected = value === entry.path;
            return (
              <div
                key={entry.path}
                className={styles.directoryItem}
                data-selected={isSelected}
                onDoubleClick={() => handleNavigate(entry.path)}
              >
                <Folder size={16} className={styles.directoryIcon} />
                <div className={styles.directoryMeta}>
                  <span className={styles.directoryName}>{entry.name}</span>
                  <span className={styles.directoryPath}>{entry.path}</span>
                </div>
                <div className={styles.directoryActions}>
                  <button
                    className={styles.smallButton}
                    type="button"
                    onClick={() => handleNavigate(entry.path)}
                    disabled={isLoading}
                  >
                    {resolvedCopy.navigateActionLabel}
                  </button>
                  <button
                    className={isSelected ? styles.confirmButton : styles.smallButton}
                    type="button"
                    onClick={() => handleSelect(entry.path)}
                  >
                    {isSelected ? resolvedCopy.selectedActionLabel : resolvedCopy.selectActionLabel}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className={styles.actionBar}>
        {hasLoaded && parentPath ? (
          <button
            className={styles.smallButton}
            type="button"
            onClick={() => handleNavigate(parentPath)}
            disabled={isLoading}
          >
            {resolvedCopy.backActionLabel}
          </button>
        ) : null}
        <button
          className={styles.smallButton}
          type="button"
          onClick={handleReload}
          disabled={isLoading}
        >
          {isLoading
            ? resolvedCopy.loadingMessage
            : hasLoaded
              ? resolvedCopy.refreshActionLabel
              : resolvedCopy.loadActionLabel}
        </button>
        {hasLoaded ? (
          <button
            className={styles.confirmButton}
            type="button"
            onClick={() => handleSelect(activePath)}
            disabled={!canSelectCurrentPath}
            title={selectCurrentDisabledReason}
          >
            {resolvedCopy.selectCurrentActionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function buildBreadcrumbs(path: string): Array<{ label: string; path: string }> {
  const normalized = path.replace(/\\/g, '/');
  const segments = normalized.split('/').filter((segment) => segment !== '' && segment !== '.' && segment !== '..');

  const crumbs: Array<{ label: string; path: string }> = [{ label: '/', path: '/' }];
  let accumulated = '';
  for (const segment of segments) {
    accumulated += `/${segment}`;
    crumbs.push({ label: segment, path: accumulated });
  }

  return crumbs;
}
