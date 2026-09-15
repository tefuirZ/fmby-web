# 证据/产物入库策略（docs/evidence-policy.md）

> 适用仓：`tefuirZ/fmby-web`（前端独立仓）。**REPO-HYGIENE-01** 立。
>
> 一句话：**仓库只进「人读的文本 + 少量代表样本」；机器产物（截图全量、报告、trace）
> 外置到 CI artifact / 发布附件。**

## 为什么（动机）

FE-OPT-02 一次性入库 76 张 playwright 截图（3.9 MiB PNG）。单次不大，但**每轮 UI 审计
都会再产一批**——仓库随审计次数线性膨胀。这与「仓库保持轻量」的原则冲突，也是 V1
（70 万行、多份重复前端）教训的同源问题：**产物与源码混住 → 仓库变成垃圾桶**。

## 分类：什么该入库 / 什么该外置

| 类别 | 例子 | 入库？ | 去向 |
| --- | --- | --- | --- |
| 源码 / 配置 | `host/src/**`、`themes/**`、`*.mjs` 门禁脚本 | ✅ 入库 | — |
| 人读文档 | `docs/*.md`、`README.md`、handoff | ✅ 入库 | — |
| 契约 / 版本 | `theme.manifest.json`、`package.json` | ✅ 入库 | — |
| **代表样本**（抽样截图） | `docs/evidence/<卡>/samples/<断点>/<页>.png` | ✅ 入库（**≤1 MiB 总量**） | — |
| 截图**全量集** | `docs/evidence/<卡>/full/**` | ❌ 外置 | CI artifact / 发布附件 |
| Playwright 产物 | `test-results/`、`playwright-report/`、trace、视频 | ❌ 外置 | CI artifact（`.gitignore`） |
| 构建产物 | `dist/`、`.vite/`、`*.tsbuildinfo` | ❌ 外置 | 构建期生成（`.gitignore`） |
| 大设计稿 / 原型导出 | `host/docs/*.html`（自包含设计方向稿） | ⚠️ 例外 | 见下「既有例外」 |
| 数据库 / 媒体 / 归档 | `*.db`、`*.zip`、`*.mp4` | ❌ 外置 | 外部存储 |

## 硬性规则

### R1. 审计截图只保留抽样（每卡每类 ≤ 8 张）

「代表样本」选取口径：**覆盖每个断点 × 每个页面类别（browse / manage / settings /
playback / observability）各一张**。样本入库；其余全量集写 `<卡>/full/`（gitignored），
随 CI 上传 artifact。

样本 + 该卡的 `README.md`（索引：样本清单 + 生成命令 + 未入库清单）构成**可复现证据**：
任何人在本地/CI 跑一次 spec 即可重建全量集，故全量集不必入库。

### R2. 二进制产物总量 ≤ 1 MiB（`check-repo-size` 门禁）

`scripts/check-repo-size.mjs`（接入 `pnpm verify`）以 `git ls-files` 索引为准，汇总所有
**二进制/产物**扩展名（图片/字体/归档/媒体/数据库/可执行/wasm/pdf…）的**真实 blob 字节**：

- **总量守卫（默认 1 MiB）**：仓库级二进制总量超限 → **FAIL**。这是防膨胀的真正不变量
  （只卡单次 diff 挡不住「每次加一点」的慢性膨胀）。
- **增量守卫（可选）**：设 `REPO_SIZE_BASE_REF=<ref>` 后，额外检查 `<ref>..HEAD` 新增的
  二进制字节量 ≤ `REPO_SIZE_MAX_DELTA`（默认 1 MiB）——供 CI 在 PR 场景精确拦截「本次
  超量入库」。

  ```bash
  # 本地
  pnpm repo-size
  # CI（PR 场景）
  REPO_SIZE_BASE_REF=origin/main pnpm repo-size
  ```

上限调整需主代理裁定（`REPO_SIZE_MAX_TOTAL` / `REPO_SIZE_MAX_DELTA` 环境变量）。

> 计数口径说明：门禁读**索引**（`git ls-files` + `git cat-file`），故 `git add` 了大文件
> 但未 commit 时即会失败（预提交守卫）；也覆盖「工作树干净但历史 bloated」之外的一切
> 当前状态。

### R3. 外置产物的命名与归档

- 截图全量集：`docs/evidence/<卡>/full/<断点>/<页>.png`（`.gitignore` 已含 `docs/evidence/**/full/`）。
- CI 上传 artifact 时保留同样的相对路径，便于与仓库内索引对照。
- 生成脚本须支持 `EVIDENCE_DIR`（或等价）覆盖输出根，使 CI 可写到 workspace 外的 artifact 目录。

## 既有例外（历史遗留，登记不改）

| 文件 | 大小 | 处置 |
| --- | --- | --- |
| `host/docs/design-directions.html` | ~1.0 MiB | 自包含设计方向稿（单文件即可离线打开，含内联 CSS/JS）。**当前入库**——它是「人读设计文档」而非机器产物，且已是单文件形态。登记：若继续增长，应改为外链资源或移到发布仓。 |
| `host/docs/darkroom-preview.html` | ~0.4 MiB | 主题预览快照（同上）。 |
| `shared/src/**/*.d.ts{,.map}` | 合计 ~0.1 MiB | TS 声明产物（随源码提交的历史惯例）。非二进制、不入本闸预算；登记为「可评估移除」。 |

上表例外不进 `check-repo-size` 的二进制预算（`.html` 不算二进制；`.map` 为文本）。

## 流程（提交审计产物时）

1. 跑 `mobile-audit` / 对应 spec → 生成全量集到 `<卡>/full/`（gitignored）。
2. 从全量集中挑 ≤8 张样本，复制到 `<卡>/samples/`。
3. 更新 `<卡>/README.md` 索引（样本清单 + 大小 + 生成命令）。
4. `pnpm repo-size` 必须 PASS；`pnpm verify` 全绿。
5. CI 将 `<卡>/full/` 上传为 artifact，附到卡/Release。

## 相关

- 门禁脚本：`scripts/check-repo-size.mjs`（本仓）。
- 既有前端其它体积门禁：`scripts/check-frontend-size.mjs`（首屏 JS 闭包 <300KB gzip +
  主题隔离反查）、`scripts/check-theme-budget.mjs`（主题质量/体积）。
- 首个应用本策略的卡：`docs/evidence/fe-opt-02/README.md`。
