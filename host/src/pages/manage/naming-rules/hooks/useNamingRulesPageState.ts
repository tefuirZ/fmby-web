import { startTransition, useDeferredValue, useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type {
  NamingCleanupCustomTerm,
  NamingCleanupLibraryType,
  NamingCleanupReplayScope,
  NamingScrapeBatchRepairRequest,
  NamingScrapeSettings,
  UpdateNamingScrapeSettingsRequest,
} from '@/domains/manage/naming';
import type { BannerState } from '@/shared/types/ui';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { createEmptyCustomTerm, normalizeCleanupToken } from '../helpers';
import {
  createEmptyScrapeDraft,
  normalizeScrapeDraftForSubmit,
  toScrapeDraft,
} from '../formUtils';

export function useNamingRulesPageState(
  settingsData: NamingScrapeSettings | undefined,
  librariesData: { id: string; name: string }[] | undefined,
) {
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [savedSettings, setSavedSettings] = useState<NamingScrapeSettings | null>(null);
  const [draft, setDraft] = useState<UpdateNamingScrapeSettingsRequest>(() =>
    createEmptyScrapeDraft(),
  );
  const [isDraftHydrated, setIsDraftHydrated] = useState(false);
  const [previewPath, setPreviewPath] = useState('');
  const [previewLibraryType, setPreviewLibraryType] =
    useState<NamingCleanupLibraryType>('movie');
  const [defaultSearch, setDefaultSearch] = useState('');
  const [protectedTermInput, setProtectedTermInput] = useState('');
  const [replayScope, setReplayScope] = useState<NamingCleanupReplayScope>('library');
  const [selectedLibraryId, setSelectedLibraryId] = useState('');
  const [replayConfirmOpen, setReplayConfirmOpen] = useState(false);
  const [cleanupPanelOpen, setCleanupPanelOpen] = useState(false);
  const [cleanupDefaultTermsOpen, setCleanupDefaultTermsOpen] = useState(false);
  const [batchRepairDraft, setBatchRepairDraft] = useState<NamingScrapeBatchRepairRequest>({
    scope: 'library',
    libraryId: undefined,
    includeMissingMetadata: true,
    includeMissingPoster: true,
  });
  const [batchRepairConfirmOpen, setBatchRepairConfirmOpen] = useState(false);

  const deferredDefaultSearch = useDeferredValue(defaultSearch.trim().toLocaleLowerCase('zh-CN'));
  const debouncedPreviewPath = useDebounce(previewPath.trim(), 260);

  // 同步设置数据
  useEffect(() => {
    if (!settingsData) {
      return;
    }
    const nextDraft = toScrapeDraft(settingsData);
    setSavedSettings(settingsData);
    setDraft(nextDraft);
    setBatchRepairDraft((current) => ({
      ...current,
      scope: current.scope,
      libraryId: current.libraryId,
    }));
    setIsDraftHydrated(true);
  }, [settingsData]);

  // 初始化选中的媒体库
  useEffect(() => {
    if (selectedLibraryId || !librariesData?.length) {
      return;
    }
    const nextLibraryId = librariesData[0].id;
    setSelectedLibraryId(nextLibraryId);
    setBatchRepairDraft((current) => ({
      ...current,
      libraryId: nextLibraryId,
    }));
  }, [librariesData, selectedLibraryId]);

  const normalizedDraft = isDraftHydrated ? normalizeScrapeDraftForSubmit(draft) : undefined;

  return {
    banner,
    setBanner,
    savedSettings,
    setSavedSettings,
    draft,
    setDraft,
    isDraftHydrated,
    setIsDraftHydrated,
    previewPath,
    setPreviewPath,
    previewLibraryType,
    setPreviewLibraryType,
    defaultSearch,
    setDefaultSearch,
    protectedTermInput,
    setProtectedTermInput,
    replayScope,
    setReplayScope,
    selectedLibraryId,
    setSelectedLibraryId,
    replayConfirmOpen,
    setReplayConfirmOpen,
    cleanupPanelOpen,
    setCleanupPanelOpen,
    cleanupDefaultTermsOpen,
    setCleanupDefaultTermsOpen,
    batchRepairDraft,
    setBatchRepairDraft,
    batchRepairConfirmOpen,
    setBatchRepairConfirmOpen,
    deferredDefaultSearch,
    debouncedPreviewPath,
    normalizedDraft,
  };
}

export function useNamingRulesPageActions(
  draft: UpdateNamingScrapeSettingsRequest,
  setDraft: Dispatch<SetStateAction<UpdateNamingScrapeSettingsRequest>>,
  savedSettings: NamingScrapeSettings | null,
  setBanner: Dispatch<SetStateAction<BannerState | null>>,
  protectedTermInput: string,
  setProtectedTermInput: Dispatch<SetStateAction<string>>,
  replayScope: NamingCleanupReplayScope,
  selectedLibraryId: string,
  setReplayConfirmOpen: Dispatch<SetStateAction<boolean>>,
  batchRepairDraft: NamingScrapeBatchRepairRequest,
  setBatchRepairConfirmOpen: Dispatch<SetStateAction<boolean>>,
  isDirty: boolean,
  saveMutationPending: boolean,
) {
  const updateDraft = (
    updater: (current: UpdateNamingScrapeSettingsRequest) => UpdateNamingScrapeSettingsRequest,
  ) => {
    setDraft((current) => updater(current));
  };

  const toggleDefaultTerm = (term: string) => {
    updateDraft((current) => {
      const exists = current.cleanup.disabledDefaultTerms.includes(term);
      return {
        ...current,
        cleanup: {
          ...current.cleanup,
          disabledDefaultTerms: exists
            ? current.cleanup.disabledDefaultTerms.filter((item) => item !== term)
            : [...current.cleanup.disabledDefaultTerms, term],
        },
      };
    });
  };

  const addProtectedTerm = () => {
    const normalized = normalizeCleanupToken(protectedTermInput);
    if (!normalized) {
      setBanner({
        variant: 'warning',
        title: '保留词不能为空',
        description: '请输入真正要保护的词，空输入没有任何意义。',
      });
      return;
    }
    const protectedTermSet = new Set(draft.cleanup.protectedTerms);
    if (protectedTermSet.has(normalized)) {
      setProtectedTermInput('');
      return;
    }
    updateDraft((current) => ({
      ...current,
      cleanup: {
        ...current.cleanup,
        protectedTerms: [...current.cleanup.protectedTerms, normalized],
      },
    }));
    setProtectedTermInput('');
  };

  const removeProtectedTerm = (term: string) => {
    updateDraft((current) => ({
      ...current,
      cleanup: {
        ...current.cleanup,
        protectedTerms: current.cleanup.protectedTerms.filter((item) => item !== term),
      },
    }));
  };

  const addCustomTerm = () => {
    updateDraft((current) => ({
      ...current,
      cleanup: {
        ...current.cleanup,
        customTerms: [...current.cleanup.customTerms, createEmptyCustomTerm()],
      },
    }));
  };

  const updateCustomTerm = (termId: string, patch: Partial<NamingCleanupCustomTerm>) => {
    updateDraft((current) => ({
      ...current,
      cleanup: {
        ...current.cleanup,
        customTerms: current.cleanup.customTerms.map((item) =>
          item.id === termId ? { ...item, ...patch } : item,
        ),
      },
    }));
  };

  const removeCustomTerm = (termId: string) => {
    updateDraft((current) => ({
      ...current,
      cleanup: {
        ...current.cleanup,
        customTerms: current.cleanup.customTerms.filter((item) => item.id !== termId),
      },
    }));
  };

  const resetDraftToSaved = () => {
    if (!savedSettings) return;
    startTransition(() => {
      setDraft(toScrapeDraft(savedSettings));
      setBanner(null);
    });
  };

  const resetToDefaults = () => {
    startTransition(() => {
      setDraft(createEmptyScrapeDraft());
      setBanner({
        variant: 'info',
        title: '已切到默认命名刮削草稿',
        description: '这只是页面草稿，还没写入服务端；确认没问题再保存。',
      });
    });
  };

  const triggerReplay = () => {
    const replayBlockedByDirty = isDirty || saveMutationPending;
    if (replayBlockedByDirty) {
      setBanner({
        variant: 'warning',
        title: '先保存设置再重排识别',
        description: '历史识别回灌只吃已保存版本，草稿里的改动不会偷偷生效。',
      });
      return;
    }
    if (replayScope === 'library' && !selectedLibraryId) {
      setBanner({
        variant: 'warning',
        title: '还没选媒体库',
        description: '单库重排必须明确指定媒体库。',
      });
      return;
    }
    setReplayConfirmOpen(true);
  };

  const triggerBatchRepair = () => {
    if (!batchRepairDraft.includeMissingMetadata && !batchRepairDraft.includeMissingPoster) {
      setBanner({
        variant: 'warning',
        title: '至少选一个补刮目标',
        description: '缺元数据、缺海报两项总得勾一个，不然这动作纯属空气。',
      });
      return;
    }
    const batchRepairScope = batchRepairDraft.scope;
    if (batchRepairScope === 'library' && !selectedLibraryId) {
      setBanner({
        variant: 'warning',
        title: '还没选媒体库',
        description: '单库补刮必须明确指定媒体库。',
      });
      return;
    }
    setBatchRepairConfirmOpen(true);
  };

  return {
    updateDraft,
    toggleDefaultTerm,
    addProtectedTerm,
    removeProtectedTerm,
    addCustomTerm,
    updateCustomTerm,
    removeCustomTerm,
    resetDraftToSaved,
    resetToDefaults,
    triggerReplay,
    triggerBatchRepair,
  };
}
