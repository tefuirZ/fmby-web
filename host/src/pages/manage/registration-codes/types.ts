import type {
  ManageUserRole,
  RegistrationCodeBatchMode,
  RegistrationCodeBatchRecord,
  RegistrationCodeRecord,
  RegistrationCodeStatus,
} from '@fmby/v2-shared/contracts/manage';

export interface RegistrationCodeFormState {
  mode: RegistrationCodeBatchMode;
  batchName: string;
  generateCount: string;
  code: string;
  roleTemplate: ManageUserRole;
  /**
   * 当前选中的角色模板 id，只在表单内部生效：注册码接口保存的是展开后的授权字段
   * （默认媒体库 / 最大会话数 / 有效天数），没有存模板 id 的位置。留空表示不套用模板。
   */
  roleTemplateId: string;
  usageLimit: string;
  maxSessions: string;
  validDays: string;
  expiresAt: string;
  defaultLibraries: string[];
  allowReactivation: boolean;
  requireApproval: boolean;
}

export interface CopyToastState {
  title: string;
  description: string;
}

export type PendingCodeAction =
  | {
      kind: 'status';
      record: RegistrationCodeRecord;
    }
  | {
      kind: 'delete';
      record: RegistrationCodeRecord;
    };

export interface RegistrationCodeMetrics {
  totalBatches: number;
  totalCodes: number;
  totalAvailableCodes: number;
  totalUsedCodes: number;
  totalRestrictedCodes: number;
}

export interface RegistrationCodeFilters {
  statusFilter: 'all' | RegistrationCodeStatus;
  searchKeyword: string;
}

export interface RegistrationCodeBatchSummary {
  batch: RegistrationCodeBatchRecord;
  roleLabels: string[];
  libraryLabels: string[];
}
