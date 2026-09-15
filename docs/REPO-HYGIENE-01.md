# REPO-HYGIENE-01 截图/大产物的仓库策略（w3 交付 · 前端仓 w/repo-hygiene）

> 基线：fmby-web main @ `76d3e6b`。分支 `w/repo-hygiene`。
> 动机：FE-OPT-02 一次性入库 76 张 playwright 截图（3.9 MiB PNG），前端仓会随每轮
> UI 审计持续膨胀——与「仓库轻量」原则冲突（V1 七十万行教训同源）。

## 八行报告

- **任务结论**：① 抽样策略落地——76 张 → **8 张代表样本**入库（3 断点 × browse/manage/settings/playback 四类）；② 全量集**外置**——`mobile-audit.spec` 改写到 gitignored 的 `full/`，随 CI artifact / 发布档归档；③ 新增门禁 `check-repo-size`（仓库二进制总量 ≤1 MiB + 可选单提交增量守卫）并接入 `pnpm verify`；④ 存量清理：旧 `docs/evidence-fe-opt-02/`（76 张）→ `docs/evidence/fe-opt-02/{samples,README.md}`；⑤ 文档 `docs/evidence-policy.md` 定分类口径。
- **修改范围**：`.gitignore`、`package.json`（`repo-size` 脚本 + verify 串入）、`scripts/check-repo-size.mjs`(新)、`docs/evidence-policy.md`(新)、`docs/evidence/fe-opt-02/{samples/×8,README.md}`(新)、`host/e2e/mobile-audit.spec.ts`、`README.md`、`docs/FE-OPT-02.md`(路径补注)。
- **测试**：`pnpm verify` 全绿（**11 闸**：versions/typecheck/build/build:themes/test/size/**repo-size**/dupes/contracts/theme-budget/theme-parity）；门禁正/负例均实测（见下）。
- **门禁**：仓库二进制总量 **3.61 MiB → 757.1 KiB（−79.5%）**，PASS（预算 1 MiB，占用 74%）。
- **Review**：门禁以 **`git ls-files` 索引**为准（`git add` 未 commit 即拦截，预提交守卫）；按 **path** 累加而非 blob-oid（内容相同的重复文件仍各自计数）。
- **风险登记**：① `host/docs/*.html`（~1.4 MiB 自包含设计稿）为**既有例外**，`.html` 非二进制不计入本闸，登记在策略文档；② `shared/**/*.d.ts{.map}`（~0.1 MiB）为文本 TS 声明，登记为「可评估移除」；③ 全量集不入库 → 依赖 CI artifact 归档，**无 CI 配置时**需人工跑 spec 重建（README 已给命令）。
- **对主代理依赖**：无。
- **兼容性确认**：`mobile-audit.spec` 断言逻辑零改动（仅截图输出路径）；`verify` 既有 10 闸不变，`repo-size` 为新增第 11 闸。

## 一、Before / After

| 指标 | Before（main） | After | 变化 |
| --- | --- | --- | --- |
| 入库二进制文件数 | 76 | 8 | −68 |
| 入库二进制总量 | 3,789,107 B（3.61 MiB） | 775,275 B（757.1 KiB） | **−79.5%** |
| 门禁 | 无 | `check-repo-size`（≤1 MiB） | 新增 |
| 全量集去向 | 入库 | CI artifact（gitignored `full/`） | 外置 |

## 二、抽样策略（保留哪 8 张）

覆盖口径：**每个断点（375 / 768 / 1280）× 每个页面类别（browse / manage / settings /
playback）至少一张**，并优先选 FE-OPT-02 修复最集中的代表页。

| 断点 | 页面 | 类别 | 大小 |
| --- | --- | --- | --- |
| phone-375 | home | browse（TopBar 手机档 + 溢出清零代表） | 91.0 KiB |
| phone-375 | playback | playback（进度条可拖） | 33.1 KiB |
| phone-375 | manage-libraries | manage（表格横滚 + 抽屉） | 41.9 KiB |
| tablet-768 | home | browse | 296.2 KiB |
| tablet-768 | manage-site-settings | manage | 124.0 KiB |
| desktop-1280 | libraries | browse | 16.8 KiB |
| desktop-1280 | manage-overview | manage | 22.4 KiB |
| desktop-1280 | manage-site-settings | manage | 131.5 KiB |
| | | **合计** | **757.1 KiB** |

样本 + `docs/evidence/fe-opt-02/README.md`（索引：清单 + 生成命令 + 未入库清单）构成
**可复现证据**——全量集不入库，任何人跑一次 spec 即可重建。

## 三、产物外置

