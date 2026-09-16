# V1F-02-S4b 交接（w1 · 前端仓 w/zcode/writer1-web-s4b）

> Upstreams 子资源 UI（类别/媒体库发现与绑定 + 映射预设 CRUD/preview/apply）
> + 上一卡遗留第 3 项（provider-search 点选候选自动填 payload）。
> 后端端点全部已存在，此前用户看不到。后端仓**只读参考，未改一行**。

- 基线：`origin/main` @ `e011a5e`（含上一卡 4 页）
- 提交：**4 个**（① Upstreams 子资源 `a22de88` · ② provider-search `8b6f7ab` · ③ handoff `8baa463` · ④ 红线拆分 `ac31dc3`）
- 门禁：`pnpm verify` **11 闸全绿**

---

## 1. 消费端点清单

### 1.1 类别与媒体库发现/绑定（7 端点，全部接线）

| 方法 | 端点 | 用途 | 页面位置 |
|---|---|---|---|
| `GET` | `/api/manage/upstreams/{id}/apple-cms/categories` | 已发现 AppleCMS 分类列举 | 类目绑定 Tab |
| `GET` | `/api/manage/upstreams/{id}/emby/libraries` | 已发现 Emby 媒体库列举 | 类目绑定 Tab |
| `GET` | `/api/manage/upstreams/{id}/bindings` | 当前生效绑定总览（只读） | 类目绑定 Tab |
| `POST` | `/api/manage/upstreams/{id}/apple-cms/discover-categories` | 真实分类发现（S3） | 「发现」按钮 |
| `POST` | `/api/manage/upstreams/{id}/emby/discover-libraries` | 真实媒体库发现（S3） | 「发现」按钮 |
| `PUT` | `/api/manage/upstreams/{id}/apple-cms/category-bindings` | 分类绑定**整表替换** | 「保存绑定」 |
| `PUT` | `/api/manage/upstreams/{id}/emby/library-bindings` | 媒体库绑定**整表替换** | 「保存绑定」 |

- 本地库下拉复用既有 `manageApi.getLibraries()`（不新造端点）。
- **整表替换语义**已在 UI 明示：绑定保存为全量覆盖，未选中的会解除绑定；
  按钮显示「N 项改动」，`dirtyCount === 0` 时禁用。

### 1.2 映射预设（4 端点）

| 方法 | 端点 |
|---|---|
| `GET` | `/api/manage/upstreams/{id}/mapping/presets` |
| `POST` | `/api/manage/upstreams/{id}/mapping/presets` |
| `PUT` | `/api/manage/upstreams/{id}/mapping/presets/{preset_id}` |
| `DELETE` | `/api/manage/upstreams/{id}/mapping/presets/{preset_id}` |

### 1.3 映射预览与应用（2 端点，两段式）

| 方法 | 端点 | 说明 |
|---|---|---|
| `POST` | `/api/manage/upstreams/{id}/mapping/preview` | 纯计算**不写库** |
| `POST` | `/api/manage/upstreams/{id}/mapping/apply` | **落库，不可逆** |

- **apply 用 `SensitiveActionDialog` + 明确二次确认**（与后端能力门一致），
  确认框列出 impact：绑定 N / 新建 N / 跳过 N / 冲突 N。
- apply 请求体按后端 `UpstreamMappingApplyDto` 的 `#[serde(flatten)]` 语义：
  **preview 字段平铺 + 可选 `savePresetName`**（已在契约层封装，调用方不感知）。
- 未生成预览就点应用时，确认框明示「尚未生成预览，将直接按当前条件应用」。

### 1.4 provider-search（上一卡遗留项）

| 方法 | 端点 | 说明 |
|---|---|---|
| `GET` | `/api/manage/media-reviews/provider-search` | 人工匹配候选搜索 |

- 仅在 resolve 对话框选中「**人工匹配（锁定外部 ID）**」时展开候选面板；
  点「选用」自动把 `{provider, providerItemId, entityType, externalId}` 填进 payload，
  **不再手填 JSON**。其余动作不展开该面板。

---

## 2. 页面结构（红线：组件 >400 行 → 已拆）

