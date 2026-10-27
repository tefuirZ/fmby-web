# FE-S1 · shared-code 手输框联动核查（fmby-web · 只查 + 出方案，未动生产代码）

> 席位 `/data/fmby-seats/rv3-frontend` ｜ 分支 `seat/rv3/fix-sharedcode-ui`（基线 origin/main `99acc73`）
> 后端对照基线：`fmby-v2 origin/main = 8aab56fde0`（2026-10-27 14:35，本卡期间两次 fetch 取最新）
> 纪律：codegraph 找符号；本报告**不改任何生产代码**（`git status --porcelain` 仅含本报告）。

---

## 结论（先停，等你裁）

1. **手输框定位到了，且有两处**（创建 + 编辑弹窗共用一个组件的两个分支）；**编辑入口确实暴露「改码文本」**，弹窗文案还明说「会同时更新…共享注册码…」⇒ S1 落地后两处都是「界面撒谎」，你的判断成立。
2. **但有一个必须先对齐的事实**：我实测后端 main（`8aab56fde0`，今天 14:35）**S1 删臂尚未落地** —— `SharedCode` 显式自定义码**仍被服务端接受**（注册码桥注释自述「SharedCode 显式自定义码仍走本地（站长自带码值，不经生成算法）」）；封堵设计文档（#2234）自标「**未实施，下批次执行**」，且设计文档合入后**零提交**再碰过该文件。
   ⇒ **前端改动必须与后端 S1 同批或之后合入**（时序详见 §4），否则会造成反向撒谎/暂时砍掉一个还能用的功能。**我不动代码，等你裁方案 + 裁时序。**
3. 三方案对比与推荐在 §5：**推荐 A（移除输入框）**；若你要彻底消除时序耦合，选 **C**（保存后对比响应、被忽略时明示真实码）。

---

## 1. 手输框在哪（file:line）

组件：`host/src/pages/manage/registration-codes/components/RegistrationCodeBatchBasics.tsx`（创建区与编辑弹窗**共用**，由 `RegistrationCodeForm.tsx` → `RegistrationCodeEditor.tsx` 装配；调用链终点只有一页 `host/src/pages/manage/ManageRegistrationCodesPage.tsx:19`）。

| # | 面 | 位置 | 内容 |
|---|---|---|---|
| ① | **创建**（共享码模式） | `RegistrationCodeBatchBasics.tsx:129-144` | `singleUseCreateMode ? 生成数量 : 「共享注册码」input`；`value=formState.code`，placeholder **「留空则自动生成」** |
| ② | **编辑弹窗**（共享码模式） | `RegistrationCodeBatchBasics.tsx:164-179` | 同款 input，placeholder **「请输入共享注册码」**；打开弹窗时由 `buildFormStateFromBatch` **预填当前码**（`formUtils.ts:25-27`：`code: primaryRecord?.code ?? ''`；触发点 `hooks/useRegistrationCodesPageState.ts:285 startBatchEditing`） |

装配链（codegraph callers 证据）：`RegistrationCodeEditor.tsx:59/88`（create / edit 两种 mode）→ `RegistrationCodeForm.tsx:65` → `RegistrationCodeBatchBasics.tsx`。

## 2. wire 面：code 现在真的会被发出去

| 面 | 位置 | 行为 |
|---|---|---|
| 创建 `POST /api/manage/registration-codes` | `shared/src/contracts/manage/api.ts:496-535`，`code:` 在 **:509-513** | `mode==="shared-code" && payload.code?.trim() ? payload.code.trim() : undefined` —— 空串**不发**（与「留空则自动生成」placeholder 一致）；非空则原样发 |
| 编辑 `PATCH /api/manage/registration-codes/batches/{id}` | `shared/src/contracts/manage/api.ts:567-…`，`code:` 在 **:577** | `payload.code?.trim() ? payload.code.trim() : undefined` —— **编辑态 code 恒有值（预填当前码）⇒ 管理员哪怕只改 max_uses，也会把码文本原样发回** |
| 类型 | `shared/src/contracts/manage/types.ts:293-304`（Create…Request.code?）、`:316-327`（Update…BatchRequest.code?） | —— |
| 单码 PATCH `/registration-codes/{codeId}` | `types.ts:305-315`（UpdateRegistrationCodeRequest **无 code 字段**） | codegraph：`updateRegistrationCode` **零调用方** ⇒ 不构成入口 |

## 3. 编辑入口核查（你问的第 3 点）：**是，暴露了**

- 入口本体：编辑弹窗里的共享码 input（§1-②，预填当前码、可改、可提交）。
- **文案还明说能改**：`RegistrationCodeEditor.tsx:77-80` ——
  「共享码批次会同时更新批次名称、**共享注册码**和公共授权字段。」
