# 前端版本策略（fmby-web）

> 2026-09-15 用户裁定。核心：**四层独立版本 + 高版本必须兼容低版本**。

---

## 1. 四层版本结构

| 层 | 版本文件 | 当前 | 独立性 |
|---|---|---|---|
| **契约** | `shared/src/contracts/index.ts` 的 `CONTRACT_VERSION` | `0.1.0` | 跨仓对齐（后端 `fmby-v2-contracts::CONTRACT_VERSION` 必须相等） |
| **shared**（共享层） | `shared/package.json` | `0.1.0` | 独立（被 host + 所有主题依赖） |
| **host**（宿主） | `host/package.json` | `0.1.0` | 独立（可单独迭代 UI） |
| **各主题** | `themes/<id>/package.json` + `theme.manifest.json` | `0.1.0` | **各自独立**（darkroom 与 template 无关，第三方主题自有节奏） |

**与后端的版本关系**：`fmby-web` 与 `fmby-v2`（Rust 后端）**完全独立发版**，版本号**不要求相等**。
唯一硬约束是 `CONTRACT_VERSION` 两端必须对齐。

---

## 2. ★向下兼容铁律（不可协商）

> 用户明确要求：「后续升级版本都需要做好向下兼容，高版本要兼容低版本。」

含义：**新版本的前端必须能跑在旧版本的后端上，反之亦然**（在契约版本兼容范围内）。

具体规则：

### 2.1 契约版本（CONTRACT_VERSION）
- **MINOR**（如 0.1.0 → 0.2.0）：**向后兼容**的新增（新端点/新 DTO 字段/新主题能力）。
  旧前端 + 新后端 ✅；新前端 + 旧后端 ✅（新前端须对缺失能力降级）。
- **MAJOR**（0.x → 1.0.0）：**破坏性**变更（字段删改/语义变化/主题协议不兼容）。
  需显式升级矩阵 + 迁移说明。
- **PATCH**：仅实现修复，不动契约。

### 2.2 shared（共享层）
- 新增能力 → MINOR（`^0.1.0` 依赖范围自动兼容）
- 删除/改签名 → MAJOR（下游必须显式升级）
- **shared 只能增不能删**（在 MAJOR 内）——它是 host + 所有主题的共同基础

### 2.3 host / 主题
- 各自 semver；**主题声明它兼容的 shared 契约版本范围**：
  ```jsonc
  // theme.manifest.json
  { "contract_version": "0.1", "min_host_version": "0.1.0" }
  ```
- host 加载主题时校验：契约不匹配 → **拒绝加载并提示**（不静默降级到错误渲染）

### 2.4 运行时降级（新前端 + 旧后端）
前端调 API 时若遇 `404`（端点不存在）或 `501`（未实现）→ **功能隐藏/降级**，不崩溃。
实现方式：能力探测（`GET /api/site/themes` 失败 → 隐藏主题切换入口）。

---

## 3. 依赖声明策略

```jsonc
// host/package.json
{ "dependencies": {
    "@fmby/v2-shared": "^0.1.0"   // semver 范围：shared 兼容升级时 host 无需跟版
} }

// themes/<id>/package.json
{ "dependencies": {
    "@fmby/v2-shared": "^0.1.0"   // 主题同理；shared MINOR 升级不强制主题升版
} }
```

**publish 协议**：`shared` MINOR 升级（如 0.1.0 → 0.2.0）时，host/themes 的 `^0.1.0` **不覆盖** → 需显式升版。
因此：**shared 的破坏面要尽量小**；确实需要下游跟随的变更才推 MINOR。

---

## 4. 发布兼容矩阵

发布仓 `fmby-release` 的 `themes.json` 记录：

```jsonc
{
  "contract_version": "0.1.0",
  "compat": {
    "backend": ">=0.1.107",     // 最低后端版本
    "host": ">=0.1.0",          // 最低 host 版本
    "shared": ">=0.1.0"
  },
  "themes": [ { "id": "darkroom", "version": "0.1.0", "contract_version": "0.1.0" } ]
}
```

部署方据此校验「后端 + host + 主题」三者兼容性。

---

## 5. 校验门禁

| 门禁 | 检查 |
|---|---|
| `check-versions`（前端仓） | 四层版本文件自洽 + CONTRACT_VERSION 与后端对齐（若主仓 checkout 存在） |
| `check-theme-parity` | 主题声明 `contract_version` 必须与 shared 契约兼容 |
| 运行时（host） | 加载主题时校验 `contract_version` 匹配，不匹配拒绝 |
