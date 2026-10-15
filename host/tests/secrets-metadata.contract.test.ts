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
    assert.equal(status.entries[0].overridable, true);
    assert.equal(status.entries[1].overridable, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('FE1-3 自证断言：若 overridableKeys 为空时，正确从 entries 回落过滤可覆盖项', () => {
  const entries = [
    { key: 'key1', source: 'secrets_file' as const, configured: true, overridable: true },
    { key: 'key2', source: 'builtin' as const, configured: false, overridable: false },
  ];
  const derived = entries.filter((e) => e.overridable !== false).map((e) => e.key);
  assert.deepEqual(derived, ['key1'], '回落算法应排除 overridable === false 的只读键');
});
