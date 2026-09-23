# FE-AI-INTERVENTIONS 交付说明 · AI 干预会话面前端接入

**仓库**：`ws-zcode-writer1-web`　**分支**：`w/zcode/writer1-fe-ai-interventions`
**基点**：`34947d0`（v0.2.11）→ **已同步 `origin/main` = `485812e`**（含 FE-TSC-ARTIFACTS）
**提交**：`178e231`（契约+UI+测试）→ `d3d35e1`（handoff）→ `f7ec406`（Merge origin/main）
**判据（合并后）**：`pnpm verify` **EXIT=0**（host **320** / shared **99** / component-size 0 违规）。
**改动面（相对 `485812e`）**：**17 文件 / +2058**，其中 **0 个 `.d.ts` 被碰**（FE-TSC 的删产物改动原样保留）。

## ponytail 段

- **阶梯**：先复用仓内既有（`@fmby/v2-shared/ui`、`longtail-shared/components`、既有 queryKeys/错误范式）→ 契约照 V2 仓内范式（`types+api+index` 目录，内联私有 raw，照 `license`/`operations`）→ 只写必需组件；**零新依赖**。
- **点名天花板 + 升级路径**：契约 API 模块 307 行（<400）；UI 最大 317 行（ProviderPanel）。若后续再加「任务中心 AI 干预卡」（V1 另有一处，见下）→ 复用同一 contract/hooks，不新建一套。
- **跳过了什么/何时再加**：① 未做服务端筛选/分页（**后端无此能力**，见缺口）；② 线程标题列不做伪造（后端无 `mediaTitle`）；③ V1 web-gallery 的第二实现**不整搬**（详见文末）；④ A2 `suggest` 已接契约与 API，但未在 UI 放入口（登记待裁）。

---

## ① 定位结论（codegraph / 只读核实）

### 卡面更正：**实为 7 条路由，非 6 条**
`crates/fmby-v2-http/src/routes/router_manage.rs:239-267` 注册 **7** 条；handler 全在
`crates/fmby-v2-http/src/routes/ai_interventions.rs`。该文件 doc-comment 陈旧（写「当前 1 端点」，且
router_manage 注释写「V1 会话式 6 端点为后续期」）——**该文件属后端仓，仅登记不改**。

| # | 方法 路径 | handler | 请求体 | 响应体 |
|---|---|---|---|---|
| 1 | GET `/api/manage/ai-interventions/threads` | `ai_interventions.rs:71` | Query `{limit?,offset?}`(`:42`) | **裸数组** `Vec<AiInterventionThread>` |
| 2 | GET `…/media/{id}` | `:91` | — | `ThreadDetail{thread,messages,runs}`(`state/ai_intervention.rs:20`) |
| 3 | POST `…/media/{id}/session/open` | `:111` | `{preferred_skill_key?}`(`:49`) | `AiInterventionThread` |
| 4 | POST `…/session/message` | `:132` | `{session_id, message}`(`:54`) | `AiInterventionSessionMessage` |
| 5 | POST `…/session/close` | `:151` | `{session_id}`(`:59`) | `AiInterventionThread` |
| 6 | POST `…/media/{id}/apply` | `:170` | `{session_id}`(`:64`) | `AiInterventionThread` |
| 7 | POST `…/media/{id}/suggest`（A2 只读） | `:202` | — | `AiSuggestResponse`（camelCase，`state/ai_assist.rs:27`） |

域/enum 真源：`crates/fmby-v2-domain/src/ai_intervention.rs`（Thread `:80` / Run `:105` / Message `:128`）；
enum casing：`SkillKey`=snake、`RunKind`/`SessionState`/`MessageRole`=**PascalCase**（`:12-73`）。
能力闸统一 `MANAGE_LIBRARY`；端口未装配 → **500 fail-closed**。

**AI-assist 设置（provider 面板依赖）**：`GET/PUT /api/settings/integrations/ai-assist`
（`routes/settings.rs:305/328`）。★**同端点两向不同形**：读体 snake_case
（`fmby-v2-application/src/settings/ai_assist.rs:49`）；写体 camelCase 正名 + snake alias（`:123`），
但**嵌套 `policy` 仍 snake_case**（`:88`）。

