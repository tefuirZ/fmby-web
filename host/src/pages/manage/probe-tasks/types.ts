import type { ManageProbeTaskStatus } from '@fmby/v2-shared/contracts/manage';

export const ACTIVE_PROBE_STATUSES: ManageProbeTaskStatus[] = ['queued', 'running', 'retry-waiting'];

export type ProbeStatusFilter = 'all' | ManageProbeTaskStatus;
