/**
 * E2E 二进制解析 —— **唯一真源**（rv01 PR #15 阻断项 ①）。
 *
 * 背景：此前「同源」= 四处各写一遍同一份**窄**口径：
 *   · scripts/check-e2e.mjs
 *   · host/e2e/fixtures/helpers.ts
 *   · host/e2e/start.mjs
 *   · host/playwright.config.ts
 * 四处都只找 `<repo>/target/{release,debug}` 与 `/home/tefuir/rustproject/FMBY-V2/target/{...}`。
 * 而本项目工具链**强制** `CARGO_TARGET_DIR=/data/fmby-build/local-target`
 * （AGENTS.md §5 硬约束①）⇒ 那两个路径下**没有二进制**，于是：
 *   · `E2E_ENABLED=false` ⇒ 18 个 spec 全部 skip；
 *   · 新门禁走 SKIP 分支 ⇒ `pnpm verify` 打印清单后 exit 0；
 * ⇒ 「修好了 + 有回归用例 + 门禁接进 verify」三者都成立，但**一条都不跑**。
 *
 * 修法：候选目录补上
 *   0. 环境变量 `FMBY_E2E_SERVER_BIN` / `FMBY_E2E_SEED_BIN`（显式覆盖，永远最优先）
 *   1. `CARGO_TARGET_DIR`（cargo 官方口径，本项目由工具链设置）
 *   2. `FMBY_CARGO_TARGET_DIR`（本仓约定别名，CI 可设）
 *   3. `/data/fmby-build/local-target`（本机实际构建目录）
 *   4. `/data/fmby-target/*`（按分支隔离的 target 目录，逐个 profile 探测）
 *   5. `<前端仓>/target`（历史形态）
 *   6. `<主仓>/target`（WEB-E2E-FULL 回退）
 *
 * 消费方必须**只**用本模块，不得再自己拼路径（改一处漏三处就是本次事故的成因）。
 */

import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 本文件位置 → host/e2e → host → 前端仓根 */
const HERE = typeof __dirname === 'string' ? __dirname : fileURLToPath(new URL('.', import.meta.url));
export const WEB_REPO_ROOT = resolve(HERE, '..', '..');

export const MAIN_REPO_ROOT =
  process.env.FMBY_E2E_MAIN_REPO ?? '/home/tefuir/rustproject/FMBY-V2';

/** 平台可执行后缀。 */
export const EXE_SUFFIX = process.platform === 'win32' ? '.exe' : '';

/**
 * 按 profile 探测二进制的**优先级**：e2e 优先 **debug**（见下）。
 *
 * ★为什么 e2e 优先 debug（而非 release）：F-09 守卫
 *   （`fmby-v2-bridges/src/database.rs` 的 `default_admin_seed_allowed`）规定——
 *   发布构建（制品）**默认拒绝**内置默认口令种子（`admin`），需显式
 *   `FMBY_ALLOW_DEFAULT_ADMIN_SEED=1` 才允许；而该守卫文档**自己写明**：
 *   「调试构建（cargo test / 开发）→ 允许（**测试夹具与 e2e/perf seed 工具
 *     依赖**）；发布构建 → 默认拒绝」。
 *   ⇒ **e2e 的既定形态就是 debug 构建**；若优先取 release 制品，
 *   `fmby-e2e-seed` 会在 seed 阶段被 F-09 拒（实测：`E2E admin seed failed:
 *   拒绝在发布构建中执行内置默认口令种子（F-09 防御）`）⇒ server 起不来
 *   ⇒ 全量 e2e 假红。
 *   ⇒ 本表把 debug 提前；**release 仍作回退**（仅当无 debug 产物时才用，
 *     此时需自行 opt-in 种子，见上）。
 *   ★等价地也可不改这里、改在 start.mjs 设 `FMBY_ALLOW_DEFAULT_ADMIN_SEED=1`，
 *     但那会经 `spawn(serverBin, {env: process.env})` 把该安全 opt-in 灌进
 *     **server 进程**的 env（超出 seed 工具范围）⇒ 选本方案更小、且零安全面。
 */
export const PROFILES = ['debug', 'release'];

/** 构建产物根目录候选（按优先级）。 */
export function targetDirCandidates() {
  const roots = [];
  const envRoots = [
    process.env.FMBY_E2E_TARGET_DIR,
    process.env.CARGO_TARGET_DIR,
    process.env.FMBY_CARGO_TARGET_DIR,
    '/data/fmby-build/local-target',
  ].filter((v) => typeof v === 'string' && v.length > 0);
  roots.push(...envRoots);
  // /data/fmby-target/<分支名>/ —— 按分支隔离的 target 目录。**默认不扫**：
  // 该目录下有数十个分支目录，逐个探 profile 会让诊断输出长达数千字符
  // （实测 28 个目录），噪音盖过有效信息。需要时显式开启
  // `FMBY_E2E_SCAN_BRANCH_TARGETS=1`。
  if (process.env.FMBY_E2E_SCAN_BRANCH_TARGETS === '1') {
    try {
      if (existsSync('/data/fmby-target')) {
        for (const entry of readdirSync('/data/fmby-target', { withFileTypes: true })) {
          if (entry.isDirectory()) roots.push(join('/data/fmby-target', entry.name));
        }
      }
    } catch {
      // 目录不可读：忽略（解析是 best-effort，缺失由调用方决定 SKIP 还是 FAIL）
    }
  }
  // 历史形态：仓库内 target/
  roots.push(join(WEB_REPO_ROOT, 'target'), join(MAIN_REPO_ROOT, 'target'));
  return roots;
}

/**
 * 解析一个二进制的绝对路径。
 * @param envKey 显式覆盖的环境变量名（如 `FMBY_E2E_SERVER_BIN`）
 * @param baseName 文件名基名（如 `fmby-v2-server`）
 * @returns 绝对路径；找不到返回 null
 */
export function resolveBinary(envKey, baseName) {
  const candidates = [];
  const overridden = process.env[envKey];
  if (typeof overridden === 'string' && overridden.length > 0) {
    candidates.push(overridden);
    // 也允许指向目录（此时按 profile 拼）
    for (const profile of PROFILES) {
      candidates.push(join(overridden, profile, `${baseName}${EXE_SUFFIX}`));
      candidates.push(join(overridden, profile, baseName));
    }
  }
  for (const root of targetDirCandidates()) {
    for (const profile of PROFILES) {
      candidates.push(join(root, profile, `${baseName}${EXE_SUFFIX}`));
      candidates.push(join(root, profile, baseName));
    }
  }
  for (const candidate of candidates) {
    try {
      if (existsSync(candidate)) return candidate;
    } catch {
      // 路径非法（如含 NUL / 超长）：跳过
    }
  }
  return null;
}

/** 服务端二进制（缺失 ⇒ 全部 spec 无法真跑）。 */
export function resolveServerBinary() {
  return resolveBinary('FMBY_E2E_SERVER_BIN', 'fmby-v2-server');
}

/** seed 二进制（start.mjs 先 seed 后起 server，必须与 server 成对）。 */
export function resolveSeedBinary() {
  return resolveBinary('FMBY_E2E_SEED_BIN', 'fmby-e2e-seed');
}

/** 供日志/诊断：实际搜了哪些根目录。 */
export function describeSearchPaths() {
  return targetDirCandidates().join(' / ');
}