### V1 权威源
`apps/shared/src/contracts/manage/ai-interventions{,-types}.ts`；`apps/shared/src/contracts/settings/ai-assist.ts`；
`apps/web/src/domains/manage/ai-interventions-api.ts`；
`apps/web/src/pages/manage/naming-rules/ai-intervention/{AiInterventionSection,AiInterventionPanels,aiInterventionSupport}`。

### codegraph 记录
- `codegraph query "ai_interventions_threads" -p FMBY-V2` → `crates/fmby-v2-http/src/routes/ai_interventions.rs:71`。
- `codegraph callers "AiInterventionSection" -p apps/web` → **2 处**：`ManageNamingRulesPage.tsx`、
  `apps/web-gallery/src/ManageNamingScrapeSurface.tsx:43`（第二前端）。
- `codegraph callers "aiInterventionsApi" -p .`（V2）→ 本次新增的 2 个 hooks + 契约测试（无历史消费点，确认零消费）。

## ② 对位表（端点 → V2 落点）

| 端点 | V2 落点 | 复用 |
|---|---|---|
| threads | `components/AiInterventionThreadList.tsx` | `ManageSectionCard`、`StatusBadge`、表格样式 |
| media/{id} | `components/AiInterventionDetailPanel.tsx` | `FeedbackState`、`StatusBadge` |
| session/open | 详情面板「发起会话」（技能下拉） | — |
| session/message | 详情面板会话输入（取 `thread.currentSessionId`） | — |
| session/close | 详情面板「关闭会话」 | — |
| media/{id}/apply | 详情面板「应用最近结果」 | — |
| media/{id}/suggest | 契约 + API 已备（`suggestForMediaItem`），**UI 入口待裁** | — |
| settings/ai-assist | `components/AiInterventionProviderPanel.tsx` | `FeedbackState` |

**挂载点**：`host/src/pages/manage/ManageNamingRulesPage.tsx`（照 V1 `:152`，页尾）。

## ③ V1↔V2 差异（一律以 V2 后端为准）

1. **message/close 路径不同**：V1 `/media/{id}/session/{message,close}`；V2 `/session/{message,close}` + `{session_id}`。
2. **apply 需 `{session_id}`**（V1 无 body）。
3. **threads 返回裸数组**（V1 为 `{items,total,page,size}`）。
4. **open body**：V2 `{preferred_skill_key}`（snake）。

## ④ 后端缺口（**只登记，不造**）

1. `threads` 无 `search`/`sessionState`/`applied` 过滤（仅 limit/offset）→ UI 客户端筛选并明示。
2. `threads` 无 `total/page`（裸数组）→ 无真实分页。
3. `AiInterventionThread` **无 `mediaTitle`** → 列表标题列显示 **`—`**（不伪造），媒体项 id 单独显示。
4. handler 文件 doc-comment 陈旧（写「1 端点」，实为 7）——属**后端仓**，仅登记。

## ⑤ RED → GREEN 原文

**RED**（先写测试，模块未实现）：
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../shared/src/contracts/manage/aiInterventions/index.ts'
    at ... host-alias-loader.mjs
