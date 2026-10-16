#!/usr/bin/env node

/**
 * scripts/check-theme-dist.mjs
 *
 * 主题**发行产物**门禁（THEME-RELEASE-SHIP）：断言 `themes/<id>/dist/` 真被产出、且与
 * 源 `theme.manifest.json` 自洽。
 *
 * 为什么需要：
 *   `themes/<id>/dist/` 是 `.gitignore` 的**构建产物**（不随仓分发），而部署时后端把
 *   `/themes/<id>/<rest>` 映到 `${data_dir}/themes/<id>/dist/<rest>`。只要发行物里**没有**
 *   这份 dist，新装实例每一页都会 404 `GET /themes/darkroom/theme.manifest.json`。
 *   历史缺口：发布流程（主仓 `scripts/release/build-artifacts.mjs`）只跑前端仓的
 *   `pnpm --filter @fmby/v2-host build` 并取 `host/dist` ——**主题从未被构建**。
 *   本 PR 把 `build:themes` 并进 host 的 `build`（见 host/package.json），本门禁则锁
 *   「产物确实存在且自洽」，防止将来又被拆掉。
 *
 * 断言（每个 themes/<dir>）：
 *   ① 源 `theme.manifest.json` 存在且 JSON 合法；
 *   ② `dist/theme.manifest.json` 存在且 JSON 合法；
 *   ③ 两者 `id` / `version` 一致（构建只是拷贝源 manifest，不一致=漂移）；
 *   ④ 构建入口 `dist/index.js` 存在（主题 vite 配置的 `fileName`）；
 *   ⑤ manifest 声明的 `tokens.cssFile` + `extraCssFiles` 在 dist 内**都存在**；
 *   ⑥ **携带布局**（REWORK-FE57）：`host/dist/themes/<id>/dist/**` 也必须在场 —— 发行物
 *      （`release.yml` 的 `zip host/dist` / `Dockerfile` 的 `COPY host/dist /app/web`）只带
 *      `host/dist`，主题不搬进去就**带不走**；而播种器要的 `$FMBY_DEFAULT_THEME_DIR/<id>/dist/**`
 *      正是该布局。`host/dist` 不存在时（只跑了 `pnpm build:themes`）跳过 ⑥ 并注明。
 *
 * 用法：
 *   node scripts/check-theme-dist.mjs            # 只断言现有 dist
 *   node scripts/check-theme-dist.mjs --build    # 先 `pnpm build:themes` 再断言（干净检出场景）
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const THEMES_DIR = path.join(REPO_ROOT, 'themes');
const DO_BUILD = process.argv.includes('--build');
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git']);

/** 主题构建入口的产物名（`themes/<id>/vite.config.ts` 的 `lib.fileName`）。 */
const BUILT_ENTRY = 'index.js';

