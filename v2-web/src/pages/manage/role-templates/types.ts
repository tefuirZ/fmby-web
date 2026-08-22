import type { ManageSourcePathGrantInput } from '@/domains/manage';

export interface RoleTemplateFormState {
  code: string;
  name: string;
  description: string;
  defaultLibraries: string[];
  sourceGrants: ManageSourcePathGrantInput[];
  defaultMaxSessions: string;
  defaultValidDays: string;
}
