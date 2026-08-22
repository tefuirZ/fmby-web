import type { TaskCenterAction, TaskCenterActionResponse, TaskCenterCategory, TaskCenterItemDetailRecord, TaskCenterListQuery, TaskCenterListResponse, TaskCenterOverviewRecord } from './types';
export declare const taskCenterApi: {
    getOverview(): Promise<TaskCenterOverviewRecord>;
    getItems(query: TaskCenterListQuery): Promise<TaskCenterListResponse>;
    getItem(category: TaskCenterCategory, taskId: string): Promise<TaskCenterItemDetailRecord>;
    runAction(category: TaskCenterCategory, taskId: string, action: TaskCenterAction): Promise<TaskCenterActionResponse>;
};
//# sourceMappingURL=api.d.ts.map