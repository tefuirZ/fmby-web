// SECRETS-METADATA 契约测试（#642 FE-1 元数据驱动与单一真源）。
// 运行：node --import ./tests/register-aliases.mjs --test tests/secrets-metadata.contract.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { peripheralsApi } from '@fmby/v2-shared/contracts/manage/peripherals';

const here = dirname(fileURLToPath(import.meta.url));

test('FE1-1 前端 ManageSecretsPage 源码不得定义硬编码 OVERRIDABLE_KEYS 常量', () => {
  const src = readFileSync(
    resolve(here, '../src/pages/manage/ManageSecretsPage.tsx'),
    'utf8',
  );
  // 机械判据：源码中不得再出现 const OVERRIDABLE_KEYS 数组定义
  assert.equal(
    src.includes('const OVERRIDABLE_KEYS:'),
    false,
    'ManageSecretsPage.tsx 不得再保留硬编码 OVERRIDABLE_KEYS 常量，必须全由后端 DTO 驱动',
  );
});

test('FE1-2 getSecretsStatus 客户端正确透传后端下发的 overridableKeys 与键元数据', async () => {
  (globalThis as unknown as { window: unknown }).window = {
    location: { origin: 'http://localhost:5173' },
  };
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/manage/secrets/status')) {
        return new Response(
          JSON.stringify({
            entries: [
              {
                key: 'providers.tmdb.api_key',
                source: 'env',
                configured: true,
                label: 'TMDB API Key',
                testable_service: 'tmdb',
                overridable: true,
              },
              {
                key: 'providers.onedrive.client_secret',
                source: 'builtin',
                configured: false,
                label: 'OneDrive Client Secret',
                testable_service: null,
                overridable: false,
              },
            ],
            overrides_file: '/etc/fmby/secrets.local.toml',
            microsoft_editions: ['Global', 'China21Vianet'],
            overridable_keys: ['providers.tmdb.api_key'],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return originalFetch(input);
    }) as any;

    const status = await peripheralsApi.getSecretsStatus();
    assert.deepEqual(status.overridableKeys, ['providers.tmdb.api_key']);
    assert.equal(status.entries.length, 2);
    assert.equal(status.entries[0].key, 'providers.tmdb.api_key');
    assert.equal(status.entries[0].label, 'TMDB API Key');
    assert.equal(status.entries[0].testableService, 'tmdb');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// FE1-3 已删（REWORK-FE1 必修 1）：原测试自造 overridable:true/false 数据测 filter，
// 真实后端 SecretStatusEntryDto 无 overridable 字段 ⇒ 真实数据下 filter 恒真（一个都滤不掉）。
// 假绿（证明的是「给自造数据算法能工作」，对生产行为零证明力）。
// fail-closed 真源验证由 FE1-4 变异测试覆盖（overridable_keys 置空/置真下拉随之变化）。

test('FE1-4 变异验证：可写键只认后端 overridable_keys 单一真源，随真源变化（fail-closed）', async () => {
  // REWORK-FE1 必修 2：ManageSecretsPage fallback 恒真（e.overridable !== false 恒 true
  // ⇒ 不可覆盖键漏进可写下拉）。改为只认后端 overridable_keys 单一真源，缺失=空列表 fail-closed。
  // 变异验证：把 overridable_keys 置空/置真各跑一遍，证明下拉随真源变化。
  const { resolveOverridableKeys } = await import('../src/pages/manage/overridableKeys');

  // 真源置真：下拉只有 overridable_keys 里的键
  const statusWithKeys = {
    entries: [
      { key: 'providers.tmdb.api_key', source: 'env' as const, configured: true },
      { key: 'telegram.webhook_secret', source: 'builtin' as const, configured: false },
    ],
    overridesFile: '/etc/fmby/secrets.local.toml',
    microsoftEditions: ['Global', 'China21Vianet'],
    overridableKeys: ['providers.tmdb.api_key'],
  };
  assert.deepEqual(
    resolveOverridableKeys(statusWithKeys),
    ['providers.tmdb.api_key'],
    '置真：下拉只有 overridable_keys 里的键（不可覆盖键 telegram.webhook_secret 不漏进下拉）',
  );

  // 真源置空：下拉空（fail-closed，不可覆盖键不漏进）
  const statusEmptyKeys = {
    ...statusWithKeys,
    overridableKeys: [],
  };
  assert.deepEqual(
    resolveOverridableKeys(statusEmptyKeys),
    [],
    '置空：下拉空（fail-closed，不回落 entries 推导）',
  );

  // 真源缺失：下拉空（fail-closed）
  const statusNoKeys = {
    ...statusWithKeys,
    overridableKeys: undefined,
  };
  assert.deepEqual(
    resolveOverridableKeys(statusNoKeys),
    [],
    '缺失：下拉空（fail-closed，不回落 entries 推导）',
  );
});
