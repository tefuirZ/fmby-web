# FE-OPT-02 审计截图索引（抽样）

> **REPO-HYGIENE-01 策略**：完整截图集（76 张 / 3.9 MiB）**不入库**，只保留 8 张
> 代表样本 + 本索引。全量集由 `mobile-audit.spec` 生成到 `full/`（**gitignored**），
> 作为 CI artifact / 发布附件归档。策略全文见 [`docs/evidence-policy.md`](../../evidence-policy.md)。

## 生成方式（本地/CI，可复现）

```bash
# 全量 76 张写 docs/evidence/fe-opt-02/full/<device>/<page>.png（gitignored）
pnpm --filter @fmby/v2-host test:e2e -- mobile-audit
# 或指定输出根
EVIDENCE_DIR=docs/evidence/fe-opt-02 pnpm --filter @fmby/v2-host test:e2e -- mobile-audit
```

工具：`host/e2e/mobile-audit.spec.ts`（真实栈：真实 `fmby-v2-server` + 真实 SQLite）。

## 入库样本（8 张，覆盖 3 断点 × 关键页类别）

| 断点 | 页面 | 类别 | 文件 | 大小 |
| --- | --- | --- | --- | --- |
| phone-375 | 首页 | browse | `samples/phone-375/home.png` | 91.0 KiB |
| phone-375 | 播放页 | playback | `samples/phone-375/playback.png` | 33.1 KiB |
| phone-375 | 媒体库管理 | manage | `samples/phone-375/manage-libraries.png` | 41.9 KiB |
| tablet-768 | 首页 | browse | `samples/tablet-768/home.png` | 296.2 KiB |
| tablet-768 | 站点设置 | manage | `samples/tablet-768/manage-site-settings.png` | 124.0 KiB |
| desktop-1280 | 媒体库列表 | browse | `samples/desktop-1280/libraries.png` | 16.8 KiB |
| desktop-1280 | 管理首页 | manage | `samples/desktop-1280/manage-overview.png` | 22.4 KiB |
| desktop-1280 | 站点设置 | manage | `samples/desktop-1280/manage-site-settings.png` | 131.5 KiB |
| | | | **合计** | **757.1 KiB** |

样本选取依据（对应 FE-OPT-02 的修复面）：
- **phone-375/home**：TopBar 手机档收窄 + 横向溢出清零的代表（修复最集中的页面）。
- **phone-375/playback**：播放页移动端（进度条可拖 / 控件可达）。
- **phone-375/manage-libraries**：管理面窄屏表格横滚 + 抽屉。
- **tablet-768/home**、**tablet-768/manage-site-settings**：中档断点的 browse / manage 代表。
- **desktop-1280/{libraries,manage-overview,manage-site-settings}**：桌面档 browse / manage / 表单代表。

## 未入库（全部 76 页 × 3 断点）

完整清单（25 页 × 3 断点 + phone 播放页 = 76）：

| 断点 | 页数 | 页面 |
| --- | --- | --- |
| phone-375 | 26 | home, libraries, history, settings-appearance, settings-profile, manage-overview, manage-media-items, manage-media-add, manage-libraries, manage-mounts, manage-probe-tasks, manage-naming-scrape, manage-collections, manage-task-center, manage-registration-codes, manage-users, manage-role-templates, manage-sessions, manage-audit-logs, manage-runtime-logs, manage-site-settings, manage-license, manage-telegram, manage-secrets, manage-advanced, playback |
| tablet-768 | 25 | 同上（无 playback） |
| desktop-1280 | 25 | 同上（无 playback） |

这些由 `mobile-audit.spec` 重新生成即可（见上「生成方式」），无需入库。
