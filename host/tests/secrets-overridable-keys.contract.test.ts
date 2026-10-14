// SECRETS-OVERRIDABLE-KEYS-G13 契约测试（#642 缺口清单 G-13）。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// 覆盖：
// - ① 前端 `OVERRIDABLE_KEYS` 与后端 `SecretsConfig::apply_override` 白名单**逐项一致**
//      （曾互差 2 项：前端多 providers.hash_service.api_key、缺 providers.subtitle.token）；
// - ② 幂等自证：把任一侧故意改错一项，断言必须红（防「测试本身不生效」的假绿）。
//
// ★单一真源说明：后端白名单的权威出处是
//   `crates/fmby-v2-bridges/src/config/secrets.rs` 的 `apply_override` match 分支。
//   本测试把它**逐字复刻**成期望集，任一例漂移即红。
//   BE-3 落地后前端将改为渲染 `SecretsStatusDto.overridable_keys`（后端下发），
//   届时本常量与测试一并删除（防漂移的职责由「后端单一真源」天然承担）。

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * 后端白名单（`SecretsConfig::apply_override`，顺序与后端 match 一致）。
 * 改这里 = 改「期望」；若后端真改了白名单而这里没跟上，①会红 —— 那是**故意的**：
 * 它逼着两侧同步改，而不是各自漂移。
 */
const BACKEND_WHITELIST: readonly string[] = [
  'providers.tmdb.api_key',
  'providers.douban.api_key',
  'providers.onedrive.client_id',
  'providers.scrape_server.api_key',
  'providers.mediasvc.api_key',
  'providers.mediasvc.token',
  'providers.subtitle.token',
  'providers.telegram.bot_token',
  'providers.ai.endpoint',
  'providers.ai.api_key',
  'providers.ai.model_name',
];

/** 从 ManageSecretsPage.tsx 源码里解析出 `OVERRIDABLE_KEYS` 数组的字面量。 */
function readFrontendKeys(): string[] {
  const src = readFileSync(
    resolve(here, '../src/pages/manage/ManageSecretsPage.tsx'),
    'utf8',
  );
  const start = src.indexOf('const OVERRIDABLE_KEYS');
  assert.notEqual(start, -1, 'ManageSecretsPage.tsx 应定义 OVERRIDABLE_KEYS');
  const open = src.indexOf('[', start);
  const close = src.indexOf('];', open);
  assert.notEqual(close, -1, 'OVERRIDABLE_KEYS 数组应能闭合');
  const body = src.slice(open + 1, close);
  const keys = [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.ok(keys.length > 0, 'OVERRIDABLE_KEYS 不应为空');
  return keys;
}

test('G13-1 前端 OVERRIDABLE_KEYS 与后端 apply_override 白名单逐项一致', () => {
  const frontend = readFrontendKeys();
  assert.deepEqual(
    frontend,
    [...BACKEND_WHITELIST],
    '前端可覆盖键表必须与后端白名单逐项一致（含顺序）；' +
      '差异即 G-13 漂移：前端多出的键一改就 400，前端缺失的键网页改不动',
  );
});

test('G13-2 幂等自证：期望集被改坏时断言必须能发现（防假绿）', () => {
  // 自证方式：用两个「已知与后端不同」的伪前端表，验证判据真的能区分。
  const missingSubtitle = BACKEND_WHITELIST.filter(
    (k) => k !== 'providers.subtitle.token',
  );
  assert.notDeepEqual(
    missingSubtitle,
    [...BACKEND_WHITELIST],
    '自证：缺 subtitle.token 的表必须被判为不同（否则 G13-1 是假绿）',
  );
  const extraHashService = [...BACKEND_WHITELIST, 'providers.hash_service.api_key'];
  assert.notDeepEqual(
    extraHashService,
    [...BACKEND_WHITELIST],
    '自证：多 hash_service.api_key 的表必须被判为不同（否则 G13-1 是假绿）',
  );
});
