import type {
  CreateRegistrationCodeRequest,
  ManageBatchRegistrationCodeActionResponse,
  RegistrationCodeBatchRecord,
  RegistrationCodeRecord,
  RegistrationCodeStatus,
  RoleTemplateRecord,
  UpdateRegistrationCodeBatchRequest,
} from '@/domains/manage';
import type { BannerState } from '@/shared/types/ui';
import { formatDateTimeLocalInput } from '@/shared/utils/date';
import type { RegistrationCodeFormState } from './types';
import { BATCH_MODE_LABELS } from './constants';

export function createInitialFormState(): RegistrationCodeFormState {
  return {
    mode: 'single-use-batch',
    batchName: '',
    generateCount: '20',
    code: '',
    roleTemplate: 'user',
    roleTemplateId: '',
    usageLimit: '0',
    maxSessions: '',
    validDays: '',
    expiresAt: '',
    defaultLibraries: [],
    allowReactivation: true,
    requireApproval: false,
  };
}

export function buildFormStateFromBatch(
  batch: RegistrationCodeBatchRecord,
): RegistrationCodeFormState {
  const primaryRecord = batch.items[0];
  return {
    mode: batch.mode,
    batchName: batch.name,
    generateCount: String(batch.totalCodes),
    code: primaryRecord?.code ?? '',
    roleTemplate: primaryRecord?.roleTemplate ?? 'user',
    // 批次里存的是展开后的授权数值，不带模板来源，所以编辑态从「不套用模板」起步：
    // 页面显示的永远是这批码当前真实生效的授权，需要重新套用时再选一次模板。
    roleTemplateId: '',
    usageLimit: String(primaryRecord?.usageLimit ?? 0),
    maxSessions: primaryRecord?.maxSessions ? String(primaryRecord.maxSessions) : '',
    validDays: primaryRecord?.validDays ? String(primaryRecord.validDays) : '',
    expiresAt: formatShanghaiDateTimeInput(primaryRecord?.expiresAt),
    defaultLibraries: primaryRecord?.defaultLibraries ?? [],
    allowReactivation: primaryRecord?.allowReactivation ?? true,
    requireApproval: primaryRecord?.requireApproval ?? false,
  };
}

/**
 * 把角色模板的默认授权摊平写进表单。
 *
 * 注册码接口只接受具体的授权数值（default_library_ids / max_sessions / valid_days），
 * 不接受模板 id，所以模板不能跟注册码长期绑定；这里在选中的当下就把模板内容落成
 * 注册码自己的字段，之后这批码按落下来的数值发放，与模板后续改动无关。
 */
export function applyRoleTemplateToFormState(
  formState: RegistrationCodeFormState,
  template: RoleTemplateRecord | null,
): RegistrationCodeFormState {
  if (!template) {
    return { ...formState, roleTemplateId: '' };
  }

  return {
    ...formState,
    roleTemplateId: template.id,
    // 模板没配的项保留管理员已经填好的值，避免选一次模板就把手工输入清空
    defaultLibraries:
      template.defaultLibraries.length > 0
        ? [...template.defaultLibraries]
        : formState.defaultLibraries,
    maxSessions: isTemplateLimitSet(template.defaultMaxSessions)
      ? String(template.defaultMaxSessions)
      : formState.maxSessions,
    validDays: isTemplateLimitSet(template.defaultValidDays)
      ? String(template.defaultValidDays)
      : formState.validDays,
  };
}

// 模板里 0 与未填写都表示「不限制」，和注册码字段留空的含义一致
function isTemplateLimitSet(value?: number): value is number {
  return typeof value === 'number' && value > 0;
}

export function formatRoleTemplateLimit(value?: number) {
  return isTemplateLimitSet(value) ? String(value) : '不限制';
}

function parseNonNegativeNumber(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
}

function parseOptionalPositiveNumber(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return Math.floor(parsed);
}

export function formatShanghaiDateTimeInput(value?: string) {
  return formatDateTimeLocalInput(value);
}

function parseShanghaiDateTimeInput(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(normalized);
  if (!match) {
    return undefined;
  }

  const [, year, month, day, hour, minute] = match;
  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour) - 8,
      Number(minute),
    ),
  ).toISOString();
}