原 `ManageUpstreamsPage.tsx` 562 行，加子资源会远超红线，故拆为
`host/src/pages/manage/upstreams/`（沿用 `media-items/` / `task-center/` 既有目录约定）：

| 文件 | 职责 | 行数 |
|---|---|---|
| `ManageUpstreamsPage.tsx` | **Tab 壳**（上游源 / 类目绑定 / 映射）+ 目标源选择器 | 150 |
| `upstreams/shared.ts` | 常量与表单工具（源表单、列表解析、时间格式化） | 113 |
| `upstreams/UpstreamSourceListSection.tsx` | 源 CRUD + 启停 + 探活 + 局域网发现 | **313** |
| `upstreams/SourceFormDialog.tsx` | 源新建/编辑表单（纯展示 + 受控） | 160 |
| `upstreams/UpstreamBindingsSection.tsx` | 类目绑定草稿 + 整表替换保存 + 绑定总览 | 289 |
| `upstreams/UpstreamMappingPresetsSection.tsx` | 预设 CRUD | 355 |
| `upstreams/UpstreamMappingWizardSection.tsx` | 预览 → 应用两段式 | 326 |

**红线 400 已清零**（commit `ac31dc3`）：初版 `UpstreamSourceListSection.tsx` 435 行超限，
把源表单 Dialog 抽成 `SourceFormDialog.tsx` 后降到 313 行。表单为纯展示 + 受控，
状态与提交仍由 `UpstreamSourceListSection` 持有，**行为零变更**。
`upstreams/` 下全部文件（含页面壳）现均在 400 以内。

## 3. 契约与接线

- `shared/src/contracts/manage/upstreams/`：`types.ts` + `api.ts` 续写
  （类别/库/绑定/预设/预览/应用 的 raw DTO + mapper 双件套，raw 零泄漏页面）
- `shared/src/query/keys.ts`：`upstreams` 下新增 `categories` / `libraries` /
  `bindings` / `presets` 四组
- **路由与侧栏未动**（上一卡已就位，本卡按裁决接在同一页内，无入口碎片化）

---

## 4. 裁决结果 / 遗留登记

1. **红线拆分（原 435 行）→ 本轮已做**（裁决 1）。见 §2，`ac31dc3`，全部文件入 400。
2. **逐类目 overrides UI → 登记待办卡**（裁决 2，不在本卡）。后端 `UpstreamMappingOverrideDto`
   支持逐类目 `selected / action / libraryId / libraryName / libraryType` 覆盖；契约层
   `overrides` 字段已留好（当前恒传 `[]`），不阻塞后续——UI 后补即可。
3. **provider 候选下拉硬编码 `tmdb` / `douban` → 接受现状**（裁决 3）。
   理由：V2 `builtin_secrets` 内置可用 provider 即这两个（TMDB 国际、豆瓣），硬编码与当前事实一致；
   后端补枚举端点属「更正确但非必要」（YAGNI），已登记为**可选小卡**。
4. **后端不缺端点**：本卡 13 个端点在 `crates/fmby-v2-http/src/routes/mod.rs` / `upstream_discovery.rs`
   均已注册，**无需后端补端点**。
5. **字段级真值仍缺**：`api-contract-fields.json` 里 upstreams 子资源的
   `requestFields` / `responseFields` 同样不完整。本卡字段形状取自后端源码
   （`state/upstream_discovery.rs` 的 DTO 定义 + `routes/upstream_discovery.rs` 的 handler），
   与真值一致。**仍建议后端补齐**（同上一卡登记项）。

---

## 5. 验证记录

```
pnpm verify   # 11 闸全绿（exit 0）
```

- `typecheck`（shared + host + 主题）通过
- `build` 通过；产物反查确认 10 条子资源路径命中
  （`apple-cms/categories`、`apple-cms/category-bindings`、`apple-cms/discover-categories`、
  `emby/libraries`、`emby/library-bindings`、`emby/discover-libraries`、`bindings`、
  `mapping/presets`、`mapping/preview`、`mapping/apply`）
  + `provider-search` 命中
- `size`：首屏 JS gzip 仍在 300 KB 预算内（新增分区随页 lazy，不进首屏闭包）
- `dupes` / `contracts`：raw DTO 零泄漏页面、零自建 HTTP client