- 后端现状（未落地 S1 时）`PATCH batches/{id}` 对 SharedCode 的 `req.code` 是**接受**的（见 §4-② `registration_codes.rs:881-884`）；只有 `single_use_batch` 分支才拒绝改码文本（`:857-860`「批量单次码批次不支持直接改注册码文本」）。
- ⇒ S1（码文本不可修改）落地后：**编辑弹窗的共享码输入框 + 这句描述文案**同时变成撒谎面；且由于 FE **每次编辑都回发当前码**（§2 PATCH 行），若后端按「`code` 字段出现即拒」实现，**所有**共享码批次编辑（包括只改 max_uses）都会 400 —— 这一条是给后端实现者的接口提示：**要么忽略该字段、要么只在值变化时拒**，前端这边无论选哪个方案都会把 `code` 从 update payload 摘掉。

**不是撒谎面（保持不动）**：码值展示与复制 —— `RegistrationCodeDetailTable/DetailMobileList`、`collectCopyableCodes`（`formUtils.ts:270-289`）。服务端签发什么就展示什么，S1 落地后依旧成立。

## 4. ★核证：后端 S1 现状 ≠ 卡面前提（实测，附 sha）

| # | 我实测的事实 | 证据 |
|---|---|---|
| ① | 最新 main（`8aab56fde0`，10-27 14:35）上，**创建**共享码时显式 `req.code` 仍被接受（trim + 限长后原样采用） | `crates/fmby-v2-bridges/src/bridges/registration_codes.rs:526-529`（「SharedCode 显式自定义码仍走本地（站长自带码值，不经生成算法）」）+ `:307-315`（显式分支）；单测 `:1071-1080` 断言「码值应 trim 后原样保留」 |
| ② | **编辑批次**时 `req.code` 也仍被接受（`None ⇒ 沿用当前码`，即码文本可改） | 同文件 `:881-884` |
| ③ | 服务端 CSPRNG + 整批 Ed25519 签发的发码通道**已存在**（P2-A），当前只在「single-use-batch」与「shared-code 留空」两分支使用；断网 ⇒ `license.capability.offline_denied` 拒绝 | 同文件 `:524-553`（`issue_server_batch`）、`:68-85`（端口注释）、`:1397-1407`（离线判据单测） |
| ④ | 封堵**设计已合入、实施未合入**：设计提交自标「未实施，下批次执行」；其后**零提交**再碰该文件 | `git log -1 ae174f854c`（#2234，10-26 19:56「docs(design): C7 shared-code 旁路取证 + 封堵设计（**未实施**，下批次执行）」）；`git log ae174f854c..origin/main -- <该文件>` 为空；该文件最后一笔 = `6f052e732e`（P2-A #2224） |
| ⑤ | 卡面给的「wire 兼容已保（code 字段保留、响应结构不变）」与现状一致（结构体字段在） | `crates/fmby-v2-http/src/state/registration_codes.rs:39-58`（create DTO 仍声明 `pub code: Option<String>`）、`:171-188`（update-batch DTO 同） |

**⇒ 时序裁定请求**：本卡的 FE 改动**不能先于后端 S1 合入 main**（除非选 C）。理由：
- 先合 A/B：界面宣称「码值由服务端安全生成/不能手输」，但后端此刻**仍接受**手输 ⇒ 功能暂时缺失（A）/ 文案撒谎（B）。
- 先合 C：无此问题（后端没忽略就不会触发提示），可随时合。
- 后端先合、前端不动：管理员手输被忽略且界面报成功 = 你定义的「界面撒谎」。
**建议节奏**：后端 S1 合入 ⇒ 同一发布窗口内 FE 落 A（或 B）。

## 5. 三方案对比与推荐

| | **A：移除输入框** | **B：禁用 + 提示** | **C：保留 + 被忽略时明示** |
|---|---|---|---|
| 创建面 | 删 `RegistrationCodeBatchBasics.tsx:129-144` 的共享码分支，该 fieldRow 只剩「批次名称」单列；可加一行只读说明「码值由服务端安全生成（CSPRNG + 签名）」 | `:129-144` input 加 `disabled` + `fieldHint`「码值由服务端安全生成」 | 不动 UI |
| 编辑面 | 删 `:164-179`；`RegistrationCodeEditor.tsx:77-80` 描述改「共享码批次会更新批次名称与公共授权字段（码文本不可修改）」 | 同上加 disabled（预填当前码仍显示）；描述同步改 | 不动 UI，弹窗描述也不必改 |
| payload | `buildCreatePayload`（`formUtils.ts:151`）删 code 行；`buildUpdateBatchPayload`（`:181`）删 code 行；`types.ts` 两个接口删 `code?` 字段 | **同样必须删 update 的 code 发送**（否则后端若「见 code 即拒」，所有编辑全炸）；create 侧可留 | 不动 payload |
| 新增逻辑 | 无 | 无 | **两个 mutation 的 onSuccess 都要**「请求码 vs 响应码」对比 + 提示文案（响应里有真码：`items[0].code`） |
| 诚实度 | ★★★（没有假入口） | ★★（禁用框说明原因，但「禁用却显示当前码」易被误读为可改） | ★★★（事后明示，连被签发成什么都告诉管理员） |
| 时序鲁棒性 | ✗ 必须随/随后端 | ✗ 必须随/随后端（且先合=文案撒谎） | ✓ 后端没落地也不会误报 |
| 实现量 | 小（~2 个文件 4 处 + 类型 2 行） | 小（同 A 还多改一处 disabled） | 中偏大（对比逻辑 + 双文案 + 测试） |
| 留退路 | 恢复手输要加回 UI | 恢复手输 = 去掉 disabled，一步 | 天然兼容任何后端语义 |
| 测试影响 | 无单测断言该输入（全仓仅 `ui-density-p1-header.test.ts:106-107` 提「共享码入口」，是页头文案，不受影响）；e2e 无引用 | 同左 | 需补 2 条单测（对比逻辑） |
| 风险 | 布局单列（视觉小改）；后端未落地时先合 = 暂时砍掉「站长自带码值」这一仍可用的能力 | 输入框永久禁用 = UI 噪音；「为什么留着不能用的框」会被问 | 把「猜后端语义」固化进前端；后端真删字段后对比逻辑成死代码 |

