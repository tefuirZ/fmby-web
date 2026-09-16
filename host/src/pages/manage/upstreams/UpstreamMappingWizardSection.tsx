import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  upstreamsApi,
  type UpstreamMappingPreviewInput,
  type UpstreamMappingPreviewResult,
} from '@fmby/v2-shared/contracts/manage/upstreams';
import { queryKeys } from '@fmby/v2-shared/query';
import {
  InlineBanner,
  SensitiveActionDialog,
  StatusBadge,
} from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from '../longtail-shared/ManageShared.module.css';
import { EmptyTableRow, ManageSectionCard, getManageStatusVariant } from '../longtail-shared/components';
import { LIBRARY_TYPE_OPTIONS, MAPPING_ACTION_LABELS, parseListInput } from './shared';

interface WizardState {
  presetId: string;
  includeKeywordsText: string;
  excludeKeywordsText: string;
  includeCategoryIdsText: string;
  excludeCategoryIdsText: string;
  defaultLibraryType: string;
  createMissingLibraries: boolean;
}

function createInitialWizardState(): WizardState {
  return {
    presetId: '',
    includeKeywordsText: '',
    excludeKeywordsText: '',
    includeCategoryIdsText: '',
    excludeCategoryIdsText: '',
    defaultLibraryType: 'Movie',
    createMissingLibraries: true,
  };
}

function toPreviewInput(s: WizardState): UpstreamMappingPreviewInput {
  return {
    presetId: s.presetId || undefined,
    includeKeywords: parseListInput(s.includeKeywordsText),
    excludeKeywords: parseListInput(s.excludeKeywordsText),
    includeCategoryIds: parseListInput(s.includeCategoryIdsText),
    excludeCategoryIds: parseListInput(s.excludeCategoryIdsText),
    defaultLibraryType: s.defaultLibraryType,
    createMissingLibraries: s.createMissingLibraries,
    overrides: [],
  };
}

