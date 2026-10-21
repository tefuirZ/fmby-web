# ② 页面预算真跑（6 档机器）· runbook + 农场清单

- 席 ht2 · 2026-10-20 · 状态：**待农场执行**（farm3 间歇不可达；node62 已按 10-20 指示**永久摘除**）
- 口径来源：`host/e2e/perf-19pages.spec.ts`（19 页 × 传输/解析/渲染三层）+ `docs/perf-budget.md` §2（核心 7 页既有预算）
- 与 ① 的关系：①（入口↔能力键映射）已于 `docs/前端授权入口映射.md` 交付并**复跑 [GREEN]**
  （`node scripts/check-license-ui-coverage.mjs` ⇒ `surface 15/15`、`映射表与代码引用一致`）。

## 一、6 档定义（**取既有 8 档中的 ≤4c 六档**，超出档一律标未测）
既有档位口径来自本仓 perf 矩阵（`FINAL-PERF-MATRIX`）：`1c1g / 1c2g / 2c2g / 2c4g / 4c4g / 4c8g / 8c8g / 8c12g`。
farm3 实机 **8c / 15G**（`--nodes` 注册表）⇒ 内存余量 ~13G，**8c12g 与 8c8g 会与后端实例争内存**：

| 档 | CPU 配额 | 内存上限 | 本 runbook |
|---|---|---|---|
| 1c1g | 100% | 1G | ✅ 跑 |
| 1c2g | 100% | 2G | ✅ 跑 |
| 2c2g | 200% | 2G | ✅ 跑 |
| 2c4g | 200% | 4G | ✅ 跑 |
| 4c4g | 400% | 4G | ✅ 跑 |
| 4c8g | 400% | 8G | ✅ 跑 |
| 8c8g / 8c12g | — | — | ❌ **未测**（farm3 内存不足；需 16G+ 节点） |

> 判据（写死）：**每档每页取 3 次 ⇒ p50**，并**单列冷启动 1 次**；核心 7 页按 `docs/perf-budget.md` 既有预算硬闸，
> 其余 12 页为**推定档**（`firstBudget:null` ⇒ 只测不自判）。`FMBY_PERF_STRICT=1` 才开硬闸（共享机噪声 2–3×）。

## 二、农场要跑什么（命令级，一次一档）
```bash
# 前置（farm3，root=/media/vdb/fmby-farm；node62 的 /mnt/build/fmby 已退役）
mkdir -p /media/vdb/fmby-farm/FE2-页面预算 && cd /media/vdb/fmby-farm/FE2-页面预算
# ① 1M 只读副本（perf1m 快照升过 v144 的那份；若 farm3 无此库 ⇒ 需先投一次造数作业）
ls -la fmby-1m.db || echo "缺 1M 夹具：需主代理派『造/拷 1M 库』作业"
# ② 后端（main 二进制）——每档一个 cgroup，跑完按 PID 清理
TIER=1c1g; C=100; G=1G
systemd-run --user --scope -p CPUQuota=${C}% -p MemoryMax=${G} \
  env FMBY_BIND=127.0.0.1:18820 FMBY_DATA_DIR=$PWD/data \
  ./fmby-v2-server > server-1c1g.log 2>&1 &
# ③ 前端（构建产物 + Playwright；19 页 × 三层）
pnpm --dir web build && pnpm --dir web exec playwright test perf-19pages.spec.ts \
  --reporter=json > pw-1c1g.json 2>&1
# ④ 收数：transport / parse / render 三层 + 首屏(first)/可交互(TTI 近似)
# ⑤ kill 实例（按 PID）+ 复核端口 18820 释放，再进下一档
```

## 三、产物与落盘（**卡面路径已变更**）
- 卡面写 `/mnt/build/fmby/<席名>/` ⇒ 那是 **node62**，已按 10-20 指示**永久摘除**；
- 现建议落 **farm3**：`/media/vdb/fmby-farm/FE2-页面预算/{server-*.log,pw-*.json,budget-6tier.tsv}`；
  **请主代理确认新落盘路径**（我不擅自改卡面口径）。

## 四、预算表模板（跑完逐格填；**填不出的格子一律写「未测」**）
| 页 | 层 | 1c1g | 1c2g | 2c2g | 2c4g | 4c4g | 4c8g | 预算 | 判定 |
|---|---|---|---|---|---|---|---|---|---|
| `/` 首页 | 传输/解析/渲染 | 未测 | 未测 | 未测 | 未测 | 未测 | 未测 | 600ms·1000ms·800KB | 待填 |
| `/libraries` | 三层 | 未测×6 | | | | | | 500·800·600KB | 待填 |
| `/libraries/1` | 三层 | 未测×6 | | | | | | 600·900·700KB | 待填 |
| `/item/101` | 三层 | 未测×6 | | | | | | 700·1000·800KB | 待填 |
| `/manage` | 三层 | 未测×6 | | | | | | 500·800·600KB | 待填 |
| `/manage/task-center` | 三层 | 未测×6 | | | | | | 400·700·600KB | 待填 |
| `/manage/users` | 三层 | 未测×6 | | | | | | 600·900·700KB | 待填 |
| 其余 12 页 | 三层 | 未测×6 | | | | | | **推定档**（只测不闸） | — |

## 五、当前农场实况（原文，2026-10-20）
```text
$ bash scripts/farm.sh --probe
nas    189G 11G 在跑0 load1 3.39 上限2.0 并发1  🛡 负载 3.39 > 上限 2.0（保护节点上的其他服务）⇒ 跳过
farm3  UNREACHABLE 0 0 0 24 2                    ⚠ 不可达（按 INFRA 处理，不是代码红）
$ ssh -p 9988 root@81.71.156.99 …                ⇒ Connection timed out during banner exchange
```
⇒ **本 runbook 未执行**，表中全部格子保持「未测」；不以任何推算数字代替。