**推荐：A（移除）**。理由：S1 是「删臂」，前端同构地删是最懒且最诚实的解；实现量与 B 相当但没有永久禁用框的噪音；测试面干净（零单测/e2e 断言该输入）。
**退而求其次**：若你希望 FE 改动**不等后端**、先合先行 ⇒ 选 **C**（唯一时序安全项），后端落地后它自动开始生效。
**不建议**：B 单独先行（先合 = 文案撒谎）；以及任何「保留可输入 + 前端假装成功」的形态。

### 若裁 A 的机械改动清单（供执行，本卡未实施）
1. `RegistrationCodeBatchBasics.tsx`：删 :129-144、:164-179 两个共享码分支（创建面可留一行只读说明）。
2. `RegistrationCodeEditor.tsx:77-80`：弹窗描述去掉「共享注册码」，改为「码文本由服务端签发、不可修改」。
3. `formUtils.ts`：`buildCreatePayload`(:151)、`buildUpdateBatchPayload`(:181) 删 code；`buildFormStateFromBatch`(:25-27) 删 code 预填。
4. `types.ts`：`CreateRegistrationCodeRequest.code?`(:299)、`UpdateRegistrationCodeBatchRequest.code?`(:318) 删除。
5. `shared/src/contracts/manage/api.ts`：:509-513 与 :577 删 code 分支（wire 字段由后端保留，前端不发 = 兼容）。
6. `constants.ts:36` 描述文案可加半句「码值由服务端安全生成」。
7. 验证：`pnpm typecheck` + 现有单测（无断言该输入，预期全绿）；**建议补 1 条**「update payload 不含 code 键」的断言防回归。

---

## 6. 复现命令（供对抗复核）

```bash
# 前端定位（codegraph）
cd /data/fmby-seats/rv3-frontend
codegraph query "createRegistrationCode" -p .      # 契约入口 shared/src/contracts/manage/api.ts:496
codegraph callers "buildUpdateBatchPayload" -p .   # 仅 ManageRegistrationCodesPage.tsx:19
codegraph callers "buildFormStateFromBatch" -p .   # useRegistrationCodesPageState.ts:285 startBatchEditing（编辑预填）
# 两处手输框：RegistrationCodeBatchBasics.tsx:129-144（创建）/ 164-179（编辑）
# 弹窗文案：RegistrationCodeEditor.tsx:77-80；wire：manage/api.ts:509-513（create code）/ :577（update code）

# 后端语义（fmby-v2 main，本卡期间两次 fetch，最新 8aab56fde0）
cd /data/fmby-seats/c6-cdnprobe && git fetch origin main && git rev-parse origin/main
git log --oneline origin/main -- crates/fmby-v2-bridges/src/bridges/registration_codes.rs | head -3
#   → 最后一笔 6f052e732e（P2-A #2224）；设计文档 ae174f854c（#2234）之后零提交
# 显式码仍被接受：registration_codes.rs:526-529（「仍走本地」注释）/ :307-315 / 单测 :1071-1080
# 码文本可改：registration_codes.rs:881-884（None ⇒ 沿用当前码）
# 服务端签发通道在但仅两分支用：:524-553 + :68-85
```

## 7. 未查 / 边界声明

- **未动任何生产代码**（本卡默认只查+出方案；`git status` 仅本报告）。
- 未跑 `pnpm tsc`（无代码改动，无意义；执行方案时再跑，本机轻量可跑）。
- 后端侧只核了与 FE 交互的两条 wire（create / PATCH batches/{id}）与发码桥语义；S1 在后端仓的实施计划（哪张卡、哪个批次）属于后端席/主代理，我只引用了 #2234 的「未实施」自述与文件提交史。
- 未核 V1 考古源（本卡不需要：V1 无此语义变更）。

---
<!-- agent: rv3-frontend | family: glm | model: magpie/auto/glm-5.3-flash -->
`rv3-frontend` · glm · magpie/auto/glm-5.3-flash
