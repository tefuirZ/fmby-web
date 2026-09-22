import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  type ManageMountDirectoryBrowserResponse,
  type ManageMountProviderType,
} from '@fmby/v2-shared/contracts/manage';
import { FeedbackState } from '@fmby/v2-shared/ui';
import { ConfirmDialog } from '@fmby/v2-shared/ui';
import { InlineBanner } from '@fmby/v2-shared/ui';
import { SensitiveActionDialog } from '@fmby/v2-shared/ui';
import { BatchActionBar, BatchProgressPanel } from '@fmby/v2-shared/ui';
import { useBatchSelection, useBatchRunner } from '@fmby/v2-shared/hooks';
import styles from './ManagePages.module.css';
import { ManagePageHeader, MetricCard } from './components';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import type { BannerState } from '@fmby/v2-shared/ui/types';
import { matchKeyword } from '@fmby/v2-shared/search/matchKeyword';
import {
  type MountDrawerState,
  type MountFormErrors,
  type MountFormState,
  type MountHealthStatus,
  type PendingMountDeleteState,
  type MountRemoteAuthMode,
} from './mounts/types';
import {
  buildAuthModeChangeImpact,
  buildPendingMountDeleteState,
  buildMountDeleteImpact,
  buildMountFormState,
  createEmptyMountForm,
} from './mounts/formUtils';
import { useMountsQuery, useMountDetailQuery, useMountMutations, useMountValidation } from './mounts/hooks';
import { MountTable, MountDrawer } from './mounts/components';

