import type {
  CreateRoleTemplateRequest,
  RoleTemplateRecord,
  UpdateRoleTemplateRequest,
} from '@/domains/manage';
import type { RoleTemplateFormState } from './types';

export function createInitialFormState(): RoleTemplateFormState {
  return {
    code: '',
    name: '',
    description: '',
    defaultLibraries: [],
    sourceGrants: [],
    defaultMaxSessions: '',
    defaultValidDays: '',
  };
}

export function buildFormStateFromRecord(
  record: RoleTemplateRecord,
): RoleTemplateFormState {
  return {
    code: record.code,
    name: record.name,
    description: record.description ?? '',
    defaultLibraries: record.defaultLibraries,
    sourceGrants: record.sourceGrants ?? [],
    defaultMaxSessions:
      record.defaultMaxSessions != null ? String(record.defaultMaxSessions) : '',
    defaultValidDays:
      record.defaultValidDays != null ? String(record.defaultValidDays) : '',
  };
}

function parseOptionalPositiveNumber(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.floor(parsed);
}

export function buildRoleTemplatePayload(
  formState: RoleTemplateFormState,
): CreateRoleTemplateRequest | UpdateRoleTemplateRequest {
  return {
    code: formState.code.trim().toLowerCase(),
    name: formState.name.trim(),
    description: formState.description.trim(),
    defaultLibraries: Array.from(new Set(formState.defaultLibraries)),
    sourceGrants: formState.sourceGrants,
    defaultMaxSessions: parseOptionalPositiveNumber(formState.defaultMaxSessions),
    defaultValidDays: parseOptionalPositiveNumber(formState.defaultValidDays),
  };
}