function listThemeDirs() {
  return fs
    .readdirSync(THEMES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !SKIP_DIRS.has(e.name) && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort();
}

/** 读 JSON；失败返回 null（调用方记账）。 */
function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

/** @returns {string[]} 该主题的失败描述（空 = 通过） */
function checkTheme(name) {
  const dir = path.join(THEMES_DIR, name);
  const failures = [];

  const srcManifestPath = path.join(dir, 'theme.manifest.json');
  if (!fs.existsSync(srcManifestPath)) {
    return [`${name}: 缺源 theme.manifest.json —— 这不是一个合法主题目录`];
  }
  const srcManifest = readJson(srcManifestPath);
  if (!srcManifest) return [`${name}: 源 theme.manifest.json 不是合法 JSON`];

  const distDir = path.join(dir, 'dist');
  const distManifestPath = path.join(distDir, 'theme.manifest.json');
  if (!fs.existsSync(distManifestPath)) {
    return [
      `${name}: 缺 dist/theme.manifest.json —— 发行物里没有主题产物` +
        `（跑 \`pnpm build:themes\`；本门禁加 --build 可先构建）`,
    ];
  }
  const distManifest = readJson(distManifestPath);
  if (!distManifest) failures.push(`${name}: dist/theme.manifest.json 不是合法 JSON`);

  if (distManifest) {
    for (const key of ['id', 'version']) {
      if (distManifest[key] !== srcManifest[key]) {
        failures.push(
          `${name}: dist manifest 的 ${key}（${distManifest[key]}）与源（${srcManifest[key]}）不一致`,
        );
      }
    }
  }

  // 构建入口产物
  const entryPath = path.join(distDir, BUILT_ENTRY);
  if (!fs.existsSync(entryPath)) failures.push(`${name}: 缺 dist/${BUILT_ENTRY}（主题构建入口产物）`);

  // manifest 声明的 CSS：tokens + extraCssFiles 必须在 dist 内（构建脚本按存在性拷贝，
  // 声明了却没有 = 产物不完整，运行时会拉 404 的 css）。
  const tokensCss = srcManifest.tokens?.cssFile ?? 'tokens.css';
  const cssFiles = [tokensCss, ...(srcManifest.tokens?.extraCssFiles ?? [])];
  for (const css of cssFiles) {
    if (!fs.existsSync(path.join(distDir, css))) {
      failures.push(`${name}: manifest 声明了 ${css}，但 dist/${css} 不存在`);
    }
  }

  if (!failures.length) {
    console.log(
      `[主题] ${name}: [OK] dist 齐备（id=${srcManifest.id} version=${srcManifest.version}，` +
        `入口 ${BUILT_ENTRY} + ${cssFiles.length} 个 css）`,
    );
  }
  return failures;
}

/**
 * ⑥ 携带布局断言：`host/dist/themes/<id>/dist/theme.manifest.json` 必须在场
 * （+ 其 manifest 声明的 tokens css）。
 * @returns {string[]} 失败描述（`host/dist` 不存在 ⇒ 空数组，由调用方注明跳过）
 */
function checkStaged(name, hostDistExists) {
  if (!hostDistExists) return [];
  const staged = path.join(REPO_ROOT, 'host', 'dist', 'themes', name, 'dist');
  const manifestPath = path.join(staged, 'theme.manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return [
      `${name}: 发行物携带布局缺 host/dist/themes/${name}/dist/theme.manifest.json` +
        `（跑整个 \`pnpm build\`；只跑 build:themes 不会搬进 web root）`,
    ];
  }
  const stagedManifest = readJson(manifestPath);
  const cssFile = stagedManifest?.tokens?.cssFile ?? 'tokens.css';
  if (!fs.existsSync(path.join(staged, cssFile))) {
    return [`${name}: 携带布局里缺 host/dist/themes/${name}/dist/${cssFile}`];
  }
  return [];
}

function main() {
  if (DO_BUILD) {
    console.log('[构建] pnpm build:themes …');
    execFileSync('pnpm', ['-w', 'run', 'build:themes'], { cwd: REPO_ROOT, stdio: 'inherit' });
  }

  const themes = listThemeDirs();
  if (themes.length === 0) {
    console.error('[FAIL] themes/ 下没有任何主题目录。');
    process.exit(1);
  }

  const hostDistExists = fs.existsSync(path.join(REPO_ROOT, 'host', 'dist'));
  if (!hostDistExists) {
    console.log('[跳过] host/dist 不存在 ⇒ 不做 ⑥ 携带布局断言（只跑了 build:themes 时属正常）。');
  }
  const failures = [
    ...themes.flatMap(checkTheme),
    ...themes.flatMap((name) => checkStaged(name, hostDistExists)),
  ];
  console.log('');
  if (failures.length) {
    for (const f of failures) console.error(`[FAIL] ${f}`);
    console.error(`[FAIL] 主题发行产物门禁未通过（${failures.length} 项）。`);
    process.exit(1);
  }
  console.log(
    `[PASS] ${themes.length} 个主题的发行产物齐备且与源 manifest 一致` +
      (hostDistExists ? '，并已搬进 host/dist/themes/（可随发行物带走）。' : '。'),
  );
}

main();