export function ManageMountsPage() {
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | MountHealthStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ManageMountProviderType>('all');
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [drawerState, setDrawerState] = useState<MountDrawerState | null>(null);
  const [formState, setFormState] = useState<MountFormState>(() => createEmptyMountForm());
  const [formErrors, setFormErrors] = useState<MountFormErrors>({});
  const [directoryBrowser, setDirectoryBrowser] = useState<ManageMountDirectoryBrowserResponse | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingMountDeleteState | null>(null);
  const [pendingAuthModeChange, setPendingAuthModeChange] = useState<MountRemoteAuthMode | null>(null);
  const [batchDeleteConfirmOpen, setBatchDeleteConfirmOpen] = useState(false);
  const [refreshAbnormalOpen, setRefreshAbnormalOpen] = useState(false);
  const deferredKeyword = useDeferredValue(keyword.trim());

  const mountsQuery = useMountsQuery();
  const mountDetailQuery = useMountDetailQuery(drawerState);
  const { createMountMutation, updateMountMutation, deleteMountMutation, refreshAbnormalMutation } = useMountMutations({
    setBanner,
    setFormErrors,
    setDirectoryBrowser,
    setDrawerState,
    clearPendingDelete: () => setPendingDelete(null),
  });
  const { validateMountMutation, refreshMountAccessMutation, browseDirectoriesMutation } = useMountValidation({
    setBanner, setFormErrors, setDirectoryBrowser,
  });

  useEffect(() => {
    if (drawerState?.mode === 'edit' && mountDetailQuery.data) {
      setFormState(buildMountFormState(mountDetailQuery.data));
      setFormErrors({});
      setDirectoryBrowser(null);
    }
  }, [drawerState?.mode, mountDetailQuery.data]);

  const mounts = mountsQuery.data?.items ?? [];
  const currentDetail = mountDetailQuery.data;
  const isSaving = createMountMutation.isPending || updateMountMutation.isPending;
  const isDeleting = deleteMountMutation.isPending;

  const filteredMounts = useMemo(() => {
    return mounts.filter((mount) => {
      const matchesKeyword = matchKeyword(
        deferredKeyword,
        mount.name,
        mount.pathLabel,
        mount.typeLabel,
        mount.statusMessage,
        `异常绑定 ${mount.unavailableBindingCount}`,
        `媒体库绑定 ${mount.referenceCounts.librarySourceCount}`,
        `媒体源 ${mount.referenceCounts.mediaSourceCount}`,
        `旁路资源 ${mount.referenceCounts.sidecarAssetCount}`,
        ...mount.linkedLibraries.map((library) => library.name),
      );
      const matchesStatus = statusFilter === 'all' || mount.healthStatus === statusFilter;
      const matchesType = typeFilter === 'all' || mount.mountType === typeFilter;
      return matchesKeyword && matchesStatus && matchesType;
    });
  }, [deferredKeyword, mounts, statusFilter, typeFilter]);

  // FE-OPT-04：多选 + 批量删除（后端无批量端点，逐条调用既有 DELETE；
  // 逐条状态可见、失败项可单条重试）。
  const visibleIds = useMemo(() => filteredMounts.map((m) => m.id), [filteredMounts]);
  const selection = useBatchSelection({ visibleIds });
  const runner = useBatchRunner();
  const selectedMounts = useMemo(
    () => mounts.filter((m) => selection.selectedSet.has(m.id)),
    [mounts, selection.selectedSet],
  );

  const labelOfMount = (id: string) => mounts.find((m) => m.id === id)?.name ?? `#${id}`;

  const runBatchDelete = async () => {
    const targets = selection.selected.map((id) => ({ id, label: labelOfMount(id) }));
    selection.clear();
    await runner.run(targets, deleteMountOne);
    await mountsQuery.refetch();
  };

  /** 单条删除执行器（批量 / 重试共用）。 */
  const deleteMountOne = async (mountId: string) => {
    await deleteMountMutation.mutateAsync({
      mountId,
      confirmation: { confirmAction: 'delete-mount' },
    });
  };

  const retryMountDelete = async (id: string) => {
    await runner.retryOne(id, deleteMountOne);
    await mountsQuery.refetch();
  };

  const retryAllMountDeletes = async () => {
    await runner.retryFailed(deleteMountOne);
    await mountsQuery.refetch();
  };

  if (mountsQuery.isPending) {
    return (
      <FeedbackState variant="loading" title="正在加载数据源" description="正在整理来源类型、健康状态和最近校验时间。" />
    );
  }
  if (mountsQuery.isError) {
    return (
      <FeedbackState
        variant="error"
        title="数据源加载失败"
        description={getErrorMessage(mountsQuery.error)}
        action={<button className={styles.primaryButton} type="button" onClick={() => mountsQuery.refetch()}>重试</button>}
      />
    );
  }

  const healthyCount = mounts.filter((m) => m.healthStatus === 'healthy').length;
  const attentionCount = mounts.filter((m) => m.healthStatus === 'attention').length;
  const criticalCount = mounts.filter((m) => m.healthStatus === 'critical').length;
  const linkedLibrarySourceCount = mounts.reduce((sum, m) => sum + m.referenceCounts.librarySourceCount, 0);
  const unavailableBindingMountCount = mounts.filter((mount) => mount.unavailableBindingCount > 0).length;

  const openCreateDrawer = () => {
    setBanner(null);
    setFormErrors({});
    setDirectoryBrowser(null);
    setPendingAuthModeChange(null);
    setFormState(createEmptyMountForm());
    setDrawerState({ mode: 'create' });
  };

  const openMountDrawer = (mountId: string, mode: 'view' | 'edit') => {
    setBanner(null);
    setFormErrors({});
    setDirectoryBrowser(null);
    setPendingAuthModeChange(null);
    if (mode === 'edit' && currentDetail?.mount.id === mountId) {
      setFormState(buildMountFormState(currentDetail));
    } else if (mode === 'edit') {
      setFormState(createEmptyMountForm());
    }
    setDrawerState({ mode, mountId });
  };

  const closeDrawer = () => {
    if (isSaving) return;
    setFormErrors({});
    setDirectoryBrowser(null);
    setPendingAuthModeChange(null);
    setFormState(createEmptyMountForm());
    setDrawerState(null);
  };

  const requestDelete = (target: PendingMountDeleteState) => {
    deleteMountMutation.reset();
    setPendingDelete(target);
  };

  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="媒体来源"
        description="这里负责把本地目录、OpenList、AList、WebDAV 或 S3 接进来，让媒体库真正能看到文件。"
        meta={<span className={styles.metaText}>共 {mounts.length} 个媒体来源</span>}
        actions={
          <>
            <button className={styles.primaryButton} type="button" onClick={openCreateDrawer}>添加媒体来源</button>
            <button className={styles.secondaryButton} type="button" onClick={() => mountsQuery.refetch()}>刷新</button>
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={refreshAbnormalMutation.isPending || criticalCount === 0}
              onClick={() => setRefreshAbnormalOpen(true)}
            >
              {refreshAbnormalMutation.isPending ? '刷新中…' : '批量刷新异常'}
            </button>
          </>
        }
      />

      {banner ? <InlineBanner variant={banner.variant} title={banner.title} description={banner.description} /> : null}
      {(attentionCount > 0 || criticalCount > 0) && (
        <InlineBanner
          variant={criticalCount > 0 ? 'warning' : 'info'}
          title={criticalCount > 0 ? '有媒体来源当前不可用' : '部分媒体来源建议复核'}
          description={
            unavailableBindingMountCount > 0
              ? `当前共有 ${attentionCount + criticalCount} 个媒体来源不是“正常”状态，其中 ${unavailableBindingMountCount} 个来源已经有资源被系统隐藏，管理员需要尽快处理。`
              : `当前共有 ${attentionCount + criticalCount} 个媒体来源不是“正常”状态，建议先检查连接信息和最近校验时间。`
          }
        />
      )}

      <section className={styles.metricsGrid}>
        <MetricCard label="正常来源" value={healthyCount} status="healthy" />
        <MetricCard label="需关注" value={attentionCount} status="attention" />
        <MetricCard label="异常" value={criticalCount} status="critical" />
        <MetricCard label="已绑定到媒体库" value={linkedLibrarySourceCount} status="healthy" />
      </section>

      <MountTable
        mounts={mounts}
        filteredMounts={filteredMounts}
        keyword={keyword}
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        onKeywordChange={setKeyword}
        onStatusFilterChange={setStatusFilter}
        onTypeFilterChange={setTypeFilter}
        onOpenView={(id) => openMountDrawer(id, 'view')}
        onOpenEdit={(id) => openMountDrawer(id, 'edit')}
        onRequestDelete={(mount) => requestDelete(buildPendingMountDeleteState(mount))}
        onCreateClick={openCreateDrawer}
        validateMutation={validateMountMutation}
        selectedIds={selection.selected}
        headerState={selection.headerState}
        onToggleRow={(id, checked, opts) => selection.toggle(id, checked, opts)}
        onSelectAll={selection.selectAll}
        onClearVisible={selection.clearVisible}
        onInvertVisible={selection.invertVisible}
      />

      {runner.items.length > 0 ? (
        <BatchProgressPanel
          items={runner.items}
          actionLabel="删除数据源"
          onDismiss={runner.dismiss}
          onRetryItem={(id) => void retryMountDelete(id)}
          onRetryFailed={() => void retryAllMountDeletes()}
        />
      ) : null}

      <BatchActionBar
        count={selectedMounts.length}
        onClear={selection.clear}
        hint="批量删除会移除数据源及其绑定关系，逐条执行、失败可单独重试。"
      >
        <button
          className={styles.dangerButton}
          type="button"
          onClick={() => setBatchDeleteConfirmOpen(true)}
        >
          批量删除
        </button>
      </BatchActionBar>

      <MountDrawer
        drawerState={drawerState}
        mountDetailQuery={mountDetailQuery}
        formState={formState}
        setFormState={setFormState}
        formErrors={formErrors}
        setFormErrors={setFormErrors}
        directoryBrowser={directoryBrowser}
        setDirectoryBrowser={setDirectoryBrowser}
        pendingAuthModeChange={pendingAuthModeChange}
        setPendingAuthModeChange={setPendingAuthModeChange}
        isSaving={isSaving}
        isDeleting={isDeleting}
        createMountMutation={createMountMutation}
        updateMountMutation={updateMountMutation}
        validateMountMutation={validateMountMutation}
        refreshMountAccessMutation={refreshMountAccessMutation}
        browseDirectoriesMutation={browseDirectoriesMutation}
        setPendingDelete={(detail) => setPendingDelete(detail ? buildPendingMountDeleteState(detail) : null)}
        setBanner={setBanner}
        setDrawerState={setDrawerState}
        onClose={closeDrawer}
      />

      <SensitiveActionDialog
        open={pendingDelete !== null}
        actionKey="delete-mount"
        title={pendingDelete ? `删除数据源：${pendingDelete.mountName}` : ''}
        description="删除后该数据源会立即从列表移除；其关联的媒体库资源将由后台异步清理（可能耗时，期间仍可能短暂可见），清理完成前请勿重复操作。"
        impact={pendingDelete ? buildMountDeleteImpact(pendingDelete) : undefined}
        errorMessage={pendingDelete && deleteMountMutation.isError ? getErrorMessage(deleteMountMutation.error) : undefined}
        confirmLabel="删除来源"
        onOpenChange={(open) => {
          if (!open) {
            deleteMountMutation.reset();
            setPendingDelete(null);
          }
        }}
        onConfirm={(confirmation) => {
          if (!pendingDelete) return;
          deleteMountMutation.reset();
          deleteMountMutation.mutate({
            mountId: pendingDelete.mountId,
            confirmation,
          });
        }}
        pending={isDeleting}
      />
      <SensitiveActionDialog
        open={refreshAbnormalOpen}
        actionKey="batch-refresh-abnormal-mounts"
        title="批量刷新异常媒体来源"
        description="将对当前所有处于异常状态的媒体来源重新触发刷新与校验。"
        impact={[
          '异常来源会重新读取连接信息与文件可用性；',
          '刷新在后台异步进行，列表状态会在完成后更新；',
          '若某来源已彻底失效，刷新后仍会保持异常，需手动检查配置。',
        ]}
        errorMessage={refreshAbnormalMutation.isError ? getErrorMessage(refreshAbnormalMutation.error) : undefined}
        confirmLabel="开始批量刷新"
        onOpenChange={(open) => {
          if (!open) {
            refreshAbnormalMutation.reset();
            setRefreshAbnormalOpen(false);
          }
        }}
        onConfirm={() => {
          refreshAbnormalMutation.reset();
          refreshAbnormalMutation.mutate();
          setRefreshAbnormalOpen(false);
        }}
        pending={refreshAbnormalMutation.isPending}
      />
      <ConfirmDialog
        open={batchDeleteConfirmOpen}
        title={`批量删除 ${selectedMounts.length} 个数据源`}
        description="将逐条删除选中数据源；失败项会在进度面板中列出，可单独重试。"
        impact={selectedMounts.map((m) => `· ${m.name}`).join('\n')}
        confirmLabel="确认批量删除"
        onOpenChange={(open) => { if (!open) setBatchDeleteConfirmOpen(false); }}
        onConfirm={() => {
          setBatchDeleteConfirmOpen(false);
          void runBatchDelete();
        }}
      />
      <ConfirmDialog
        open={pendingAuthModeChange !== null}
        title="切换认证方式"
        description="切换并保存后，当前来源只会保留新认证方式对应的凭据；另一套已保存凭据会被覆盖。"
        impact={buildAuthModeChangeImpact(currentDetail, formState.remoteConfig.authMode, pendingAuthModeChange)}
        confirmLabel="继续切换"
        onOpenChange={(open) => { if (!open) setPendingAuthModeChange(null); }}
        onConfirm={() => {
          if (!pendingAuthModeChange) return;
          setFormErrors((prev) => ({ ...prev, username: undefined, password: undefined, token: undefined, browse: undefined }));
          setDirectoryBrowser(null);
          setPendingAuthModeChange(null);
          setFormState((prev) => ({ ...prev, remoteConfig: { ...prev.remoteConfig, authMode: pendingAuthModeChange } }));
        }}
      />
    </div>
  );
}

export default ManageMountsPage;
