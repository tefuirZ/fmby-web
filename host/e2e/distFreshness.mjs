/**
 * E2E 产物新鲜度判定（供 `host/e2e/start.mjs` 启动器使用）。
 *
 * 为什么需要：启动器原先只在 `host/dist/index.html` **缺失**时才 `vite build`；
 * 若 dist **存在但比源码旧**（改完源码没重建），启动器会**静默**服务旧产物 ⇒
 * e2e 验证的是过期前端，表现为「明明改了却没用 / 页面进错误态」。这在 e2e 里极难
 * 归因（本仓已实际踩到：见 fbmy-web 的 stale-dist 记录）。
 *
 * 判据与 `scripts/check-e2e.mjs` 的「产物新鲜度」**同源**（那边的 `newestSourceMtime`
 * 为内联实现、未导出）：扫描 `host/src` + `shared/src` 下
 * `.ts/.tsx/.css/.mjs/.js`，取最新 mtime，与 `dist/index.html` 的 mtime 比较。
 * 本模块为该判据的**单一真源候选**；门禁侧收敛到本模块属另卡（本文件不越界去改
 * `scripts/`）。
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** 参与新鲜度比较的源码扩展名。 */
const SOURCE_EXT = /\.(ts|tsx|css|mjs|js)$/;

/**
 * 最新源码 mtime（ms）；目录不可读/为空时返回 0（调用方按「无源码」处理）。
 *
 * @param {string} hostDir   `host/` 绝对路径
 * @param {string} repoRoot  前端仓根绝对路径
 */
export function newestSourceMtime(hostDir, repoRoot) {
  let newest = 0;
  for (const root of [join(hostDir, 'src'), join(repoRoot, 'shared', 'src')]) {
    if (!existsSync(root)) continue;
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!SOURCE_EXT.test(entry.name)) continue;
        try {
          const m = statSync(full).mtimeMs;
          if (m > newest) newest = m;
        } catch {
          // 忽略不可读文件
        }
      }
    };
    walk(root);
  }
  return newest;
}

/**
 * `dist/index.html` 是否缺失或陈旧。
 *
 * @param {string} distIndex `host/dist/index.html` 绝对路径
 * @param {string} hostDir   `host/` 绝对路径
 * @param {string} repoRoot  前端仓根绝对路径
 * @returns {{missing: boolean, stale: boolean, distMtimeMs: number, srcMtimeMs: number}}
 */
export function distFreshness(distIndex, hostDir, repoRoot) {
  if (!existsSync(distIndex)) {
    return { missing: true, stale: false, distMtimeMs: 0, srcMtimeMs: 0 };
  }
  const distMtimeMs = statSync(distIndex).mtimeMs;
  const srcMtimeMs = newestSourceMtime(hostDir, repoRoot);
  return { missing: false, stale: srcMtimeMs > distMtimeMs, distMtimeMs, srcMtimeMs };
}
