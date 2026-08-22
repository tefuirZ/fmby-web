import type { ManageLibrariesQuery, ManageMountsQuery, ManageProbeTasksQuery, ManageRuntimeLogsQuery, ManageScansQuery } from "../types";
export declare function mapLibrariesQueryToParams(query?: ManageLibrariesQuery): {
    page: number | undefined;
    pageSize: number | undefined;
    search: string | undefined;
    status: string | undefined;
    libraryType: string | undefined;
    mountId: string | undefined;
} | undefined;
export declare function mapMountsQueryToParams(query?: ManageMountsQuery): {
    page: number | undefined;
    pageSize: number | undefined;
    search: string | undefined;
    healthStatus: string | undefined;
    providerType: string | undefined;
    libraryId: string | undefined;
} | undefined;
export declare function mapScansQueryToParams(query?: ManageScansQuery): {
    page: number | undefined;
    pageSize: number | undefined;
    status: string | undefined;
    taskType: string | undefined;
    libraryId: string | undefined;
    mountId: string | undefined;
    librarySourceId: string | undefined;
} | undefined;
export declare function mapProbeTasksQueryToParams(query?: ManageProbeTasksQuery): {
    page: number | undefined;
    pageSize: number | undefined;
    search: string | undefined;
    status: string | undefined;
    libraryId: string | undefined;
    mountId: string | undefined;
} | undefined;
export declare function mapRuntimeLogsQueryToParams(query?: ManageRuntimeLogsQuery): {
    page: number | undefined;
    pageSize: number | undefined;
    level: string | undefined;
    target: string | undefined;
    search: string | undefined;
    method: string | undefined;
    path: string | undefined;
    client: string | undefined;
    ip: string | undefined;
    request_id: string | undefined;
    user: string | undefined;
    all: boolean | undefined;
} | undefined;
//# sourceMappingURL=query-params.d.ts.map