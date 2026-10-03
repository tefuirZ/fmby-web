# 可直接应用的补丁（W2 产出）

## `fe-login-dedup.patch` —— FE main P1 的**机械组（A+E）**

对 `origin/main`（`b092741`）干净可应用（`git apply --check` EXIT=0 已验）。

```bash
cd <fmby-web 的 checkout>
git apply docs/plans/handoffs/patches/fe-login-dedup.patch
```

**内容**（69 行；只删重复/未用代码，**不加任何新逻辑**）：
- `host/src/pages/login/LoginPage.tsx`：5 处**逐字节相同**的重复块去重
  —— `AuthResponse` import ×2、`MfaVerifyPanel` import ×2、`mfaChallenge` useState ×2、
  `handleAuthResponse` 函数 ×2、JSX `: mfaChallenge ? (…)` 三元分支 ×2。
- `.../MountDrawer/sections/Pan115DirectoryBrowserSection.tsx`：删 1 个未用 import
  （`isPan115CredentialError`，TS6133）。

**效果（实测）**：`tsc -p tsconfig.app.json` **22 错 → 9 错**；`vite build`
**51 模块 → 2477 模块**通过，随后挂到 **B 组**（`MfaVerifyPanel.tsx:14`
`SESSION_USERNAME_STORAGE_KEY` 未导出）——即本补丁**只清第一层**，见
`../FE-MAIN-TSC-BREAKAGE-W2.md` §3/§7。

**风险**：零功能损失（重复块已脚本比对 `block(a,b)==block(c,d)` 全 True）。
**未做**：B/C/D 组（需各自作者意图：`contracts/auth` 缺导出、`useCollectionsList` 全仓无定义）。
