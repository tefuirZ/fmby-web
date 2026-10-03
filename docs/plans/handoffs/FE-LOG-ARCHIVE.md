# FE-LOG-ARCHIVE handoff（运行日志归档清单 + 下载入口）

> 分支：`w/zcode/fe-log-archive`（基于 origin/main `10c5298`）
> 写手：zcode · `Reviewed-by: pending-non-author-review`

## 缺口核实（origin/main ref）
- 后端：`GET /api/manage/runtime-log-archives`（VIEW_AUDIT 门，QUERY-CAMELCASE
  主名 pageSize）+ `GET .../{archiveId}/download`（zip 流）均在 main
  （`routes/manage/runtime_log_archives.rs`；id=sha256(file_name)）。
- 前端：全 ref 零调用（日志页走 `/api/manage/runtime-logs`，gap-sweep 文档登记为缺口）。

## 交付
- `shared/contracts/manage/runtime-log-archives/` 三件套：types / api
  （snake→camel mapper；下载走原生 fetch blob——httpClient.get 只出 JSON，
  same-origin cookie 自动携带）/ index；
- `RuntimeLogArchivesSection`：归档表（文件名/日志日/压缩前后/压缩比/保留到期/下载），
  挂进既有 `ManageRuntimeLogsPage` 尾部（同 ManageSectionCard 风格）；
- queryKey 复用 `runtimeLogs('archives')` spread 形态（既有 keys.ts 零改动）；
- 契约测试 4 用例（路径原样/pageSize 主名不带 snake 别名/mapper 逐字段含可空
  log_date/expires_at/下载 URL encodeURIComponent）。

## 验证原文
```
shared tsc → EXIT=0
host npm test → 401 passed / 0 failed（含 4 新用例）
check-contract-mappers → PASS 0 violations
check-frontend-component-size → PASS
check-repo-size → PASS
host tsc → 22 错全为 main 存量（与上卡 FE-STORAGE-FOOTPRINT 干净 main 对照相同，
  全在我未触碰的 LoginPage/CollectionsListPage 等）
```

## 跳过
- 分页 UI（清单默认全量；后端支持 page/pageSize，前端现有量级一页足够）；
- e2e（需后端 live + 归档目录 fixture）。
