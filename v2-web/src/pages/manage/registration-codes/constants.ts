import type { ManageUserRole, RegistrationCodeBatchMode } from '@/domains/manage';

export const ROLE_OPTIONS: Array<{
  value: ManageUserRole;
  label: string;
  description: string;
}> = [
  {
    value: 'user',
    label: '普通用户',
    description: '标准注册入口，拥有浏览和播放能力。',
  },
  {
    value: 'restricted_user',
    label: '受限用户',
    description: '适合更严格的访问限制，保留基础浏览入口。',
  },
  {
    value: 'admin',
    label: '管理员',
    description: '适合可信运营人员，具备完整管理能力。',
  },
  {
    value: 'super_admin',
    label: '超级管理员',
    description: '只给站点最高权限账号，别乱发。',
  },
];

export const BATCH_MODE_LABELS: Record<RegistrationCodeBatchMode, string> = {
  'shared-code': '单码多次用',
  'single-use-batch': '批量单次码',
};

export const BATCH_MODE_DESCRIPTIONS: Record<RegistrationCodeBatchMode, string> = {
  'shared-code': '一个注册码支持多次发放，适合长期渠道入口。',
  'single-use-batch': '一次生成多条一次性注册码，适合批量分发。',
};
