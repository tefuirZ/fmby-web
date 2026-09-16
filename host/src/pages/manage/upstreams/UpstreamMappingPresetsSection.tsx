import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  upstreamsApi,
  type UpstreamMappingPresetRecord,
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
import styles from '../longtail-shared/ManageShared.module.css';
import { ManageSectionCard } from '../longtail-shared/components';
import { LIBRARY_TYPE_OPTIONS, formatEpochMs, parseListInput } from './shared';

interface PresetFormState {
  name: string;
  includeKeywordsText: string;
  excludeKeywordsText: string;
  includeCategoryIdsText: string;
  excludeCategoryIdsText: string;
  defaultLibraryType: string;
  createMissingLibraries: boolean;
  enabled: boolean;
}

function createInitialFormState(): PresetFormState {
  return {
    name: '',
    includeKeywordsText: '',
    excludeKeywordsText: '',
    includeCategoryIdsText: '',
    excludeCategoryIdsText: '',
    defaultLibraryType: 'Movie',
    createMissingLibraries: true,
    enabled: true,
  };
}

function buildFormStateFromRecord(r: UpstreamMappingPresetRecord): PresetFormState {
  return {
    name: r.name,
    includeKeywordsText: r.includeKeywords.join(','),
    excludeKeywordsText: r.excludeKeywords.join(','),
    includeCategoryIdsText: r.includeCategoryIds.join(','),
    excludeCategoryIdsText: r.excludeCategoryIds.join(','),
    defaultLibraryType: r.defaultLibraryType,
    createMissingLibraries: r.createMissingLibraries,
    enabled: r.enabled,
  };
}

