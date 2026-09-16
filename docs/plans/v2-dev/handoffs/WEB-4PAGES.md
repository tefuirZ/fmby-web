# WEB-4PAGES 交接（w1 · 前端仓 w/zcode/writer1-web-4pages）

> 4 个管理页补齐：**MediaReviews / Events / OperationsDashboard / Upstreams**。
> 后端端点全部已就绪（V1F-03a/b、V1F-07、V1F-08-B1、V1F-02-S1..S4），此前用户看得到入口但页面缺。
> 本次只做前端 half；**后端仓只读参考，未改一行**。

- 基线：`origin/main` @ `d1d2634`
- 提交：`ffcb5a3`（单一 green commit）
- 门禁：`pnpm verify` **11 闸全绿**

---

## 1. 每页消费的端点清单（验收要求）

### 1.1 MediaReviews — `ManageMediaReviewsPage`（`/manage/media-reviews`）

| 方法 | 端点 | 用途 |
|---|---|---|
| `GET` | `/api/manage/media-reviews` | 队列列表（stage / status / mediaItemId 过滤 + 分页） |
| `GET` | `/api/manage/media-reviews/provider-search` | provider 候选搜索（人工匹配） |
| `POST` | `/api/manage/media-reviews/{id}/claim` | 认领 |
| `POST` | `/api/manage/media-reviews/{id}/release` | 释放 |
| `POST` | `/api/manage/media-reviews/{id}/resolve` | 处理（action + payload） |

- 工单详情端点 `GET /api/manage/media-reviews/{id}` **契约已建未接线**（页面用列表项快照展开，暂未单独请求）——见 §3 待办。
- 可见性治理动作（`ApproveVisibilityHide` / `KeepVisible` / `RetryIdentify` / `RestoreVisibility`）走后端
  `DangerousAction` capability + `?confirmed=true` 二次闸门；前端在对话框内标注「需二次确认」并由 api 层自动带 `confirmed`。

### 1.2 Events — `ManageEventsPage`（`/manage/events`）

| 方法 | 端点 | 用途 |
|---|---|---|
| `GET` | `/api/manage/events` | 事件列表（kind / search 过滤 + 分页） |
| `GET` | `/api/manage/events/{request_id}` | 事件详情（timeline + result + errorCode + diagnosis + auditRecords） |

- V1F-07 **方向 B 诚实降级**：`runtimeSourceAvailable === false` 时页面显式挂告警横幅，
  **不静默空冒充有数据**。

### 1.3 OperationsDashboard — `ManageOperationsPage`（`/manage/operations`）

| 方法 | 端点 | 用途 |
|---|---|---|
| `GET` | `/api/manage/operations/overview?days=` | B1 聚合（summary + hotItems + activeUsers + 三条趋势） |

- 只接 **B1 已有端点**。B2/B3（`resourceProfile` / `pressureAdvice` / 活跃快照 / SSE）**未做也未体占位假值**，
  响应缺省即不渲染，符合 B1 冻结范围。

### 1.4 Upstreams — `ManageUpstreamsPage`（`/manage/upstreams`）

| 方法 | 端点 | 用途 |
|---|---|---|
| `GET` | `/api/manage/upstreams` | 源列表（sourceType 过滤） |
| `POST` | `/api/manage/upstreams` | 新建源 |
| `PATCH` | `/api/manage/upstreams/{id}` | 更新源（secret 留空 = `retainSecret` 保留既有） |
| `DELETE` | `/api/manage/upstreams/{id}` | 删除源（幂等） |
| `POST` | `/api/manage/upstreams/{id}/enable` | 启用 |
| `POST` | `/api/manage/upstreams/{id}/disable` | 停用 |
| `POST` | `/api/manage/upstreams/{id}/health-check` | 真实探活（S3，含 SSRF 防护侧） |
| `POST` | `/api/manage/upstreams/emby/discover-lan` | Emby 局域网真实发现（UDP，无需凭据） |

- 凭据纪律：读 DTO 只回 `hasSecret`，页面**永不回显明文**；表单密码/API Key 输入后由后端密封。

---

## 2. 改动清单

