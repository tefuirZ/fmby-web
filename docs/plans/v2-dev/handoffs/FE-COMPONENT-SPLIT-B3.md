# FE-COMPONENT-SPLIT-B3 交接（w1 · 前端仓 w/zcode/writer1-fe-split-b3）

> B3：拆基线剩余 3 个（RuntimeLogs / RegistrationCodes / RegistrationCodeForm）
> + 并入 WEB-S4C 的两条裁决（`..` 统一报错、S3 前缀回填）。

- 基线：`origin/main` @ `f5d27aa`
- 提交：2 个
  - `ba24a9c` 裁决 1 + 裁决 2（独立 commit，按裁决 1 要求）
  - `e49de54` B3 三文件拆分
- 门禁：`pnpm verify` **12 闸全绿**（34 PASS）
- **基线 12 → 9**（3 条达标回收）

---

## 1. 裁决 1：`normalizeRemoteMountPath` 统一为报错

**改动**：AList/OpenList/RcloneRc 的 root_path 含 `..` 段，此前**静默剔除**
（`/a/../../b` → `/a/b`），现改为**返回空值 + 字段级报错**「根路径禁止包含「..」段」。
静默改写属 RB-4（禁假成功）——用户以为路径生效、实际被改写。

**存量兼容评估（裁决要求，已核）**：
- 后端 `validate_root_path`（`application/src/manage.rs:212` create / `:362` PATCH）
  对 AList/OpenList/RcloneRc/WebDAV/S3 **一律拒 `..`**（"root_path must not contain '..' segments"）；
- 故**存量挂载的 root_path 不可能含 `..`**（创建/更新都过这道校验）；
- **结论：改报错无存量风险**，不需要「读时容忍」兼容期。
- 读路径（切换 provider 时回填）仍保留 `|| '/'` 兜底，属防御性容忍，不在写入侧放行。

## 2. 裁决 2：编辑态回填 S3 前缀

**真源判断（已核）**：后端把 **S3 的 `root_path` 当 key 前缀归一**
（`validate_root_path` → `normalize_s3_prefix`，handoff §3.2）。
故以 `detail.rootPath` 回填表单 `prefix` 字段，避免「显示空前缀、实际有前缀」，
改一次就覆盖的 bug 面。**WebDAV 不回填**（其 root_path 是 URL 路径语义，非独立前缀字段）。

---

## 3. B3 拆分结果

| 文件 | 拆前 → 拆后 | 抽出 |
|---|---|---|
| `ManageRuntimeLogsPage.tsx` | 600 → **393** | `runtime-logs/`：`components.tsx`(116) · `shared.ts`(34) · `RuntimeLogDetailDialog.tsx`(85) |
| `ManageRegistrationCodesPage.tsx` | 610 → **260** | `registration-codes/components/`：`RegistrationCodeHeader` · `RegistrationCodeEditor` · `RegistrationCodeBatchSection` · `RegistrationCodeActionDialogs`；`hooks/useRegistrationCodesPageState.ts`(347) |
| `RegistrationCodeForm.tsx` | 535 → **378** | `RegistrationCodeBatchBasics.tsx`（创建/编辑基础字段区） |

**`useRegistrationCodesPageState` 说明**：该页状态/派生/处理器 ~280 行，整段抽为
hook（与 `naming-rules/useNamingRulesPageState` **同型**，非新发明模式）；
页面只保留 early-return + JSX。JSX 消费的字段通过 hook 返回对象解构。

---

## 4. 本卡踩坑（补充拆法模板）

1. **自己造的窄类型是最大返工源**——本卡在 RegistrationCodes 的拆分中，
   先后自造了 `RegistrationCodePendingAction` / `RegistrationCodeConfirmation` /
   `{ label: string; impact?: string[] }` 等，全部与真实类型冲突
   （`PendingCodeAction` 的 record 是**单码**、`DangerousActionRequest` 才是确认类型、
   `getCodeStatusAction().impact` 是 **string** 非 string[]）。
   **一律改回从既有模块 import 真实类型后即通过。**（B2 已记此教训，本卡又犯两次。）
2. **JSX 块按行号切片比字符串匹配可靠**：`/tmp` 提取时用 `index('</Dialog>')`
   在含多分支的页面上切错（把 `) : isPending ? (` 分支带走）。
   **行号切片 + 立即 `wc -l`/typecheck 校验**是稳的。
3. **`onConfirm={(confirmation) => {…}}` 多行块**：体内有 `});` 时按「找下一个 `}}`」
   会提前收尾→语法残骸（TS1381/1382）。**按行号区间替换**（本卡 RegistrationCodeActionDialogs
   因此重建过一次）。
4. **抽 hook 时注意 early-return**：页面的 `if (isPending) return <X/>` 属组件，
   不能进 hook；抽状态块时要把这段留在页面。
5. **state hook 返回对象去重**：手工拼 return 对象时同名键会重复（TS1117），
   本卡脚本加了一轮去重。

---

## 5. 剩余 9 条基线 + 下一批建议

| 行 | 文件 |
|---:|---|
| 587 | `login/LoginPage` |
| 533 | `manage/naming-rules/scrape-sections` |
| 496 | `manage/ManageOverviewPage` |
| 484 | `manage/ManageMediaItemsPage` |
| 463 | `manage/media-item-detail/components/MediaItemSubtitleSection` |
| 448 | `manage/ManageNamingRulesPage` |
| 448 | `manage/media-item-detail/components/MediaItemMetadataSection` |
| 417 | `manage/ManageRewardsPage` |
| 403 | `manage/ManageLicensePage` |

**建议 B4**：`ManageOverviewPage`(496) → `ManageMediaItemsPage`(484) →
`MediaItemSubtitleSection`(463) → `ManageNamingRulesPage`(448) → `MediaItemMetadataSection`(448)
（管理面高频，拆法可复用）。
**`LoginPage`(587) 继续后置**：会话/CSRF/多因素风险面大，非管理高频路径，收益/风险比低。
**`scrape-sections`(533) 是 `.tsx` 工具+组件混合**，拆前先看是否含 JSX（含则按组件计）。

---

## 6. 待办 / 需裁决

1. **`MOUNT-CRED-SEAL` 合并后需回头收尾**（WEB-S4C 裁决 2/3）：AK/SK 编辑态展示
   （「已设置凭据，留空不修改」占位）需等后端 PATCH 敏感键语义确定。
2. **`..` 口径现已两端一致**（前端报错 + 后端 400），无遗留。
3. **`useRegistrationCodesPageState` 返回对象较大（40+ 字段）**：这是「页面只渲染」的代价。
   若你更希望页面保留部分派生，可回调；当前与 naming-rules 模式一致，**建议保留**。
