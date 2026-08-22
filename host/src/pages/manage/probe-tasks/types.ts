import type { ManageProbeTaskStatus } from '@/domains/manage';

export const ACTIVE_PROBE_STATUSES: ManageProbeTaskStatus[] = ['queued', 'running', 'retry-waiting'];

export type ProbeStatusFilter = 'all' | ManageProbeTaskStatus;
