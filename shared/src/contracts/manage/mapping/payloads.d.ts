import type { CreateManageLibraryRequest, CreateManageMountRequest, DangerousActionRequest, ManageSourcePathGrantInput, UpdateManageLibraryRequest, UpdateManageMountRequest } from "../types";
export declare function mapCreateLibraryPayloadToApi(payload: CreateManageLibraryRequest): {
    name: string;
    library_type: string;
    description: string | undefined;
    source_bindings: {
        id: string | undefined;
        mount_id: string;
        sub_path: string;
        scan_priority: number;
    }[];
    grant_user_ids: string[];
};
export declare function mapUpdateLibraryPayloadToApi(payload: UpdateManageLibraryRequest): {
    name: string | undefined;
    library_type: string | undefined;
    description: string | undefined;
    replace_source_bindings: {
        id: string | undefined;
        mount_id: string;
        sub_path: string;
        scan_priority: number;
    }[] | undefined;
    replace_grant_user_ids: string[] | undefined;
};
export declare function mapCreateMountPayloadToApi(payload: CreateManageMountRequest): {
    name: string;
    provider_type: string;
    root_path: string;
    config_json: Record<string, unknown>;
    status: string | undefined;
    path_policies: {
        id: string | undefined;
        path_prefix: string;
        priority: number;
        max_concurrent_streams: number | null;
    }[];
    capabilities: {
        can_list: boolean;
        can_random_read: boolean;
        can_read_sidecar: boolean;
        can_generate_play_target: boolean;
        can_refresh_credentials: boolean;
    } | undefined;
};
export declare function mapUpdateMountPayloadToApi(payload: UpdateManageMountRequest): {
    name: string | undefined;
    root_path: string | undefined;
    config_json: Record<string, unknown> | undefined;
    status: string | undefined;
    path_policies: {
        id: string | undefined;
        path_prefix: string;
        priority: number;
        max_concurrent_streams: number | null;
    }[] | undefined;
    capabilities: {
        can_list: boolean;
        can_random_read: boolean;
        can_read_sidecar: boolean;
        can_generate_play_target: boolean;
        can_refresh_credentials: boolean;
    } | undefined;
};
export declare function mapDangerousActionPayloadToApi(payload: DangerousActionRequest): {
    confirm_action: string;
    session_confirmation: string | undefined;
    current_password: string | undefined;
};
export declare function mapSourcePathGrantToApi(payload: ManageSourcePathGrantInput): {
    mount_id: string;
    path_prefix: string;
};
//# sourceMappingURL=payloads.d.ts.map