/**
 * 开放 API 端点目录（FE-PARITY-DEVELOPER-ENDPOINTS）。
 *
 * 真源：`crates/fmby-v2-http/src/routes/manage_developer_api.rs:37/165`
 * 能力门：`MANAGE_ACCESS`（与 `/api/admin/api-tokens` 同闸门）；
 *         `require_confirmed` 0 次 → 不带 confirmed=true。
 *
 * ★诚实边界：后端响应 `items` 是 `serde_json::Value`（目录条目结构由令牌服务给出，
 *   本卡**不猜**字段），故这里归 `unknown`，前端只做「原样呈现 + 关键字筛选/分页」，
 *   不对其内部结构做假设、不补默认值。
 *
 * ★响应 casing 有意保留后端原样：`pageSize` 是 camelCase（`serde_json::json!` 直出），
 *   其余为小写。不擅自重命名成 page_size。
 */

/** 目录查询（camelCase wire，后端同时接受 snake_case 别名）。 */
export interface DeveloperApiCatalogQueryInput {
  /** HTTP 方法过滤，如 `GET`。 */
  method?: string;
  /** 作用域过滤。 */
  scope?: string;
  /** 关键字（后端字段名为 `q`，`keyword` 是别名）。 */
  q?: string;
  page?: number;
  /** 后端 canonical 是 camelCase `pageSize`（别名 page_size）。 */
  pageSize?: number;
}

/** GET /api/manage/developer/endpoints 响应。 */
export interface DeveloperApiCatalogResponse {
  /** ★目录条目：结构未实测，按后端 serde_json::Value 归 unknown，不猜字段。 */
  items: unknown[];
  total: number;
  page: number;
  /** ★保持后端原样 camelCase，不改写成 page_size。 */
  pageSize: number;
}