/** 映射预设 CRUD（CRUD + wizard.Dismiss 撤回）。 */
export function UpstreamMappingPresetsSection({ sourceId }: { sourceId: string }) {
  const queryClient = useQueryClient();
  const [banner, setBanner] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UpstreamMappingPresetRecord | null>(null);
  const [formState, setFormState] = useState<PresetFormState>(createInitialFormState);
  const [pendingDelete, setPendingDelete] = useState<UpstreamMappingPresetRecord | null>(null);

  const presetsKey = queryKeys.manage.upstreams.presets(sourceId);
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: presetsKey });

  const presetsQuery = useQuery({
    queryKey: presetsKey,
    queryFn: () => upstreamsApi.listPresets(sourceId),
  });

  const createMutation = useMutation({
    mutationFn: () => upstreamsApi.createPreset(sourceId, fromFormState(formState)),
    onSuccess: () => {
      setBanner('预设已创建。');
      setFormOpen(false);
      invalidate();
    },
    onError: (e) => setBanner(getErrorMessage(e)),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('缺少预设 ID');
      return upstreamsApi.updatePreset(sourceId, editing.id, fromFormState(formState));
    },
    onSuccess: () => {
      setBanner('预设已更新。');
      setFormOpen(false);
      invalidate();
    },
    onError: (e) => setBanner(getErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (presetId: string) => upstreamsApi.deletePreset(sourceId, presetId),
    onSuccess: () => {
      setBanner('预设已删除。');
      invalidate();
    },
    onError: (e) => setBanner(getErrorMessage(e)),
  });

  const presets = presetsQuery.data?.items ?? [];
  const isFormPending = createMutation.isPending || updateMutation.isPending;

  if (presetsQuery.isPending) {
    return <FeedbackState variant="loading" title="正在加载映射预设" description="正在读取该源的映射预设。" />;
  }

  if (presetsQuery.isError) {
    return (
      <FeedbackState
        variant="error"
        title="映射预设加载失败"
        description={getErrorMessage(presetsQuery.error)}
        action={
          <button className={styles.primaryButton} type="button" onClick={() => presetsQuery.refetch()}>
            重试
          </button>
        }
      />
    );
  }

  function openCreate() {
    setEditing(null);
    setFormState(createInitialFormState());
    setFormOpen(true);
  }

  function openEdit(record: UpstreamMappingPresetRecord) {
    setEditing(record);
    setFormState(buildFormStateFromRecord(record));
    setFormOpen(true);
  }

  function submitForm() {
    if (editing) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  }

  return (
    <>
      {banner ? <InlineBanner variant="info" title={banner} description="操作结果。" /> : null}

      <ManageSectionCard
        title="映射预设"
        description="预设决定「哪些上游类目映射到本地哪个库」；关键词与类目 ID 用英文逗号分隔。"
        actions={
          <button className={styles.primaryButton} type="button" onClick={openCreate}>
            新建预设
          </button>
        }
      >
        {presets.length === 0 ? (
          <div className={styles.emptyInlineState}>还没有任何映射预设，先从右上角新建一个。</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>名称</th>
                  <th>包含关键词</th>
                  <th>排除关键词</th>
                  <th>默认库类型</th>
                  <th>自动建库</th>
                  <th>启用</th>
                  <th>更新时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {presets.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td className={styles.mutedText}>{p.includeKeywords.join('、') || '—'}</td>
                    <td className={styles.mutedText}>{p.excludeKeywords.join('、') || '—'}</td>
                    <td>{p.defaultLibraryType}</td>
                    <td>{p.createMissingLibraries ? '是' : '否'}</td>
                    <td>
                      <StatusBadge label={p.enabled ? '启用' : '停用'} variant={p.enabled ? 'success' : 'neutral'} />
                    </td>
                    <td className="nowrap">{formatEpochMs(p.updatedAt)}</td>
                    <td className="nowrap">
                      <button type="button" className={styles.smallButton} onClick={() => openEdit(p)}>
                        编辑
                      </button>
                      <button
                        type="button"
                        className={styles.smallDangerButton}
                        onClick={() => setPendingDelete(p)}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ManageSectionCard>

      <Dialog
        open={formOpen}
        eyebrow={editing ? '编辑预设' : '新建预设'}
        title={editing ? `编辑：${editing.name}` : '新建映射预设'}
        description="名称必填；关键词/类目 ID 支持逗号分隔多值。"
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
              disabled={isFormPending || !formState.name.trim()}
            >
              {isFormPending ? '保存中…' : editing ? '保存修改' : '创建预设'}
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
              placeholder="例如：电影库同步"
            />
          </label>
          <div className={styles.fieldRow}>
            <label className={styles.label}>
              包含关键词
              <input
                className={styles.input}
                value={formState.includeKeywordsText}
                onChange={(e) => setFormState((s) => ({ ...s, includeKeywordsText: e.target.value }))}
                placeholder="电影, Movies"
              />
            </label>
            <label className={styles.label}>
              排除关键词
              <input
                className={styles.input}
                value={formState.excludeKeywordsText}
                onChange={(e) => setFormState((s) => ({ ...s, excludeKeywordsText: e.target.value }))}
                placeholder="预告, Trailer"
              />
            </label>
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.label}>
              包含类目 ID
              <input
                className={styles.input}
                value={formState.includeCategoryIdsText}
                onChange={(e) => setFormState((s) => ({ ...s, includeCategoryIdsText: e.target.value }))}
              />
            </label>
            <label className={styles.label}>
              排除类目 ID
              <input
                className={styles.input}
                value={formState.excludeCategoryIdsText}
                onChange={(e) => setFormState((s) => ({ ...s, excludeCategoryIdsText: e.target.value }))}
              />
            </label>
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.label}>
              默认库类型
              <select
                className={styles.select}
                value={formState.defaultLibraryType}
                onChange={(e) => setFormState((s) => ({ ...s, defaultLibraryType: e.target.value }))}
              >
                {LIBRARY_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={formState.createMissingLibraries}
              onChange={(e) => setFormState((s) => ({ ...s, createMissingLibraries: e.target.checked }))}
            />
            缺失时自动创建本地库
          </label>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={formState.enabled}
              onChange={(e) => setFormState((s) => ({ ...s, enabled: e.target.checked }))}
            />
            启用该预设
          </label>
        </div>
      </Dialog>

      <SensitiveActionDialog
        open={pendingDelete !== null}
        actionKey="delete-upstream-mapping-preset"
        title={pendingDelete ? `删除预设：${pendingDelete.name}` : ''}
        description="删除预设不会影响已应用的映射结果，但后续同步将不再套用该规则。"
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

function fromFormState(s: PresetFormState) {
  return {
    name: s.name.trim(),
    includeKeywords: parseListInput(s.includeKeywordsText),
    excludeKeywords: parseListInput(s.excludeKeywordsText),
    includeCategoryIds: parseListInput(s.includeCategoryIdsText),
    excludeCategoryIds: parseListInput(s.excludeCategoryIdsText),
    defaultLibraryType: s.defaultLibraryType,
    createMissingLibraries: s.createMissingLibraries,
    enabled: s.enabled,
  };
}