✖ host/tests/ai-interventions.contract.test.ts (502.061027ms)
ℹ tests 1
EXIT=1
```

**GREEN**（实现后）：
```
✔ ① threads：GET 路径 + 裸数组（无包裹）+ camelCase 映射 + Pascal 枚举保留
✔ ①b threads：limit/offset 作为查询参数
✔ ② 详情：GET media/{id} + {thread,messages,runs}
✔ ③ session/open：POST media/{id}/session/open + body {preferred_skill_key}
✔ ③b session/open：无 preferredSkillKey 时 body 为空对象
✔ ④ session/message：POST /session/message + body {session_id,message}（V2 session 版）
✔ ⑤ session/close：POST /session/close + body {session_id}
✔ ⑥ apply：POST media/{id}/apply + body {session_id}
✔ ⑦ suggest（A2）：POST media/{id}/suggest + camelCase 响应
✔ ⑧ ai-assist GET：读体 snake_case → 域 camelCase
✔ ⑨ ai-assist PUT：写体 **camelCase 正名** + 嵌套 policy **snake_case**（混合 casing）
✔ ⑩ fail-closed：端口未装配 500 必须 reject（不吞成空数组/假成功）
ℹ tests 12 / ℹ pass 12 / ℹ fail 0
```

**当次（合并前）`pnpm verify`**：`EXIT=0`，host 320 / shared 99，全闸 PASS。
> 中途一次 `pnpm verify` EXIT=1：`components/*.tsx` 的 CSS 相对深度写成 2 级（实需 3 级）→ vite 构建无法解析；已修（3 个文件）。

**合并 `origin/main` = `485812e` 后重跑 `pnpm verify`（本卡最终判据）**：
```
$ git merge origin/main --no-edit   # f7ec406，0 冲突
$ git status --short | wc -l        # 0
$ git ls-files shared/src | grep '\.d\.ts'   # 仅 shared/src/global.d.ts（FE-TSC 删产物生效）
$ pnpm verify                       # EXIT=0
[PASS] 版本门禁通过（四层独立版本 + 契约对齐）。
shared test: ℹ pass 99 / ℹ fail 0
host test:   ℹ pass 320 / ℹ fail 0
[PASS] 仓库二进制产物在预算内（策略见 docs/evidence-policy.md）。
[PASS] 0 violations found. All frontend architectural boundaries clean.
[PASS] 0 contract violations found. All contracts & domain mappers cleanly aligned.
[PASS] 主题质量门禁通过（无 God File；总量不设限）。
=== FMBY v2 前端组件行数门禁（CONSTRAINTS MD-3 棘轮）===
[1] 扫描 host/src + shared/src 的 .tsx 与非组件 .ts（.tsx/非契约 .ts > 400 warn / > 500 fail；契约 .ts > 400 warn / > 1200 fail）...
[PASS] 0 违规；3 个存量超线文件在基线内且未上升（棘轮允许，须有拆分计划）。
[PASS] All declared domain skins satisfy required capabilities.
```
> **合并无冲突**：本卡从未触碰 `shared/src/**/*.d.ts`，FE-TSC 的 156 文件删除对「未改动」侧自动生效（git 无 modify/delete 冲突）；`shared/src/contracts/**` 下本卡新增的是 `.ts`（`aiInterventions/`、`settings/aiAssist.api.ts`），与 FE-TSC 的删产物语义正交，**双方改动均完整保留**。
> **新 `.ts` 门禁下无新增违规**：本卡新 `.ts` 最大 307 行（`aiInterventions/api.ts`），全部 <400。
> 相对新 main 的 diff = **恰为本卡 17 个文件**（无基点噪音）。

## ⑥ 待裁 / 登记（含主代理裁定）

1. **A2 `suggest` UI 入口 —— 裁定：本卡不加**。契约与 API 已备（`suggestForMediaItem`，含单测）；只读、与 6 个会话端点生命周期不同，留给「AI 建议面」单独卡。
2. **web-gallery 第二件 —— 裁定：不整搬**。经 codegraph，其挂载点是 `ManageNamingScrapeSurface.tsx:43`；V2 只有 `ManageNamingRulesPage` 一个壳，故行为等价并入同一 section。**未发现 gallery 版有主前端没有的交互**（两者同源）。
3. **V1 任务中心 `TaskCenterAiInterventionSection`（`TaskCenterDetailDrawer.tsx:205`）—— 裁定：另开卡**，不并进本卡；届时复用同一 contract/hooks。
4. **后端小卡建议**：`threads` 补 `mediaTitle`（join media_item.title）+ `search/sessionState` 过滤 + 分页 total；handler doc-comment 更新。

## 红线遵守
零新依赖 / 未碰 themes / 未碰 /manage 授权面 / 未动 `shared/src/**/*.d.ts` / 未并 integration/BATCH / 未 push main。
