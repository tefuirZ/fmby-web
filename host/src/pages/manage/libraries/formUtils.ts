import type {
  CreateManageLibraryRequest,
  ManageLibraryDetailRecord,
  ManageLibraryRecord,
} from '@fmby/v2-shared/contracts/manage';
import type {
  LibraryDrawerState,
  LibraryFormState,
  LibraryHealthStatus,
  PendingLibraryDeleteState,
} from './types';

export function createEmptyLibraryForm(): LibraryFormState {
  return {
    name: '',
    libraryType: 'movie',
    description: '',
    sourceBindings: [],
    grantUserIds: [],
  };
}

export function buildLibraryFormState(detail: ManageLibraryDetailRecord): LibraryFormState {
  return {
    name: detail.library.name,
    libraryType: detail.library.libraryType,
    description: detail.library.description ?? '',
    sourceBindings: detail.sourceBindings.map((binding) => ({
      id: binding.id,
      mountId: binding.mountId,
      subPath: binding.subPath,
      scanPriority: binding.scanPriority,
    })),
    grantUserIds: detail.accessGrants.map((grant) => grant.userId),
  };
}

export function buildCreateLibraryPayload(form: LibraryFormState): CreateManageLibraryRequest {
  return {
    name: form.name.trim(),
    libraryType: form.libraryType,
    description: normalizeOptionalText(form.description),
    sourceBindings: form.sourceBindings.map((binding) => ({
      id: binding.id,
      mountId: binding.mountId.trim(),
      subPath: binding.subPath.trim(),
      scanPriority: binding.scanPriority,
    })),
    grantUserIds: dedupeIds(form.grantUserIds),
  };
}

export function buildUpdateLibraryPayload(form: LibraryFormState) {
  return {
    name: form.name.trim(),
    libraryType: form.libraryType,
    description: normalizeOptionalText(form.description),
    replaceSourceBindings: form.sourceBindings.map((binding) => ({
      id: binding.id,
      mountId: binding.mountId.trim(),
      subPath: binding.subPath.trim(),
      scanPriority: binding.scanPriority,
    })),
    replaceGrantUserIds: dedupeIds(form.grantUserIds),
  };
}

export function validateLibraryForm(form: LibraryFormState): string | null {
  if (form.name.trim() === '') {
    return '媒体库名称不能为空。';
  }

  const seenSourceKeys = new Set<string>();
  for (const binding of form.sourceBindings) {
    if (binding.mountId.trim() === '') {
      return '来源绑定必须选择一个数据源。';
    }

    if (!Number.isFinite(binding.scanPriority)) {
      return '扫描优先级必须是合法数字。';
    }

    const sourceKey = `${binding.mountId.trim()}::${binding.subPath.trim().toLowerCase()}`;
    if (seenSourceKeys.has(sourceKey)) {
      return '同一数据源路径不能重复绑定到一个媒体库。';
    }
    seenSourceKeys.add(sourceKey);
  }

  return null;
}

export function nextScanPriority(bindings: LibraryFormState['sourceBindings']) {
  if (bindings.length === 0) return 10;
  return Math.max(...bindings.map((b) => b.scanPriority || 0)) + 10;
}

export function getDrawerTitle(drawerState: LibraryDrawerState | null, detail?: ManageLibraryDetailRecord) {
  if (!drawerState) return '媒体库';
  if (drawerState.mode === 'create') return '新建媒体库';
  if (drawerState.mode === 'edit') return detail?.library.name ? `编辑：${detail.library.name}` : '编辑媒体库';
  return detail?.library.name || '媒体库详情';
}

export function getDrawerDescription(drawerState: LibraryDrawerState | null) {
  if (!drawerState) return undefined;
  if (drawerState.mode === 'create') return '创建媒体库时可同时配置多来源绑定与显式授权用户。';
  if (drawerState.mode === 'edit') return '保存后会整体替换来源绑定与显式授权列表。';
  return '查看当前媒体库的来源绑定、授权摘要和最近状态。';
}

export function getLibraryStatusLabel(status: LibraryHealthStatus) {
  switch (status) {
    case 'healthy': return '正常';
    case 'critical': return '异常';
    default: return '需关注';
  }
}

export function buildLibraryBindingSummary(
  library: Pick<ManageLibraryRecord, 'sourceNames' | 'actualSourceNames'>,
) {
  return `来源绑定 ${library.sourceNames.length} · 实际媒体来源 ${library.actualSourceNames.length}`;
}

export function buildLibraryBindingHint(
  library: Pick<ManageLibraryRecord, 'sourceNames' | 'actualSourceNames'>,
) {
  if (library.sourceNames.length > 0 && library.actualSourceNames.length > 0) {
    return `当前绑定：${library.sourceNames.join('、')}；实际媒体来源：${library.actualSourceNames.join('、')}`;
  }

  if (library.sourceNames.length > 0) {
    return `当前绑定：${library.sourceNames.join('、')}`;
  }

  if (library.actualSourceNames.length > 0) {
    return `当前没有来源绑定，但库内资源实际来自：${library.actualSourceNames.join('、')}`;
  }

  return '当前没有来源绑定，也没有发现实际媒体来源。';
}

export function buildPendingLibraryDeleteState(
  detail: ManageLibraryDetailRecord,
): PendingLibraryDeleteState {
  return {
    library: detail.library,
    sourceBindingCount: detail.sourceBindings.length,
    accessGrantCount: detail.accessGrants.length,
  };
}

export function buildDeleteImpact(target: PendingLibraryDeleteState) {
  const impact = [
    `将移除 ${target.sourceBindingCount} 个来源绑定，并让该媒体库从前台浏览视图中消失。`,
  ];

  if (target.accessGrantCount !== undefined) {
    impact.push(`将同时移除 ${target.accessGrantCount} 条显式授权。`);
  }

  if (target.library.actualSourceNames.length > 0) {
    impact.push(`库内资源当前实际仍来自：${target.library.actualSourceNames.join('、')}。`);
  }

  return impact;
}

function normalizeOptionalText(value: string) {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function dedupeIds(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}