- `host/e2e/mobile-audit.spec.ts` 全量截图改写到 `<repo>/docs/evidence/fe-opt-02/full/<断点>/<页>.png`。
- `.gitignore` 新增 `docs/evidence/**/full/`。
- **顺带修复路径偏移 bug**：playwright cwd 为 `host/`，原 `SHOTS = 'docs/evidence/fe-opt-02'`
  会落到 `host/docs/...`（FE-OPT-02 的入库文件实为人工搬移）。现锚定仓库根
  （`import.meta.url` 上溯两级），`EVIDENCE_DIR` 支持相对仓库根 / 绝对路径覆盖。
  **实测**：跑 `sweep phone-375` → 25 张落在 `docs/evidence/fe-opt-02/full/`，`host/docs` 0 张。

## 四、门禁 `check-repo-size`（接入 verify）

`scripts/check-repo-size.mjs`：

1. **仓库级总量（默认 1 MiB）**——`git ls-files` 索引中所有**二进制/产物**扩展名
   （图片/字体/归档/媒体/数据库/可执行/wasm/pdf…）的 `git cat-file` 真实字节总和超限 → **FAIL**。
   这是防膨胀的**真正不变量**（只卡单次 diff 挡不住「每次加一点」的慢性膨胀）。
2. **单次提交增量（可选）**——`REPO_SIZE_BASE_REF=<ref>` 时，额外检查 `<ref>..HEAD`
   新增二进制字节量 ≤ `REPO_SIZE_MAX_DELTA`（默认 1 MiB）。CI 在 PR 场景用它精确拦截
   「本次超量入库」。

**正/负例实测（非空转门禁）**：

| 场景 | 命令 | 结果 |
| --- | --- | --- |
| 当前仓库 | `pnpm repo-size` | PASS（757.1 KiB / 1 MiB，exit 0） |
| 上限压到 500K | `REPO_SIZE_MAX_TOTAL=500K node scripts/check-repo-size.mjs` | **FAIL**（exit 1） |
| 加一张 296 KiB 大图（模拟超量入库） | `git add` 后跑 | **FAIL**（1.03 MiB > 1 MiB，exit 1） |
| 加一张**内容相同**的副本（同 blob oid） | `git add` 后跑 | 正确计入两次（848 KiB；验证按 path 累加，非按 oid 折叠） |

> 计数口径：门禁读**索引**（`git ls-files` + `git cat-file --batch-check`），
> 故 `git add` 大文件但未 commit 时即失败（预提交守卫）。

## 五、门禁记录

| 闸 | 结果 |
| --- | --- |
| `pnpm versions` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm build` / `pnpm build:themes` | PASS |
| `pnpm test` | PASS |
| `pnpm size` | PASS |
| **`pnpm repo-size`（新）** | **PASS（757.1 KiB / 1 MiB）** |
| `pnpm dupes` / `contracts` / `theme-budget` / `theme-parity` | PASS |
| 合计 | **11 闸全绿**（verify 串） |

## 六、未覆盖 / 登记

1. **CI artifact 上传**：本仓现**无 CI 配置**（`.github` 不存在）。策略文档已给出
   「生成 → 上传 artifact」的流程与命令，待 CI 仓/流水线补齐后接入（属基础设施卡）。
2. **既有例外**：`host/docs/{design-directions,darkroom-preview}.html`（自包含设计稿，
   ~1.4 MiB，`.html` 不计入二进制预算）与 `shared/**/*.d.ts{.map}`（文本 TS 声明）——
   已在 `docs/evidence-policy.md` 表格登记，非本卡处置范围。
3. **样本保真**：样本为**全分辨率 PNG**（未量化/未缩放）——审计证据须能反映真实渲染
   （对比度/微文本/焦点环），有损压缩可能掩盖回归。故以「减少数量」而非「降质」控体积。
4. **其它审计产物**：`docs/evidence/**/full/` 已通配忽略；未来新增审计卡套用同一
   `<卡>/samples/` + `<卡>/full/` 结构即可。

## 七、变更文件

```
.gitignore                                   # 忽略 docs/evidence/**/full/
package.json                                 # repo-size 脚本 + verify 串入
README.md                                    # 「仓库卫生」小节
scripts/check-repo-size.mjs                  # 新增门禁
docs/evidence-policy.md                      # 新增策略文档
docs/evidence/fe-opt-02/README.md            # 抽样索引（新）
docs/evidence/fe-opt-02/samples/**           # 8 张代表样本（新，自旧目录搬入）
docs/FE-OPT-02.md                            # 旧路径补注（历史文档）
host/e2e/mobile-audit.spec.ts                # 全量集写 full/（gitignore）+ 路径锚定修复
（删除）docs/evidence-fe-opt-02/{desktop-1280,phone-375,tablet-768}/*.png  # 68 张（其余 8 张改名保留）
```
