# 下版计划（前端仓 · 单一来源）

> 每次发布由 `scripts/release/cut-web.mjs` 整段嵌入 `CHANGELOG.md` 当版 `### 下版计划` 节。

## 本版之后立刻要做

- **credential_status 消费**（W5-A）：列表/详情展示 `bound | unbound | expired | not_required`，
  `expired` 给醒目标识 + 重绑/重新授权入口，`not_required` 不显示凭据 UI；
  与既有 `MountHealthDto.last_fault_kind == "credential_expired"` **去重**（同一事实一个入口）。
- **FE-PARITY-OPERATIONS-EXTRA 的真栈核验**：本版只做了静态映射 + 单测（无真栈），
  等后端 V2 服务可跑真栈后补 e2e（`progress_percent` / `cache_status` / `supported_commands` /
  `client_info` 的实际取值需按真响应校准）。
- **snake_case / camelCase 分裂收口**：`manage/operations` 同目录内既有 `/overview` 是 camelCase、
  新接的两条专用端点是 snake_case。已在测试里逐条钉死，但属于长期坑，需在一次**破坏性契约整理**中统一。
- **contract-sync 直跑注意**：仓外还有一份陈旧 checkout `/home/tefuir/rustproject/fmby-web`，
  直跑 `check-contract-sync.mjs` 必须带 `FMBY_WEB_DIR=/home/tefuir/rustproject/fmby-web-main`，
  否则会读到旧副本并误报 `FRONTEND_FIELD_MISSING`。

## 欠账

- 前端仓在此之前**完全没有版本链**（0 tag / 无 CHANGELOG，package.json 停在 0.1.0）——
  本版是首个正式版本，历史提交一次性归入 `0.2.0`。之后应**每次合并一批就发一版**。
- `docs/evidence-policy.md` 的二进制预算闸已接 `pnpm verify`；后续新增截图证据注意预算。
