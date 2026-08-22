import { startTransition } from 'react';
import { RotateCcw, Save, Wand2 } from 'lucide-react';

import { ConfirmDialog } from '@fmby/v2-shared/ui';
import { FeedbackState } from '@fmby/v2-shared/ui';
import { InlineBanner } from '@fmby/v2-shared/ui';
import { StatusBadge } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';

import sharedStyles from './longtail-shared/ManageShared.module.css';
import styles from './ManageNamingRulesPage.module.css';
import { ManagePageHeader } from './longtail-shared/components';
import { buildScrapeDraftKey, normalizeScrapeDraftForSubmit, toScrapeDraft } from './naming-rules/formUtils';
import {
  useLibrariesQueryForNaming,
  useNamingPreviewQuery,
  useNamingRulesMutations,
  useNamingRulesPageActions,
  useNamingRulesPageState,
  useNamingRulesSettingsQuery,
} from './naming-rules/hooks';
import {
  NamingRulesCustomTermsSection,
  NamingRulesDefaultTermsSection,
  NamingRulesMetrics,
  NamingRulesPreviewSection,
  NamingRulesProtectedTermsSection,
  NamingRulesReplayConfirm,
  NamingRulesReplaySection,
  NamingRulesSignalGrid,
  NamingRulesStickyBar,
} from './naming-rules/components';
import {
  NamingScrapeBatchRepairSection,
  NamingScrapeStrategySection,
} from './naming-rules/scrape-sections';

