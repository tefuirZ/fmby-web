import type { ManageSourcePathGrantInput } from '@fmby/v2-shared/contracts/manage';

export interface RoleTemplateFormState {
  code: string;
  name: string;
  description: string;
  defaultLibraries: string[];
  sourceGrants: ManageSourcePathGrantInput[];
  defaultMaxSessions: string;
  defaultValidDays: string;
}
