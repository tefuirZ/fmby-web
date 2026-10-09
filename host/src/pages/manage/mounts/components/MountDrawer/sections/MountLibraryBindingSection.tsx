/**
 * 挂载↔媒体库绑定管理（FE-MOUNT-LIBRARY-UI）。
 *
 * 数据面：`GET/POST/DELETE /api/manage/mounts/{id}/libraries`（G7-B 契约，
 * FE-GAP-ROUND4 已接前端）。R2.5：不可见挂载后端 404 ⇒ 本组件**诚实呈现
 * 「挂载不存在或不可见」**，不吞成空列表、不伪造成功。
 *
 * 绑定不可逆解除（unbind）走 ConfirmDialog（真实 props：onOpenChange+onConfirm）。
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { manageApi } from '@fmby/v2-shared/contracts/manage';
import type { ManageLibraryRecord } from '@fmby/v2-shared/contracts/manage';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { ConfirmDialog } from '@fmby/v2-shared/ui';
import { queryKeys } from '@fmby/v2-shared/query';
import { ManageSectionCard } from '../../../../components';
import sharedStyles from '../../../../longtail-shared/ManageShared.module.css';
import styles from '../../../../longtail-shared/ManageShared.module.css';

interface MountLibraryBindingSectionProps {
  /** 挂载 id（detail 的 mount.id）。 */
  mountId: string;
}

export function MountLibraryBindingSection({ mountId }: MountLibraryBindingSectionProps) {
  // 候选库列表自取（manage 面 /api/manage/libraries，MANAGE_LIBRARY 已由页面门控）。
  const librariesQuery = useQuery({
    queryKey: queryKeys.manage.mounts.librariesForBinding(),
    queryFn: () => manageApi.getLibraries(),
  });
  const libraries: ManageLibraryRecord[] = librariesQuery.data?.items ?? [];
  const queryClient = useQueryClient();
  const [bindTarget, setBindTarget] = useState<string>('');
  const [unbindTarget, setUnbindTarget] = useState<{ id: string; name: string } | null>(null);

  const listQuery = useQuery({
    queryKey: queryKeys.manage.mounts.libraries(mountId),
    queryFn: () => manageApi.listMountLibraries(mountId),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.manage.mounts.libraries(mountId),
    });
  };

  const bindMutation = useMutation({
    mutationFn: (libraryId: string) => manageApi.bindMountLibrary(mountId, libraryId),
    onSuccess: invalidate,
  });

  const unbindMutation = useMutation({
    mutationFn: (libraryId: string) => manageApi.unbindMountLibrary(mountId, libraryId),
    onSuccess: () => {
      setUnbindTarget(null);
      invalidate();
    },
  });

  const status = listQuery.data;

  // R2.5：不可见挂载 ⇒ 404。诚实呈现，不吞成空列表。
  if (listQuery.isError) {
    return (
      <ManageSectionCard title="绑定的媒体库" description="读取绑定关系失败。">
        <div role="alert" className={styles.banner ?? styles.mutedText}>
          {getErrorMessage(listQuery.error)}
        </div>
        <button className={styles.secondaryButton} type="button" onClick={() => listQuery.refetch()}>
          重试
        </button>
      </ManageSectionCard>
    );
  }

  const boundIds = new Set(status?.libraryIds ?? []);
  const candidates = libraries.filter((library) => !boundIds.has(Number(library.id)));
  const boundLibraries = libraries.filter((library) => boundIds.has(Number(library.id)));

  return (
    <ManageSectionCard
      title="绑定的媒体库"
      description="挂载会向绑定的媒体库供给内容；解除绑定不可逆，需要重新绑定。"
    >
      {listQuery.isPending ? (
        <p className={sharedStyles.mutedText}>加载中…</p>
      ) : (
        <>
          {boundLibraries.length === 0 ? (
            <p className={sharedStyles.mutedText}>尚未绑定任何媒体库。</p>
          ) : (
            <div className={sharedStyles.fieldGroup}>
              {boundLibraries.map((library) => (
                <div key={library.id} className={sharedStyles.sourceRow}>
                  <span className={sharedStyles.label}>{library.name}</span>
                  <button
                    className={sharedStyles.dangerButton}
                    type="button"
                    disabled={unbindMutation.isPending}
                    onClick={() => setUnbindTarget({ id: library.id, name: library.name })}
                  >
                    解除绑定
                  </button>
                </div>
              ))}
            </div>
          )}

          {candidates.length > 0 ? (
            <label className={sharedStyles.label}>
              绑定新库
              <select
                className={sharedStyles.select}
                value={bindTarget}
                onChange={(event) => setBindTarget(event.target.value)}
              >
                <option value="">选择媒体库…</option>
                {candidates.map((library) => (
                  <option key={library.id} value={library.id}>
                    {library.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {bindTarget ? (
            <button
              className={styles.primaryButton}
              type="button"
              disabled={bindMutation.isPending}
              onClick={() => bindMutation.mutate(bindTarget)}
            >
              {bindMutation.isPending ? '绑定中…' : '绑定'}
            </button>
          ) : null}

          {bindMutation.isError ? (
            <div role="alert" className={sharedStyles.mutedText}>
              {getErrorMessage(bindMutation.error)}
            </div>
          ) : null}
          {unbindMutation.isError ? (
            <div role="alert" className={sharedStyles.mutedText}>
              {getErrorMessage(unbindMutation.error)}
            </div>
          ) : null}
        </>
      )}

      {/* 解绑不可逆 ⇒ ConfirmDialog 确认（onOpenChange 语义） */}
      <ConfirmDialog
        open={unbindTarget !== null}
        title="解除库绑定"
        description={`将从该挂载解除「${unbindTarget?.name ?? ''}」的绑定。解除后该挂载不再向该库供给内容，此操作不可逆。`}
        impact="挂载内容供给立即停止"
        errorMessage={unbindMutation.isError ? getErrorMessage(unbindMutation.error) : undefined}
        confirmLabel="确认解除"
        pending={unbindMutation.isPending}
        onOpenChange={(open) => {
          if (!open) setUnbindTarget(null);
        }}
        onConfirm={() => {
          if (unbindTarget) {
            unbindMutation.mutate(unbindTarget.id);
          }
        }}
      />
    </ManageSectionCard>
  );
}
