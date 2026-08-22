import type {
  ManageUserAccountKind,
  ManageUserRecord,
  ManageSourcePathGrantInput,
  ManageUserRole,
  UserStatus,
} from '@/domains/manage';

export type UserDrawerMode = 'create' | 'view' | 'edit';
export type UserRegistrationReviewAction = 'approve' | 'reject';

export type PendingUserAction =
  | { kind: 'status'; user: ManageUserRecord }
  | { kind: 'login-risk-reset'; user: ManageUserRecord }
  | {
      kind: 'registration-review';
      user: ManageUserRecord;
      action: UserRegistrationReviewAction;
    };

export interface UserDrawerState {
  mode: UserDrawerMode;
  userId?: string;
}

export interface UserFormState {
  username: string;
  displayName: string;
  email: string;
  password: string;
  role: ManageUserRole;
  roleTemplateId: string;
  status: UserStatus;
  accountKind: ManageUserAccountKind;
  maxSessions: string;
  validUntil: string;
  maxConcurrentPlaybacks: string;
  sourceGrants: ManageSourcePathGrantInput[];
}

export interface UserBatchEditFormState {
  applyRole: boolean;
  role: ManageUserRole;
  applyStatus: boolean;
  status: UserStatus;
  applySourceGrants: boolean;
  sourceGrants: ManageSourcePathGrantInput[];
}

export interface ResetPasswordDialogState {
  user: ManageUserRecord;
}

export const ROLE_OPTIONS: Array<{ value: ManageUserRole; label: string }> = [
  { value: 'user', label: '普通用户' },
  { value: 'restricted_user', label: '受限用户' },
  { value: 'admin', label: '管理员' },
];

export const DEFAULT_FORM_STATE: UserFormState = {
  username: '',
  displayName: '',
  email: '',
  password: '',
  role: 'user',
  roleTemplateId: '',
  status: 'active',
  accountKind: 'human',
  maxSessions: '',
  validUntil: '',
  maxConcurrentPlaybacks: '',
  sourceGrants: [],
};

export const DEFAULT_BATCH_EDIT_FORM_STATE: UserBatchEditFormState = {
  applyRole: false,
  role: 'user',
  applyStatus: false,
  status: 'active',
  applySourceGrants: false,
  sourceGrants: [],
};
