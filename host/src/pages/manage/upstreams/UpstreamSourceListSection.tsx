import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  upstreamsApi,
  type UpstreamSourceRecord,
} from '@fmby/v2-shared/contracts/manage/upstreams';
import { queryKeys } from '@fmby/v2-shared/query';
import { InlineBanner, SensitiveActionDialog, StatusBadge } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from '../longtail-shared/ManageShared.module.css';
import { ManageSectionCard, getManageStatusVariant } from '../longtail-shared/components';
import { SourceFormDialog } from './SourceFormDialog';
import {
  SOURCE_TYPE_OPTIONS,
  STATUS_LABELS,
  buildFormStateFromRecord,
  createInitialFormState,
  formatEpochMs,
  toWriteInput,
  type SourceFormState,
} from './shared';

/** 上游源本体列表（CRUD + 启停 + 真实探活 + 局域网发现）。 */
export function UpstreamSourceListSection() {
  const queryClient = useQueryClient();
  const [sourceType, setSourceType] = useState('');
  const [banner, setBanner] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UpstreamSourceRecord | null>(null);
  const [formState, setFormState] = useState<SourceFormState>(createInitialFormState);
  const [pendingDelete, setPendingDelete] = useState<UpstreamSourceRecord | null>(null);

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.manage.upstreams.all() });

  const listQuery = useQuery({
    queryKey: queryKeys.manage.upstreams.list({ sourceType }),
    queryFn: () => upstreamsApi.list({ sourceType: sourceType || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: (input: Parameters<typeof upstreamsApi.create>[0]) => upstreamsApi.create(input),
    onSuccess: () => {
      setBanner('上游源已创建。');
      setFormOpen(false);
      invalidate();
    },
    onError: (e) => setBanner(getErrorMessage(e)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof upstreamsApi.create>[0] }) =>
      upstreamsApi.update(id, input),
    onSuccess: () => {
      setBanner('上游源已更新。');
      setFormOpen(false);
      invalidate();
    },
    onError: (e) => setBanner(getErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => upstreamsApi.remove(id),
    onSuccess: () => {
      setBanner('上游源已删除。');
      invalidate();
    },
    onError: (e) => setBanner(getErrorMessage(e)),
  });

  const enableMutation = useMutation({
    mutationFn: (id: string) => upstreamsApi.enable(id),
    onSuccess: () => {
      setBanner('上游源已启用。');
      invalidate();
    },
    onError: (e) => setBanner(getErrorMessage(e)),
  });

  const disableMutation = useMutation({
    mutationFn: (id: string) => upstreamsApi.disable(id),
    onSuccess: () => {
      setBanner('上游源已停用。');
      invalidate();
    },
    onError: (e) => setBanner(getErrorMessage(e)),
  });

  const healthMutation = useMutation({
    mutationFn: (id: string) => upstreamsApi.healthCheck(id),
    onSuccess: (r) => {
      setBanner(`探活完成：${r.healthStatus} — ${r.message}`);
      invalidate();
    },
    onError: (e) => setBanner(getErrorMessage(e)),
  });

  const discoveryMutation = useMutation({
    mutationFn: () => upstreamsApi.discoverLan(),
    onSuccess: (r) => setBanner(`局域网发现完成：找到 ${r.items.length} 个 Emby 服务。`),
    onError: (e) => setBanner(getErrorMessage(e)),
  });

  const sources = listQuery.data?.items ?? [];
  const isFormPending = createMutation.isPending || updateMutation.isPending;

  function openCreate() {
    setEditing(null);
    setFormState(createInitialFormState());
    setFormOpen(true);
  }

  function openEdit(record: UpstreamSourceRecord) {
    setEditing(record);
    setFormState(buildFormStateFromRecord(record));
    setFormOpen(true);
  }

  function submitForm() {
    const input = toWriteInput(formState, editing !== null);
    if (editing) {
      updateMutation.mutate({ id: editing.id, input });
    } else {
      createMutation.mutate(input);
    }
  }

  return (
    <>
      {banner ? <InlineBanner variant="info" title={banner} description="操作结果。" /> : null}

      {discoveryMutation.data && discoveryMutation.data.items.length > 0 ? (
        <ManageSectionCard
          title={`局域网发现结果（${discoveryMutation.data.items.length}）`}
          description="UDP 广播真实发现，无需凭据；地址可直接填进新建表单。"
        >
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>名称</th>
                  <th>地址</th>
                  <th>端点</th>
                  <th>Server ID</th>
                </tr>
              </thead>
              <tbody>
                {discoveryMutation.data.items.map((i) => (
                  <tr key={`${i.baseUrl}-${i.name}`}>
                    <td>{i.name}</td>
                    <td className={styles.mono}>{i.baseUrl}</td>
                    <td className={styles.mono}>{i.endpointAddress ?? '—'}</td>
                    <td className={styles.mono}>{i.serverId ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ManageSectionCard>
      ) : null}

      <ManageSectionCard
        title="上游源列表"
        description="读接口只回 has_secret，永不回显明文凭据。"
        actions={
          <>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => discoveryMutation.mutate()}
              disabled={discoveryMutation.isPending}
            >
              {discoveryMutation.isPending ? '发现中…' : '局域网发现'}
            </button>
            <button className={styles.primaryButton} type="button" onClick={openCreate}>
              新建上游源
            </button>
          </>
        }
      >
        <div className={styles.toolbar}>
          <label className={styles.label}>
            类型
            <select
              className={styles.select}
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
            >
              <option value="">全部类型</option>
              {SOURCE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <span className={styles.tableHint}>结果：{sources.length} 个源</span>
        </div>

        {sources.length === 0 ? (
          <div className={styles.emptyInlineState}>还没有任何上游源，先从右上角新建一个。</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>名称</th>
                  <th>类型</th>
                  <th>地址</th>
                  <th>认证</th>
                  <th>状态</th>
                  <th>最近探活</th>
                  <th>错误信息</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => {
                  const disabled = s.status === 'disabled';
                  return (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{s.sourceTypeLabel || s.sourceType}</td>
                      <td className={styles.mono}>{s.baseUrl}</td>
                      <td className={styles.mono}>{s.authMethod}</td>
                      <td>
                        <StatusBadge
                          label={STATUS_LABELS[s.status] ?? s.status}
                          variant={getManageStatusVariant(s.status)}
                        />
                      </td>
                      <td className="nowrap">{formatEpochMs(s.lastHealthCheckAt)}</td>
                      <td className={styles.mutedText}>{s.lastErrorMessage ?? '—'}</td>
                      <td className="nowrap">
                        <button
                          type="button"
                          className={styles.smallButton}
                          onClick={() => healthMutation.mutate(s.id)}
                          disabled={healthMutation.isPending}
                        >
                          探活
                        </button>
                        <button type="button" className={styles.smallButton} onClick={() => openEdit(s)}>
                          编辑
                        </button>
                        {disabled ? (
                          <button
                            type="button"
                            className={styles.smallButton}
                            onClick={() => enableMutation.mutate(s.id)}
                            disabled={enableMutation.isPending}
                          >
                            启用
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={styles.smallDangerButton}
                            onClick={() => disableMutation.mutate(s.id)}
                            disabled={disableMutation.isPending}
                          >
                            停用
                          </button>
                        )}
                        <button
                          type="button"
                          className={styles.smallDangerButton}
                          onClick={() => setPendingDelete(s)}
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ManageSectionCard>

      <SourceFormDialog
        open={formOpen}
        editing={editing}
        formState={formState}
        pending={isFormPending}
        onOpenChange={(open) => {
          if (!open) setFormOpen(false);
        }}
        onFormStateChange={setFormState}
        onSubmit={submitForm}
      />

      <SensitiveActionDialog
        open={pendingDelete !== null}
        actionKey="delete-upstream-source"
        title={pendingDelete ? `删除上游源：${pendingDelete.name}` : ''}
        description="删除后该源及其绑定/映射关系一并移除，且不可恢复。"
        impact={['物理删除上游源配置。', '关联的类别绑定与映射预设会一并移除。']}
        errorMessage={deleteMutation.isError ? getErrorMessage(deleteMutation.error) : undefined}
        confirmLabel="确认删除"
        pending={deleteMutation.isPending}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setPendingDelete(null);
        }}
        onConfirm={() => {
          if (pendingDelete) {
            deleteMutation.mutate(pendingDelete.id);
            setPendingDelete(null);
          }
        }}
      />
    </>
  );
}