**契约（`shared/src/contracts/manage/`，4 个新模块，各含 raw DTO + mapper 双件套）**
- `media-reviews/` · `events/` · `operations/` · `upstreams/`（各：`types.ts` / `api.ts` / `index.ts`）

**页面（`host/src/pages/manage/`，4 个新页）**
- `ManageMediaReviewsPage.tsx` · `ManageEventsPage.tsx` · `ManageOperationsPage.tsx` · `ManageUpstreamsPage.tsx`

**接线**
- `shared/src/query/keys.ts`：新增 `mediaReviews` / `events` / `operations` / `upstreams` 四域 queryKey
- `host/src/app/router/index.tsx`：`media-reviews` / `operations` / `events` / `upstreams` 四条 lazy 路由 + 头部路由注释
- `host/src/app/router/prefetch.ts`：`routeLoaders` 登记 4 个 key
- `host/src/app/layouts/ManageLayout.tsx`：侧栏新增「**内容与运营**」分组（4 个入口）+ `PATH_PREFETCH_KEYS` 登记

**模式来源**：照抄 `ManageCollectionsPage` / `ManageAuditLogsPage`——
`ManagePageHeader` + `ManageSectionCard` + `StatusBadge` / `InlineBanner` / `Dialog` / `SensitiveActionDialog` +
`longtail-shared/ManageShared.module.css`；状态用页内 `useQuery` / `useMutation`（既有模式），未发明新 viewmodel 层。

---

## 3. 待办 / 需裁决（未擅自扩大范围）

1. **Upstreams 子资源未接线**（后端已有端点，本页未做 UI）：
   - 类别/媒体库发现与绑定：`/apple-cms/discover-categories`、`/emby/discover-libraries`、
     `/apple-cms/categories`、`/apple-cms/category-bindings`、`/emby/libraries`、`/emby/library-bindings`、`/bindings`
   - 映射预设：`/mapping/presets`（增删查改）、`/mapping/preview`、`/mapping/apply`
   - 理由：卡面只要求「4 页可从管理导航进入且调真实端点」，源 CRUD + 探活 + 发现已满足；
     子资源属独立交互面（绑定/映射编辑器），**建议单开一卡**。
2. **MediaReviews 工单详情端点** `GET /api/manage/media-reviews/{id}` 契约已建、页面暂用列表快照展开，
   未单独请求（列表已含全字段）。若要求「详情必须独立请求」，需产品裁决。
3. **`provider-search` 已建契约但页面未接线**：人工匹配当前走 resolve 对话框的 `payload` 手填 JSON
   （`{"providerItemId":"..."}`）。若要「点选候选 → 自动填 payload」的交互，需要接 provider 搜索面板——建议下一卡。
4. **后端不缺端点**：本次 4 页所需端点在 `crates/fmby-v2-http/src/routes/mod.rs` 均已注册，
   **无需后端补端点**（无登记缺口）。
5. **`api-contract-fields.json` 字段级契约缺失**：`media-reviews` / `events` / `operations` 三条在真值文件里
   `responseFields` 为 `None`（`responseType: Value`）。本次字段形状取自**后端路由源码**
   （`media_reviews.rs` / `manage_events.rs` / `manage_operations.rs` 的 `ticket_to_json` / `item_to_json` / overview 组装），
   与真值一致。**建议后端把这几条的字段级真值补进 json**，否则后续对齐只能回源读 Rust。

---

## 4. 验证记录

```
pnpm verify   # 11 闸全绿
```

- `typecheck`（shared + host + 主题）通过
- `build` / `build:themes` 通过；4 页各自产出独立 lazy chunk
  （`ManageMediaReviewsPage-*.js` / `ManageEventsPage-*.js` / `ManageOperationsPage-*.js` / `ManageUpstreamsPage-*.js`）
- `size`：首屏 JS gzip 181.93 KB / 300 KB 预算内（4 页均为 lazy，不进首屏闭包）
- `dupes` / `contracts`：raw DTO 零泄漏页面、零自建 HTTP client
- 产物反查确认真实端点路径命中（`/api/manage/media-reviews`、`/api/manage/events`、
  `/api/manage/operations/overview`、`/api/manage/upstreams`、`/api/manage/upstreams/emby/discover-lan`）
