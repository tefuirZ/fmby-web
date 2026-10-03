import { httpClient } from "@fmby/v2-shared/api/client";
import { isApiError, getErrorMessage } from "@fmby/v2-shared/errors";
import type {
  MigrationEntry,
  MigrationExportResponse,
  MigrationInspectResponse,
} from "./types";

// 与 `router_manage.rs:373-378` 逐字一致（单一事实源，不另起常量）。
// 注意：`import` 端点后端为 NotImplemented 占位，故**不提供**对应方法（避免接线占位）。
const INSPECT_PATH = "/api/manage/migration/inspect";
const EXPORT_PATH = "/api/manage/migration/export";

export const migrationApi = {
  /// `GET` —— 检视已应用迁移 ledger（逐条真实记录，非 currentVersion 冒充）。
  async inspect(): Promise<MigrationInspectResponse> {
    const res = await httpClient.get<MigrationInspectResponse>(INSPECT_PATH);
    return {
      count: res?.count ?? 0,
      currentVersion: res?.currentVersion ?? 0,
      entries: res?.entries ?? [],
    };
  },

  /// `GET` —— 导出可导入的迁移集合（= 当前已应用条目）。
  async export(): Promise<MigrationExportResponse> {
    const res = await httpClient.get<MigrationExportResponse>(EXPORT_PATH);
    return { entries: res?.entries ?? [] };
  },
};

// 错误面复用 `shared/src/errors` 既有口径：端口未装配时后端 fail-closed（不返空壳），
// 由调用方用 `isApiError` / `getErrorMessage` 对拍，不在本层吞成空列表。
export { isApiError, getErrorMessage };
export type { MigrationEntry };
