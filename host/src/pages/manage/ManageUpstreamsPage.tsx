import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  isUpstreamsUnwiredError,
  upstreamsApi,
  type UpstreamSourceRecord,
  type UpstreamSourceWriteInput,
} from '@fmby/v2-shared/contracts/manage/upstreams';
import { queryKeys } from '@fmby/v2-shared/query';
import {
  Dialog,
  FeedbackState,
  InlineBanner,
  SensitiveActionDialog,
  StatusBadge,
} from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from './longtail-shared/ManageShared.module.css';
import { ManagePageHeader, ManageSectionCard, getManageStatusVariant } from './longtail-shared/components';

const SOURCE_TYPE_OPTIONS = [
  { value: 'Emby', label: 'Emby' },
  { value: 'AppleCms', label: 'Apple CMS' },
  { value: 'WebDav', label: 'WebDAV' },
];

const AUTH_METHOD_OPTIONS = [
  { value: 'None', label: '无认证' },
  { value: 'UsernamePassword', label: '用户名密码' },
  { value: 'ApiKey', label: 'API Key' },
];

const STATUS_LABELS: Record<string, string> = {
  healthy: '健康',
  unhealthy: '异常',
  disabled: '已停用',
  unknown: '未知',
};

interface SourceFormState {
  name: string;
  sourceType: string;
  baseUrl: string;
  authMethod: string;
  username: string;
  password: string;
  apiKey: string;
  userAgent: string;
  referer: string;
  enabled: boolean;
}

function createInitialFormState(): SourceFormState {
  return {
    name: '',
    sourceType: 'Emby',
    baseUrl: '',
    authMethod: 'UsernamePassword',
    username: '',
    password: '',
    apiKey: '',
    userAgent: '',
    referer: '',
    enabled: true,
  };
}

function buildFormStateFromRecord(record: UpstreamSourceRecord): SourceFormState {
  return {
    name: record.name,
    sourceType: record.sourceType,
    baseUrl: record.baseUrl,
    authMethod: record.authMethod,
    username: record.username ?? '',
    password: '',
    apiKey: '',
    userAgent: record.userAgent ?? '',
    referer: record.referer ?? '',
    enabled: record.status !== 'disabled',
  };
}

function toWriteInput(s: SourceFormState, isEdit: boolean): UpstreamSourceWriteInput {
  return {
    name: s.name.trim(),
    sourceType: s.sourceType,
    baseUrl: s.baseUrl.trim(),
    authMethod: s.authMethod,
    username: s.username.trim() || undefined,
    password: s.password || undefined,
    apiKey: s.apiKey || undefined,
    userAgent: s.userAgent.trim() || undefined,
    referer: s.referer.trim() || undefined,
    retainSecret: isEdit && !s.password && !s.apiKey,
    enabled: s.enabled,
  };
}

function formatEpochMs(epochMs: number | null): string {
  if (epochMs == null || !Number.isFinite(epochMs) || epochMs <= 0) {
    return '—';
  }
  return new Date(epochMs).toLocaleString('zh-CN', { hour12: false });
}

