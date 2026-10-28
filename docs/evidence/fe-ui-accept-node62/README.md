# FE-UI-ACCEPT-NODE62 审计截图索引（抽样）

> **REPO-HYGIENE-01 策略**：代表样本入库 + 本索引；全量集不入库（CI artifact /
> 外部归档）。验收原文与 node62 起栈命令（可复现）见
> [`../FE-UI-ACCEPT-NODE62.md`](../FE-UI-ACCEPT-NODE62.md)。

## 入库样本（4 张，desktop-1280）

| 页面/对象 | 类别 | 文件 | 实测大小 |
| --- | --- | --- | --- |
| 管理驾驶舱 | manage | `samples/desktop/manage-cockpit.png` | 142.5 KiB |
| 登录 TOTP 二维码（尺寸下限档） | settings | `samples/desktop/totp-qr-desktop.png` | 25.1 KiB |
| 详情页皮肤（无 CTA） | playback | `samples/desktop/item-skin-no-cta.png` | 19.4 KiB |
| 详情页皮肤（播放 CTA） | playback | `samples/desktop/item-skin-play-cta.png` | 18.8 KiB |
| | | **合计** | **205.8 KiB** |

## 外置（REPO-HYGIENE-01 预算回收，2026-10-28）

- `samples/desktop/naming-header.png`（原 210.1 KiB，命名规则页头部）——仓库二进制
  总量超 1 MiB 预算（web-verify 三连红），按策略外置。文件仍在 git 历史
  （本提交之前的任一 commit：`git show <commit>:docs/evidence/fe-ui-accept-node62/samples/desktop/naming-header.png`
  可取回）。
- 重新生成：按 [`../FE-UI-ACCEPT-NODE62.md`](../FE-UI-ACCEPT-NODE62.md) §1 在 node62
  起栈后重跑验收截图。