export function buildCreatePayload(
  formState: RegistrationCodeFormState,
): CreateRegistrationCodeRequest {
  return {
    mode: formState.mode,
    batchName: formState.batchName.trim(),
    generateCount:
      formState.mode === 'single-use-batch'
        ? parseNonNegativeNumber(formState.generateCount)
        : undefined,
    code: formState.mode === 'shared-code' ? formState.code.trim() : undefined,
    roleTemplate: formState.roleTemplate,
    usageLimit:
      formState.mode === 'shared-code'
        ? parseNonNegativeNumber(formState.usageLimit)
        : undefined,
    maxSessions: parseOptionalPositiveNumber(formState.maxSessions),
    validDays: parseOptionalPositiveNumber(formState.validDays),
    expiresAt: parseShanghaiDateTimeInput(formState.expiresAt),
    defaultLibraries: formState.defaultLibraries,
    allowReactivation: formState.allowReactivation,
    requireApproval: formState.requireApproval,
  };
}

export function buildUpdateBatchPayload(
  formState: RegistrationCodeFormState,
): UpdateRegistrationCodeBatchRequest {
  return {
    batchName: formState.batchName.trim(),
    roleTemplate: formState.roleTemplate,
    code: formState.mode === 'shared-code' ? formState.code.trim() : undefined,
    usageLimit:
      formState.mode === 'shared-code'
        ? parseNonNegativeNumber(formState.usageLimit)
        : undefined,
    maxSessions: parseOptionalPositiveNumber(formState.maxSessions),
    validDays: parseOptionalPositiveNumber(formState.validDays),
    expiresAt: parseShanghaiDateTimeInput(formState.expiresAt),
    defaultLibraries: formState.defaultLibraries,
    allowReactivation: formState.allowReactivation,
    requireApproval: formState.requireApproval,
  };
}

export function getRegistrationCodeStatusLabel(status: RegistrationCodeStatus) {
  switch (status) {
    case 'paused':
      return '已停用';
    case 'expired':
      return '已过期';
    case 'used-up':
      return '已用尽';
    default:
      return '可用';
  }
}

export function getCodeStatusAction(record: RegistrationCodeRecord) {
  if (record.status === 'paused') {
    return {
      label: '重新启用',
      nextStatus: 'active' as const,
      impact: '该注册码会重新回到发码池，可再次提供给新用户注册。',
    };
  }

  if (record.status !== 'active') {
    return null;
  }

  return {
    label: '停用注册码',
    nextStatus: 'paused' as const,
    impact: '停用后新用户将无法继续使用这个注册码完成注册。',
  };
}

export function getUsageLabel(record: RegistrationCodeRecord) {
  if (record.usageLimit === 0) {
    return `${record.usageCount} / 不限`;
  }
  return `${record.usageCount} / ${record.usageLimit}`;
}

export function getBatchModeLabel(mode: string) {
  return BATCH_MODE_LABELS[mode as keyof typeof BATCH_MODE_LABELS] ?? mode;
}

export function isCodeAvailable(record: RegistrationCodeRecord) {
  if (record.status !== 'active') {
    return false;
  }
  if (record.usageLimit === 0) {
    return true;
  }
  return record.usageCount < record.usageLimit;
}

export function collectCopyableCodes(
  batches: RegistrationCodeBatchRecord[],
  mode: 'all' | 'available',
) {
  const codes = new Set<string>();

  for (const batch of batches) {
    for (const item of batch.items) {
      if (mode === 'available' && !isCodeAvailable(item)) {
        continue;
      }
      codes.add(item.code);
    }
  }

  return Array.from(codes);
}

export function buildBatchDeleteBannerState(
  result: ManageBatchRegistrationCodeActionResponse,
): BannerState {
  const skippedResults = result.results.filter((item) => item.result === 'skipped');
  const failedResults = result.results.filter((item) => item.result === 'failed');
  const reasonSummary = Array.from(
    new Set(
      [...skippedResults, ...failedResults]
        .map((item) => item.message.trim())
        .filter((message) => message.length > 0),
    ),
  );
  const detailParts: string[] = [];

  if (skippedResults.length > 0) {
    detailParts.push(`跳过 ${skippedResults.length} 个`);
  }
  if (failedResults.length > 0) {
    detailParts.push(`失败 ${failedResults.length} 个`);
  }
  if (reasonSummary.length > 0) {
    detailParts.push(`原因：${reasonSummary.join('；')}`);
  }

  return {
    variant:
      skippedResults.length > 0 || failedResults.length > 0 ? 'warning' : 'success',
    title:
      result.updatedCount > 0
        ? `已删除 ${result.updatedCount} 个注册码批次`
        : '批量删除未产生变更',
    description:
      detailParts.length > 0
        ? `${detailParts.join('；')}。`
        : '所选批次已完成删除，列表也已重新同步。',
  };
}
