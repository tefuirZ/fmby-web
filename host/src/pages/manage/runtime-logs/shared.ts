/** 运行日志页共享常量与类型（V1F 拆分：ManageRuntimeLogsPage → 子组件）。 */

import type { RuntimeLogLevel } from '@fmby/v2-shared/contracts/manage';

export const LEVEL_OPTIONS: Array<{ value: 'all' | RuntimeLogLevel; label: string }> = [
  { value: 'all', label: '全部级别' },
  { value: 'error', label: '错误' },
  { value: 'warn', label: '警告' },
  { value: 'info', label: '信息' },
  { value: 'debug', label: '调试' },
  { value: 'trace', label: '跟踪' },
];

export const METHOD_OPTIONS = [
  { value: 'all', label: '全部方式' },
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
  { value: 'HEAD', label: 'HEAD' },
  { value: 'OPTIONS', label: 'OPTIONS' },
] as const;

export const PAGE_SIZE_OPTIONS = [
  { value: 50, label: '50 条' },
  { value: 100, label: '100 条' },
  { value: 200, label: '200 条' },
  { value: 500, label: '500 条' },
  { value: 1000, label: '1000 条' },
  { value: 'all', label: '全部' },
] as const;

export type RuntimeLogPageSize = (typeof PAGE_SIZE_OPTIONS)[number]['value'];