export function ManageNamingRulesPage() {
  const settingsQuery = useNamingRulesSettingsQuery();
  const librariesQuery = useLibrariesQueryForNaming();

  const state = useNamingRulesPageState(
    settingsQuery.data,
    librariesQuery.data?.items,
  );

  const previewQuery = useNamingPreviewQuery(
    state.debouncedPreviewPath,
    state.previewLibraryType,
    state.normalizedDraft,
    Boolean(state.savedSettings && state.debouncedPreviewPath && state.normalizedDraft),
  );

  const { saveMutation, replayMutation, batchRepairMutation } = useNamingRulesMutations({
    onSaveSuccess: (message) => {
      state.setBanner({
        variant: 'success',
        title: message,
        description:
          '新的语言、标题来源、海报策略和清洗规则已经写入服务端，后续识别/刮削任务会按这套设置跑。',
      });
      if (settingsQuery.data) {
        startTransition(() => {
          state.setSavedSettings(settingsQuery.data);
          state.setDraft(toScrapeDraft(settingsQuery.data));
          state.setIsDraftHydrated(true);
        });
      }
    },
    onSaveError: (message) => {
      state.setBanner({ variant: 'error', title: '命名刮削设置保存失败', description: message });
    },
    onReplaySuccess: (message) => {
      state.setReplayConfirmOpen(false);
      state.setBanner({ variant: 'success', title: '历史识别重排已入队', description: message });
    },
    onReplayError: (message) => {
      state.setBanner({ variant: 'error', title: '历史识别重排失败', description: message });
    },
    onBatchRepairSuccess: (message) => {
      state.setBatchRepairConfirmOpen(false);
      state.setBanner({ variant: 'success', title: '缺失元数据 / 海报补刮已入队', description: message });
    },
    onBatchRepairError: (message) => {
      state.setBanner({ variant: 'error', title: '批量补刮失败', description: message });
    },
  });

  const savedDraftKey = state.savedSettings ? buildScrapeDraftKey(toScrapeDraft(state.savedSettings)) : '';
  const draftKey = buildScrapeDraftKey(state.draft);
  const isDirty = draftKey !== savedDraftKey;

  const actions = useNamingRulesPageActions(
    state.draft,
    state.setDraft,
    state.savedSettings,
    state.setBanner,
    state.protectedTermInput,
    state.setProtectedTermInput,
    state.replayScope,
    state.selectedLibraryId,
    state.setReplayConfirmOpen,
    state.batchRepairDraft,
    state.setBatchRepairConfirmOpen,
    isDirty,
    saveMutation.isPending,
  );

  if (settingsQuery.isError) {
    return (
      <FeedbackState
        variant="error"
        title="命名刮削设置加载失败"
        description={getErrorMessage(settingsQuery.error)}
        action={
          <button className={sharedStyles.primaryButton} onClick={() => settingsQuery.refetch()}>
            重试
          </button>
        }
      />
    );
  }

  if (settingsQuery.isPending || !state.savedSettings || !state.isDraftHydrated) {
    return (
      <FeedbackState
        variant="loading"
        title="正在装载命名刮削策略"
        description="正在同步语言偏好、标题来源、海报策略和清洗规则。"
      />
    );
  }

  const defaultTerms = state.savedSettings.cleanup.defaultTerms;
  const disabledDefaultTermSet = new Set(state.draft.cleanup.disabledDefaultTerms);
  const protectedTermSet = new Set(state.draft.cleanup.protectedTerms);
  const filteredDefaultTerms = defaultTerms.filter((term) =>
    !state.deferredDefaultSearch
      ? true
      : term.toLocaleLowerCase('zh-CN').includes(state.deferredDefaultSearch),
  );
  const activeDefaultCount = defaultTerms.filter((term) => !disabledDefaultTermSet.has(term)).length;
  const enabledCustomCount = state.draft.cleanup.customTerms.filter(
    (item) => item.enabled && item.term.trim().length > 0,
  ).length;
  const previewRulePackVersion =
    previewQuery.data?.rulePackVersion ?? state.savedSettings.cleanup.rulePackVersion;
  const selectedLibrary = librariesQuery.data?.items.find((item) => item.id === state.selectedLibraryId);
  const replayResult = replayMutation.data;
  const replayBlockedByDirty = isDirty || saveMutation.isPending;
  const canTriggerReplay =
    !replayBlockedByDirty &&
    !replayMutation.isPending &&
    (state.replayScope === 'all' || Boolean(state.selectedLibraryId));
  const batchRepairScope = state.batchRepairDraft.scope;
  const batchRepairLibraryName =
    batchRepairScope === 'library' ? selectedLibrary?.name : undefined;
  const canTriggerBatchRepair =
    !saveMutation.isPending &&
    !batchRepairMutation.isPending &&
    (state.batchRepairDraft.includeMissingMetadata || state.batchRepairDraft.includeMissingPoster) &&
    (batchRepairScope === 'all' || Boolean(state.selectedLibraryId));

  const saveDraft = () => {
    saveMutation.mutate(normalizeScrapeDraftForSubmit(state.draft));
  };

  const confirmReplay = () => {
    replayMutation.mutate({
      scope: state.replayScope,
      libraryId: state.replayScope === 'library' ? state.selectedLibraryId : undefined,
    });
  };

  const confirmBatchRepair = () => {
    batchRepairMutation.mutate({
      ...state.batchRepairDraft,
      libraryId: state.batchRepairDraft.scope === 'library' ? state.selectedLibraryId : undefined,
    });
  };

  const metrics = [
    {
      label: '元数据语言',
      value: state.draft.metadataLanguage.length,
      trend: state.draft.metadataLanguage,
      status: 'healthy',
    },
    {
      label: '主元数据源',
      value: state.draft.metadataSource === 'douban' ? 2 : 1,
      trend: state.draft.metadataSource === 'douban' ? '豆瓣主元数据' : 'TMDB 主元数据',
      status: state.draft.metadataSource === 'douban' ? 'info' : 'healthy',
    },
    {
      label: '海报策略',
      value:
        state.draft.posterLanguageMode === 'metadata'
          ? 1
          : state.draft.posterLanguageMode === 'original'
            ? 2
            : 3,
      trend:
        state.draft.posterLanguageMode === 'metadata'
          ? '跟随元数据语言'
          : state.draft.posterLanguageMode === 'original'
            ? '优先原始语言'
            : '接受任意语言',
      status: 'info',
    },
    {
      label: '启用自定义词',
      value: enabledCustomCount,
      trend: `${state.draft.cleanup.customTerms.length} 条自定义规则`,
      status: enabledCustomCount > 0 ? 'healthy' : 'attention',
    },
  ];

  return (
    <div className={sharedStyles.page}>
      <ManagePageHeader
        title="命名刮削设置"
        description="这页收口命名清洗、识别后自动刮削、主元数据来源、元数据语言和缺失海报补刮。数据库是元数据真相源，海报会落本地缓存，不再只存一条屁用没有的外链。"
        meta={
          <div className={sharedStyles.metaRow}>
            <StatusBadge label="TMDB 主链路已接通" variant="success" />
            <StatusBadge
              label={state.draft.metadataSource === 'douban' ? '豆瓣主元数据已启用' : 'TMDB 主元数据'}
              variant={state.draft.metadataSource === 'douban' ? 'info' : 'success'}
            />
            <StatusBadge
              label={isDirty ? '存在未保存修改' : '设置已同步'}
              variant={isDirty ? 'warning' : 'info'}
            />
            <span className={sharedStyles.metaText}>
              当前清洗规则版本：{state.savedSettings.cleanup.rulePackVersion}
            </span>
          </div>
        }
        actions={
          <div className={sharedStyles.headerActions}>
            <button
              className={sharedStyles.ghostButton}
              disabled={!isDirty || saveMutation.isPending}
              onClick={actions.resetDraftToSaved}
            >
              <RotateCcw size={16} />
              重置未保存
            </button>
            <button className={sharedStyles.secondaryButton} onClick={actions.resetToDefaults}>
              <Wand2 size={16} />
              恢复默认草稿
            </button>
            <button
              className={sharedStyles.primaryButton}
              disabled={!isDirty || saveMutation.isPending}
              onClick={saveDraft}
            >
              <Save size={16} />
              {saveMutation.isPending ? '保存中…' : '保存设置'}
            </button>
          </div>
        }
      />

      {state.banner ? (
        <InlineBanner
          variant={state.banner.variant}
          title={state.banner.title}
          description={state.banner.description}
        />
      ) : null}

      <NamingRulesMetrics metrics={metrics} />
      <NamingRulesSignalGrid />

      <NamingScrapeStrategySection
        draft={state.draft}
        onDraftChange={actions.updateDraft}
        selectedLibraryName={selectedLibrary?.name}
      />

      <NamingRulesPreviewSection
        previewPath={state.previewPath}
        onPreviewPathChange={state.setPreviewPath}
        previewLibraryType={state.previewLibraryType}
        onPreviewLibraryTypeChange={state.setPreviewLibraryType}
        previewRulePackVersion={previewRulePackVersion}
        previewQuery={previewQuery}
      />

      <NamingRulesReplaySection
        replayScope={state.replayScope}
        onReplayScopeChange={(value) => {
          state.setReplayScope(value);
        }}
        selectedLibraryId={state.selectedLibraryId}
        onSelectedLibraryIdChange={(value) => {
          state.setSelectedLibraryId(value);
          state.setBatchRepairDraft((current) => ({ ...current, libraryId: value }));
        }}
        librariesState={{
          isPending: librariesQuery.isPending,
          isError: librariesQuery.isError,
          error: librariesQuery.error,
          items: librariesQuery.data?.items ?? [],
        }}
        selectedLibrary={selectedLibrary}
        savedRulePackVersion={state.savedSettings.cleanup.rulePackVersion}
        replayBlockedByDirty={replayBlockedByDirty}
        replayResult={replayResult}
        canTriggerReplay={canTriggerReplay}
        onTriggerReplay={actions.triggerReplay}
      />

      <NamingScrapeBatchRepairSection
        draft={state.batchRepairDraft}
        onDraftChange={state.setBatchRepairDraft}
        selectedLibraryId={state.selectedLibraryId}
        onSelectedLibraryIdChange={(value) => {
          state.setSelectedLibraryId(value);
          state.setBatchRepairDraft((current) => ({ ...current, libraryId: value }));
        }}
        selectedLibraryName={selectedLibrary?.name}
        librariesState={{
          isPending: librariesQuery.isPending,
          isError: librariesQuery.isError,
          error: librariesQuery.error,
          items: librariesQuery.data?.items ?? [],
        }}
        mutationResult={batchRepairMutation.data}
        pending={batchRepairMutation.isPending}
        canTrigger={canTriggerBatchRepair}
        onTrigger={actions.triggerBatchRepair}
      />

      <details
        className={styles.collapseCard}
        open={state.cleanupPanelOpen}
        onToggle={(event) => state.setCleanupPanelOpen((event.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className={styles.collapseSummary}>
          <div>
            <div className={styles.signalEyebrow}>清洗规则</div>
            <strong>展开后再编辑默认词、自定义词和保留词</strong>
            <p>清洗规则继续保留，但不再把整页塞满。要改的时候再展开，页面才不至于像杂货铺。</p>
          </div>
          <StatusBadge
            label={state.cleanupPanelOpen ? '已展开' : '已折叠'}
            variant={state.cleanupPanelOpen ? 'info' : 'success'}
          />
        </summary>

        <div className={styles.collapseBody}>
          <details
            className={styles.collapseInner}
            open={state.cleanupDefaultTermsOpen}
            onToggle={(event) =>
              state.setCleanupDefaultTermsOpen((event.currentTarget as HTMLDetailsElement).open)
            }
          >
            <summary className={styles.collapseInnerSummary}>
              <strong>默认噪音词</strong>
              <span>
                启用中 {activeDefaultCount} 个，已禁用 {state.draft.cleanup.disabledDefaultTerms.length} 个
              </span>
            </summary>
            <div className={styles.collapseInnerBody}>
              <NamingRulesDefaultTermsSection
                defaultSearch={state.defaultSearch}
                onDefaultSearchChange={state.setDefaultSearch}
                defaultTerms={defaultTerms}
                filteredDefaultTerms={filteredDefaultTerms}
                activeDefaultCount={activeDefaultCount}
                disabledDefaultTermCount={state.draft.cleanup.disabledDefaultTerms.length}
                disabledDefaultTermSet={disabledDefaultTermSet}
                protectedTermSet={protectedTermSet}
                onToggleDefaultTerm={actions.toggleDefaultTerm}
              />
            </div>
          </details>

          <NamingRulesCustomTermsSection
            customTerms={state.draft.cleanup.customTerms}
            onAddCustomTerm={actions.addCustomTerm}
            onUpdateCustomTerm={actions.updateCustomTerm}
            onRemoveCustomTerm={actions.removeCustomTerm}
          />
          <NamingRulesProtectedTermsSection
            protectedTermInput={state.protectedTermInput}
            onProtectedTermInputChange={state.setProtectedTermInput}
            onAddProtectedTerm={actions.addProtectedTerm}
            protectedTerms={state.draft.cleanup.protectedTerms}
            onRemoveProtectedTerm={actions.removeProtectedTerm}
          />
        </div>
      </details>

      {isDirty || saveMutation.isPending ? (
        <NamingRulesStickyBar
          isSaving={saveMutation.isPending}
          onReset={actions.resetDraftToSaved}
          onSave={saveDraft}
        />
      ) : null}

      <NamingRulesReplayConfirm
        open={state.replayConfirmOpen}
        replayScope={state.replayScope}
        selectedLibraryName={selectedLibrary?.name}
        isPending={replayMutation.isPending}
        error={replayMutation.isError ? replayMutation.error : undefined}
        onOpenChange={state.setReplayConfirmOpen}
        onConfirm={confirmReplay}
      />

      <ConfirmDialog
        open={state.batchRepairConfirmOpen}
        title="确认批量补刮缺失项"
        description={
          batchRepairScope === 'all'
            ? '这会只针对缺元数据 / 缺海报的媒体重新入队 scrape，不做全量乱刷。'
            : `这会只针对 ${batchRepairLibraryName ?? '所选媒体库'} 中缺元数据 / 缺海报的媒体重新入队 scrape。`
        }
        impact={[
          batchRepairScope === 'all'
            ? '范围：全部媒体库'
            : `范围：${batchRepairLibraryName ?? '所选媒体库'}`,
          state.batchRepairDraft.includeMissingMetadata
            ? '会补刮缺失元数据的媒体。'
            : '不会动已有元数据完整的媒体。',
          state.batchRepairDraft.includeMissingPoster
            ? '会补刮缺失海报的媒体。'
            : '不会动已有海报完整的媒体。',
        ]}
        errorMessage={
          batchRepairMutation.isError ? getErrorMessage(batchRepairMutation.error) : undefined
        }
        confirmLabel="确认补刮"
        onOpenChange={state.setBatchRepairConfirmOpen}
        onConfirm={confirmBatchRepair}
        pending={batchRepairMutation.isPending}
      />
    </div>
  );
}

export default ManageNamingRulesPage;
