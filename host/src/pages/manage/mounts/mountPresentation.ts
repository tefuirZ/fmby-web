/**
 * mounts 展示派生：健康/抽屉文案、引用与删除影响摘要、敏感值遮蔽、凭据过期引导
 * （FE-MOUNT-AGGREGATE 拆分）。纯函数，无取数、无副作用。
 */

import type {
  ManageMountDetailRecord,
  ManageMountHealthRecord,
  ManageMountRecord,
} from '@fmby/v2-shared/contracts/manage';
import type {
  MountDrawerState,
  MountHealthStatus,
  PendingMountDeleteState,
} from './types';

export function getMountStatusLabel(status: MountHealthStatus) {
  switch (status) {
    case 'healthy':
      return '正常';
    case 'critical':
      return '异常';
    default:
      return '需关注';
  }
}

export function getMountDrawerTitle(drawerState: MountDrawerState | null, detail?: ManageMountDetailRecord) {
  if (!drawerState) {
    return '数据源';
  }

  if (drawerState.mode === 'create') {
    return '新建数据源';
  }

  if (drawerState.mode === 'edit') {
    return detail?.mount.name ? `编辑：${detail.mount.name}` : '编辑数据源';
  }

  return detail?.mount.name || '数据源详情';
}

export function getMountDrawerDescription(drawerState: MountDrawerState | null) {
  if (!drawerState) {
    return undefined;
  }

  if (drawerState.mode === 'create') {
    return '创建来源时可配置能力声明；AList / OpenList 会直接走结构化配置和目录浏览器。';
  }

  if (drawerState.mode === 'edit') {
    return '保存后会整体更新根路径、能力声明与 config_json。AList / OpenList 路径改为目录浏览器选择。';
  }

  return '查看来源详情、能力状态、关联媒体库与校验动作。';
}

export function formatMountReferenceSummary(target: ManageMountDetailRecord | ManageMountRecord) {
  const counts = 'mount' in target ? target.mount.referenceCounts : target.referenceCounts;
  return `媒体库绑定 ${counts.librarySourceCount} · 媒体源 ${counts.mediaSourceCount} · 旁路资源 ${counts.sidecarAssetCount}`;
}

export function hasHiddenMountReferences(target: ManageMountDetailRecord | ManageMountRecord) {
  const counts = 'mount' in target ? target.mount.referenceCounts : target.referenceCounts;
  return counts.librarySourceCount === 0 && (counts.mediaSourceCount > 0 || counts.sidecarAssetCount > 0);
}

export function buildPendingMountDeleteState(
  target: ManageMountDetailRecord | ManageMountRecord,
): PendingMountDeleteState {
  const referenceCounts = 'mount' in target ? target.mount.referenceCounts : target.referenceCounts;
  if ('mount' in target) {
    return {
      mountId: target.mount.id,
      mountName: target.mount.name,
      pathLabel: target.rootPath || target.mount.pathLabel,
      linkedLibraryCount: target.mount.linkedLibraries.length,
      librarySourceCount: referenceCounts.librarySourceCount,
      mediaSourceCount: referenceCounts.mediaSourceCount,
      sidecarAssetCount: referenceCounts.sidecarAssetCount,
    };
  }

  return {
    mountId: target.id,
    mountName: target.name,
    pathLabel: target.pathLabel,
    linkedLibraryCount: target.linkedLibraries.length,
    librarySourceCount: referenceCounts.librarySourceCount,
    mediaSourceCount: referenceCounts.mediaSourceCount,
    sidecarAssetCount: referenceCounts.sidecarAssetCount,
  };
}

export function buildMountDeleteImpact(target: PendingMountDeleteState) {
  const linkedLibrarySummary =
    target.linkedLibraryCount > 0
      ? `当前关联媒体库 ${target.linkedLibraryCount} 个。`
      : '当前没有媒体库级关联。';
  const referenceSummary = `实际引用统计：媒体库绑定 ${target.librarySourceCount} 条、媒体源 ${target.mediaSourceCount} 条、旁路资源 ${target.sidecarAssetCount} 条。`;
  const mismatchSummary =
    target.linkedLibraryCount === 0 && (target.mediaSourceCount > 0 || target.sidecarAssetCount > 0)
      ? '虽然列表里看起来没有关联媒体库，但底层媒体源或旁路资源还挂着这个数据源，所以后端会拒绝删除。'
      : '只要上面三个引用计数里还有非 0，后端就不会放行删除。';

  return [
    `根路径 / 地址：${target.pathLabel}`,
    linkedLibrarySummary,
    referenceSummary,
    mismatchSummary,
  ];
}

export function maskSensitiveConfig(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(maskSensitiveConfig);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => {
      if (/(password|secret|token|access_key|accesskey|secret_key|secretkey)/i.test(key)) {
        return [key, '***'];
      }
      return [key, maskSensitiveConfig(entryValue)];
    }),
  );
}

/**
 * 115 凭据缺失/失效时的统一引导文案。
 *
 * 凭据面（Pan115CredentialsSection）与目录浏览面（Pan115DirectoryBrowserSection）共用，
 * 避免同一引导在多处分叉（frontend-dupes 闸）。
 */
export const PAN115_CREDENTIAL_HINT =
  '尚未绑定 115 账号或登录态已失效，请先在「115 网盘凭据」卡片完成扫码绑定后再操作。';

/** 凭据过期故障类别（与后端 errno 字典一致）。 */
export const MOUNT_FAULT_CREDENTIAL_EXPIRED = 'credential_expired';

/**
 * 凭据过期引导判定（纯函数，可单测）。
 *
 * 依据：后端 `MountHealthDto.last_fault_kind`（扫描观测落库事实，0049）。
 * 只有明确观测到 credential_expired 才给出「重新绑定」引导；
 * `null`（无观测）归「未知」，**不伪造**过期结论。
 */
export function resolveCredentialGuidance(
  health: Pick<ManageMountHealthRecord, 'lastFaultKind' | 'lastFaultTitle' | 'lastFaultAction'> | null | undefined,
): { kind: 'expired' | 'unknown' | 'none'; title: string | null; action: string | null } {
  if (!health || health.lastFaultKind === null) {
    return { kind: 'unknown', title: null, action: null };
  }
  if (health.lastFaultKind === MOUNT_FAULT_CREDENTIAL_EXPIRED) {
    return {
      kind: 'expired',
      title: health.lastFaultTitle ?? '凭据已过期',
      action: health.lastFaultAction ?? '请重新绑定该数据源的凭据。',
    };
  }
  return { kind: 'none', title: health.lastFaultTitle, action: health.lastFaultAction };
}

/**
 * 密钥类字段展示形态：只说「已设置 / 未设置」，不回显明文、不回显占位假值。
 * 与 maskSensitiveConfig 的区别：后者把值替换为 '***'（仍是占位），
 * 本函数给出管理员真正需要的状态语义。
 */
export function describeSecretValue(value: unknown): '已设置' | '未设置' {
  if (value === null || value === undefined || value === '') {
    return '未设置';
  }
  return '已设置';
}