/** 映射预览与应用（两段式：先预览纯计算，再确认应用落库）。 */
export function UpstreamMappingWizardSection({ sourceId }: { sourceId: string }) {
  const queryClient = useQueryClient();
  const [wizard, setWizard] = useState<WizardState>(createInitialWizardState);
  const [banner, setBanner] = useState<string | null>(null);
  const [preview, setPreview] = useState<UpstreamMappingPreviewResult | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [savePresetName, setSavePresetName] = useState('');

  const presetsQuery = useQuery({
    queryKey: queryKeys.manage.upstreams.presets(sourceId),
    queryFn: () => upstreamsApi.listPresets(sourceId),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.manage.upstreams.presets(sourceId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.manage.upstreams.bindings() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.manage.libraries.list() });
  };

  const previewMutation = useMutation({
    mutationFn: () => upstreamsApi.previewMapping(sourceId, toPreviewInput(wizard)),
    onSuccess: (r) => {
      setPreview(r);
      setBanner(`预览完成：绑定 ${r.bindCount} / 新建 ${r.createCount} / 跳过 ${r.skipCount} / 冲突 ${r.conflictCount}。`);
    },
    onError: (e) => {
      setPreview(null);
      setBanner(getErrorMessage(e));
    },
  });

  const applyMutation = useMutation({
    mutationFn: () =>
      upstreamsApi.applyMapping(sourceId, toPreviewInput(wizard), savePresetName.trim() || undefined),
    onSuccess: (r) => {
      setBanner(`应用完成：新建库 ${r.createdLibraryCount} 个，绑定类目 ${r.boundCategoryCount} 个。`);
      setApplyOpen(false);
      setPreview(null);
      invalidate();
    },
    onError: (e) => setBanner(getErrorMessage(e)),
  });

  const presets = presetsQuery.data?.items ?? [];

  function usePreset(presetId: string) {
    const p = presets.find((x) => x.id === presetId);
    if (!p) {
      setWizard((s) => ({ ...s, presetId }));
      return;
    }
    setWizard({
      presetId: p.id,
      includeKeywordsText: p.includeKeywords.join(','),
      excludeKeywordsText: p.excludeKeywords.join(','),
      includeCategoryIdsText: p.includeCategoryIds.join(','),
      excludeCategoryIdsText: p.excludeCategoryIds.join(','),
      defaultLibraryType: p.defaultLibraryType,
      createMissingLibraries: p.createMissingLibraries,
    });
  }

  return (
    <>
      {banner ? <InlineBanner variant="info" title={banner} description="操作结果。" /> : null}

      <ManageSectionCard
        title="映射预览"
        description="预览为纯计算、不写库；确认无误后再「应用」落库（不可逆）。"
        actions={
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => previewMutation.mutate()}
            disabled={previewMutation.isPending}
          >
            {previewMutation.isPending ? '预览中…' : '生成预览'}
          </button>
        }
      >
        <div className={styles.fieldGroup}>
          <label className={styles.label}>
            套用预设（可选）
            <select
              className={styles.select}
              value={wizard.presetId}
              onChange={(e) => usePreset(e.target.value)}
            >
              <option value="">（自定义条件）</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <div className={styles.fieldRow}>
            <label className={styles.label}>
              包含关键词
              <input
                className={styles.input}
                value={wizard.includeKeywordsText}
                onChange={(e) => setWizard((s) => ({ ...s, includeKeywordsText: e.target.value }))}
              />
            </label>
            <label className={styles.label}>
              排除关键词
              <input
                className={styles.input}
                value={wizard.excludeKeywordsText}
                onChange={(e) => setWizard((s) => ({ ...s, excludeKeywordsText: e.target.value }))}
              />
            </label>
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.label}>
              包含类目 ID
              <input
                className={styles.input}
                value={wizard.includeCategoryIdsText}
                onChange={(e) => setWizard((s) => ({ ...s, includeCategoryIdsText: e.target.value }))}
              />
            </label>
            <label className={styles.label}>
              排除类目 ID
              <input
                className={styles.input}
                value={wizard.excludeCategoryIdsText}
                onChange={(e) => setWizard((s) => ({ ...s, excludeCategoryIdsText: e.target.value }))}
              />
            </label>
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.label}>
              默认库类型
              <select
                className={styles.select}
                value={wizard.defaultLibraryType}
                onChange={(e) => setWizard((s) => ({ ...s, defaultLibraryType: e.target.value }))}
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
              checked={wizard.createMissingLibraries}
              onChange={(e) => setWizard((s) => ({ ...s, createMissingLibraries: e.target.checked }))}
            />
            缺失时自动创建本地库
          </label>
        </div>
      </ManageSectionCard>

      {preview ? <PreviewResultCard preview={preview} /> : null}

      <ManageSectionCard
        title="应用映射"
        description="应用会把预览结果落库：创建缺失库、写入类目绑定。此操作不可逆。"
      >
        <div className={styles.fieldRow}>
          <label className={styles.label}>
            保存为预设名（可选）
            <input
              className={styles.input}
              value={savePresetName}
              onChange={(e) => setSavePresetName(e.target.value)}
              placeholder="留空则不保存预设"
            />
          </label>
        </div>
        <div className={styles.rowActions}>
          <button
            className={styles.dangerButton}
            type="button"
            onClick={() => setApplyOpen(true)}
            disabled={applyMutation.isPending}
          >
            应用映射
          </button>
          <span className={styles.tableHint}>
            {preview ? '基于当前预览结果应用。' : '建议先生成预览再应用。'}
          </span>
        </div>
      </ManageSectionCard>

      <SensitiveActionDialog
        open={applyOpen}
        actionKey="apply-upstream-mapping"
        title="应用映射（不可逆）"
        description="将按当前条件创建缺失的本地库并写入类目绑定。已存在的绑定会被覆盖，操作不可自动撤回。"
        impact={
          preview
            ? [
                `绑定类目 ${preview.bindCount} 个`,
                `新建库 ${preview.createCount} 个`,
                `跳过 ${preview.skipCount} 个`,
                `冲突 ${preview.conflictCount} 个`,
              ]
            : ['尚未生成预览，将直接按当前条件应用。']
        }
        errorMessage={applyMutation.isError ? getErrorMessage(applyMutation.error) : undefined}
        confirmLabel="确认应用"
        pending={applyMutation.isPending}
        onOpenChange={(open) => {
          if (!open && !applyMutation.isPending) setApplyOpen(false);
        }}
        onConfirm={() => applyMutation.mutate()}
      />
    </>
  );
}

function PreviewResultCard({ preview }: { preview: UpstreamMappingPreviewResult }) {
  return (
    <ManageSectionCard
      title="预览结果"
      description={`绑定 ${preview.bindCount} · 新建 ${preview.createCount} · 跳过 ${preview.skipCount} · 冲突 ${preview.conflictCount}`}
    >
      {preview.items.length === 0 ? (
        <div className={styles.emptyInlineState}>没有匹配到任何类目。</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>类目</th>
                <th>动作</th>
                <th>目标库</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              {preview.items.length === 0 ? (
                <EmptyTableRow colSpan={4} title="无预览项" description="" />
              ) : (
                preview.items.map((it) => (
                  <tr key={it.categoryId}>
                    <td>{it.categoryName}</td>
                    <td>
                      <StatusBadge
                        label={MAPPING_ACTION_LABELS[it.action] ?? it.action}
                        variant={getManageStatusVariant(it.action === 'conflict' ? 'error' : it.action === 'create_library' ? 'warning' : 'success')}
                      />
                    </td>
                    <td>{it.libraryName ?? it.createLibraryName ?? '—'}</td>
                    <td className={styles.mutedText}>{it.skipReason ?? it.conflictMessage ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {preview.creates.length > 0 ? (
        <div className={styles.stackText}>
          <span className={styles.mutedText}>建库计划</span>
          <ul>
            {preview.creates.map((c) => (
              <li key={c.key}>
                {c.name}（{c.libraryType}）· {c.categoryIds.length} 个类目
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </ManageSectionCard>
  );
}