export function ManageUpstreamsPage() {
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
    mutationFn: (input: UpstreamSourceWriteInput) => upstreamsApi.create(input),
    onSuccess: () => {
      setBanner('上游源已创建。');
      setFormOpen(false);
      invalidate();
    },
    onError: (e) => setBanner(getErrorMessage(e)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpstreamSourceWriteInput }) =>
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
    onSuccess: (r) => {
      setBanner(`局域网发现完成：找到 ${r.items.length} 个 Emby 服务。`);
    },
    onError: (e) => setBanner(getErrorMessage(e)),
  });

  const sources = listQuery.data?.items ?? [];

  if (listQuery.isPending) {
    return (
      <FeedbackState
        variant="loading"
        title="正在加载上游源"
        description="正在同步上游源配置、探活状态与凭据密封信息。"
      />
    );
  }

  if (listQuery.isError) {
    if (isUpstreamsUnwiredError(listQuery.error)) {
      return (
        <div className={styles.page}>
          <ManagePageHeader title="上游源" description="Emby / Apple CMS / WebDAV 等上游源的接入配置与探活。" />
          <ManageSectionCard title="上游源端口未装配" description="GET /api/manage/upstreams 当前不可用。">
            <InlineBanner variant="info" title="等待后端装配" description="上游源端点尚未提供或端口未注入。本页不伪造空列表。" />
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => void listQuery.refetch()}
            >
              重新检测
            </button>
          </ManageSectionCard>
        </div>
      );
    }
    return (
      <FeedbackState
        variant="error"
        title="上游源加载失败"
        description={getErrorMessage(listQuery.error)}
        action={
          <button className={styles.primaryButton} type="button" onClick={() => listQuery.refetch()}>
            重试
          </button>
        }
      />
    );
  }

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
    <div className={styles.page}>
      <ManagePageHeader
        title="上游源"
        description="Emby / Apple CMS / WebDAV 等上游源的接入配置、探活与启用状态。"
        meta={<span className={styles.metaText}>当前共 {sources.length} 个上游源</span>}
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
      />

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

      <ManageSectionCard title="上游源列表" description="读接口只回 has_secret，永不回显明文凭据。">
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

      <Dialog
        open={formOpen}
        eyebrow={editing ? '编辑上游源' : '新建上游源'}
        title={editing ? `编辑：${editing.name}` : '新建上游源'}
        description="地址与认证方式必填；密码/API Key 由后端密封，读接口永不回显。"
        onOpenChange={(open) => {
          if (!open) setFormOpen(false);
        }}
        footer={
          <>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => setFormOpen(false)}
              disabled={isFormPending}
            >
              取消
            </button>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={submitForm}
              disabled={isFormPending || !formState.name.trim() || !formState.baseUrl.trim()}
            >
              {isFormPending ? '保存中…' : editing ? '保存修改' : '创建源'}
            </button>
          </>
        }
      >
        <div className={styles.fieldGroup}>
          <label className={styles.label}>
            名称（必填）
            <input
              className={styles.input}
              value={formState.name}
              onChange={(e) => setFormState((s) => ({ ...s, name: e.target.value }))}
              placeholder="例如：家庭 Emby"
            />
          </label>
          <label className={styles.label}>
            地址（必填）
            <input
              className={styles.input}
              value={formState.baseUrl}
              onChange={(e) => setFormState((s) => ({ ...s, baseUrl: e.target.value }))}
              placeholder="http://192.168.1.10:8096"
            />
          </label>
          <div className={styles.fieldRow}>
            <label className={styles.label}>
              类型
              <select
                className={styles.select}
                value={formState.sourceType}
                onChange={(e) => setFormState((s) => ({ ...s, sourceType: e.target.value }))}
              >
                {SOURCE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className={styles.label}>
              认证方式
              <select
                className={styles.select}
                value={formState.authMethod}
                onChange={(e) => setFormState((s) => ({ ...s, authMethod: e.target.value }))}
              >
                {AUTH_METHOD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>
          {formState.authMethod === 'UsernamePassword' ? (
            <div className={styles.fieldRow}>
              <label className={styles.label}>
                用户名
                <input
                  className={styles.input}
                  value={formState.username}
                  onChange={(e) => setFormState((s) => ({ ...s, username: e.target.value }))}
                />
              </label>
              <label className={styles.label}>
                密码{editing ? '（留空保留既有）' : ''}
                <input
                  className={styles.input}
                  type="password"
                  autoComplete="new-password"
                  value={formState.password}
                  onChange={(e) => setFormState((s) => ({ ...s, password: e.target.value }))}
                />
              </label>
            </div>
          ) : null}
          {formState.authMethod === 'ApiKey' ? (
            <label className={styles.label}>
              API Key{editing ? '（留空保留既有）' : ''}
              <input
                className={styles.input}
                type="password"
                autoComplete="new-password"
                value={formState.apiKey}
                onChange={(e) => setFormState((s) => ({ ...s, apiKey: e.target.value }))}
              />
            </label>
          ) : null}
          <div className={styles.fieldRow}>
            <label className={styles.label}>
              User-Agent（可选）
              <input
                className={styles.input}
                value={formState.userAgent}
                onChange={(e) => setFormState((s) => ({ ...s, userAgent: e.target.value }))}
              />
            </label>
            <label className={styles.label}>
              Referer（可选）
              <input
                className={styles.input}
                value={formState.referer}
                onChange={(e) => setFormState((s) => ({ ...s, referer: e.target.value }))}
              />
            </label>
          </div>
        </div>
      </Dialog>

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
    </div>
  );
}

export default ManageUpstreamsPage;
