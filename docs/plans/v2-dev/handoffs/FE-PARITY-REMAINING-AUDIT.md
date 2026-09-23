# FE-PARITY-REMAINING-AUDIT —— W5-D 机械核对

> **卡**：W5-D（前端 parity 剩余项机械核对）｜分支 `w/zcode/writer1-w5d-parity-audit`（base 合并 origin/main @ `cc493e4` → merge 后 `835b866`）
> **方法**：① 后端用 `git grep -n` 找路由 handler + wire 字段；② 前端在 `shared/src/contracts` 找契约方法、在 `host/src`（排除 `.test.`）找**真实调用处**；③ 契约有方法 ≠ 有消费点，必须定位真实调用文件。
> **红线**：只动 fmby-web-main / 零新依赖 / 禁全仓 prettier / 不删弱断言 / 不碰 MountTable（394/400）。

## §1 机械核对逐项表（基于合并 origin/main 后的真实代码）

| # | 后端端点 | 前端契约方法 | host 真实调用文件数 | 结论 |
|---|---|---|---|---|
| 1 | `mounts/batchRefreshAbnormalMounts` | `batchRefreshAbnormalMounts` | 1 | 已消费 |
| 2 | `mounts/refreshMountAccess` | `refreshMountAccess` | 5 | 已消费 |
| 3 | `pan115/previews/{id}/browse` | `browsePreview` | 1 | 已消费 |
| 4 | `pan115/share-items/browse` | `browseShareItem` | 1 | 已消费 |
| 5 | `pan115/sync/mounts/{id}` | `syncOverview` | 1 | 已消费 |
| 6 | `pan115/sync/mounts/{id}/enqueue` | `syncEnqueue` | 1 | 已消费 |
| 7 | `upstreams/{id}/sync-jobs` | `listSyncJobs` | 1 | 已消费 |
| 8 | `upstreams/{id}/sync-jobs/{job_id}` | `getSyncJob` | **0** | **真缺（已补，见 §2）** |
| 9 | `upstreams/apple-cms/sync` | `appleCmsSync` | 1 | 已消费 |
| 10 | `upstreams/emby/sync` | `embySync` | 1 | 已消费 |
| 11 | `upstreams/emby/import` | `embyImportEnqueue` | 1 | 已消费 |
| 12 | `rewards/rule` GET | `getRewardsRule` | 1 | 已消费 |
| 13 | `rewards/rule` POST | `publishRewardsRule` | 1 | 已消费 |
| 14 | `rewards/points/adjust` | `adjustRewardsPoints` | 1 | 已消费 |
| 15 | `rewards/stats` | `getRewardsAdminStats` | 1 | 已消费 |
| 16 | `operations/data-sources/load` | `mountLoad` | 1 | 已消费 |
| 17 | `operations/playback/active` | `activePlayback` | 1 | 已消费 |

## §2 确属「前端真缺且后端已就绪」并实现的项

**仅 1 项：`getSyncJob`（单个同步作业详情）**

- 后端：`crates/fmby-v2-http/src/routes/upstreams_routes.rs:168` `GET /manage/upstreams/{id}/sync-jobs/{job_id}`（`upstream_sync::sync_job`），能力闸 MANAGE_MOUNT。
- 契约：已存在 `upstreamsApi.getSyncJob(id, jobId)` + `UpstreamSyncJob` + `fromSyncJob`（raw→domain，snake_case）。
- 缺口：`listSyncJobs` 的 UI（`UpstreamSyncJobsSection.tsx`）列了作业，但点击行看**单个作业详情**的 `getSyncJob` 一直没接 UI → 真缺。
- 实现（不新写 UI 体系，复用既有区块）：
  - `UpstreamSyncJobsSection` 的作业行改为可点击（`role=button` + `tabIndex=0` + Enter/Space 键盘可达，WCAG 2.4.7 焦点环），选中后渲染 `JobDetail` 面板，走 `useQuery({ queryKey: queryKeys.manage.upstreams.syncJob(id, jobId), enabled: selectedJobId!==null })` 调 `getSyncJob`。
  - 新增 `queryKeys.manage.upstreams.syncJob(id, jobId)`。
  - 错误态 fail-closed 透传（500/403 不吞成空作业）。
- 测试：`host/tests/upstreams-sync.contract.test.ts` 新增 ⑪（URL + ID 编码 + 字段映射）/ ⑫（500 必须 reject）；共 12 项全绿。

## §3 只登记不实现（需后端改字段 / 后端没实现）

无。本批审计清单中的 17 项后端均**已就绪**，其中 16 项前端此前卡已消费，1 项（getSyncJob）本卡补齐。审计文档 `docs/FE-REPO-DOC-CLAIM-AUDIT.md` §6 列的"仍成立真缺口"在合并最新 main 后已**全部被此前卡消费**——该文档快照陈旧（写于 operations/pan115-share/upstreams/rewards 各卡合入 main **之前**），本次核对已用合并后的 main 重新对账。

## §4 验证

- `pnpm verify` EXIT=0；host pass / 0 fail（含新增 2 项上游同步测试）；shared 94 pass；component-size **0 违规**；contracts 0 违规。
- `UpstreamSyncJobsSection.tsx` 行数受控（未越 400）；`MountTable.tsx` 未触碰（394/400）。
- 零新依赖。
