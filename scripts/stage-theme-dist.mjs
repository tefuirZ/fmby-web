#!/usr/bin/env node

/**
 * scripts/stage-theme-dist.mjs
 *
 * 把主题产物**搬进前端 web root**：`themes/<id>/dist/**` → `host/dist/themes/<id>/dist/**`。
 *
 * 为什么需要（REWORK-FE57，rv02 评审的「携带断」）：
 *   发行物只带 `host/dist` ——
 *     · `fmby-v2/.github/workflows/release.yml`：`cd fmby-web/host/dist && zip -qr frontend-dist.zip .`
 *     · `fmby-v2/Dockerfile:159`：`COPY --from=frontend-builder /web/host/dist /app/web`
 *   而主题产物落在 `themes/<id>/dist`（**host 的兄弟目录，不在 host/dist 内**）⇒ 即便
 *   `build:themes` 建了它，发行物也**带不走**（这正是「改完却每页 404」的第二段断点）。
 *
 * 为什么选「拷进 host/dist」而不是改 release 脚本/zip 布局（两条路都通，选前者）：
 *   后端读侧只认 `${data_dir}/themes/<id>/dist/<rest>`，而播种器
 *   （`fmby-v2/crates/fmby-v2-server/src/theme_seed.rs`）从
 *   `$FMBY_DEFAULT_THEME_DIR/<id>/dist/**` 复制。把主题放进 `host/dist/themes/<id>/dist/**`
 *   后：**既有 zip 逻辑与 Dockerfile COPY 一行不改**就带走了它，解包/挂载后
 *   `<web_root>/themes/<id>/dist/**` 正是播种器要的布局 ⇒ 部署侧只需设
 *   `FMBY_DEFAULT_THEME_DIR=<web_root>/themes`（Docker 内即 `/app/web/themes`）。
 *   反之改 zip/artifact 布局要同时动 release.yml、build-artifacts.mjs 与解包侧，风险更大而无功能收益。
 *
 * 幂等：每次先清空目标 `host/dist/themes/`（防上一次的陈旧文件残留），再整体复制。
 *
 * 用法（由 host 的 `build` 脚本在 `build:themes` 之后调用）：
 *   node scripts/stage-theme-dist.mjs
 */

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const THEMES_DIR = join(REPO_ROOT, 'themes');
const HOST_DIST = join(REPO_ROOT, 'host', 'dist');
const STAGE_ROOT = join(HOST_DIST, 'themes');

function die(msg) {
  console.error(`FAIL(stage-theme-dist): ${msg}`);
  process.exit(1);
}

if (!existsSync(HOST_DIST)) {
  die(`host/dist 不存在（${HOST_DIST}）—— 本步骤必须在 host vite build 之后运行。`);
}

/** 有产物目录的主题（`themes/<id>/dist`）。 */
const themes = readdirSync(THEMES_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
  .map((e) => e.name)
  .sort()
  .filter((name) => existsSync(join(THEMES_DIR, name, 'dist')));

if (themes.length === 0) {
  die('没有任何 themes/<id>/dist —— 先跑 build:themes（否则发行物带不走任何主题）。');
}

// 幂等：先清空舞台，避免上一次的陈旧文件被当成「本次产物」带进发行物。
rmSync(STAGE_ROOT, { recursive: true, force: true });

let total = 0;
for (const name of themes) {
  const src = join(THEMES_DIR, name, 'dist');
  const dest = join(STAGE_ROOT, name, 'dist');
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  const files = (function count(dir) {
    let n = 0;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) n += count(join(dir, e.name));
      else n += 1;
    }
    return n;
  })(dest);
  if (!statSync(join(dest, 'theme.manifest.json')).isFile()) {
    die(`${name}: 产物里缺 theme.manifest.json（读侧与播种器都以它为锚）`);
  }
  total += files;
  console.log(`  舞台化 ${name}: ${files} 文件 → host/dist/themes/${name}/dist/`);
}

console.log(
  `[PASS] stage-theme-dist：${themes.length} 个主题（共 ${total} 文件）已进 host/dist/themes/` +
    `（发行物只带 host/dist ⇒ 现在能带走了）。`,
);
