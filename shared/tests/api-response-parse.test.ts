// FE-MOD-P2-BATCH ① FE-API-AS-T：`shared/src/api/client.ts` 的响应边界
// 此前只有 `(await response.json()) as T`（类型断言 = 零运行时不变量）。本用例
// 证明边界新增了可选 `parse` 校验槽：
//   ① 提供 parse ⇒ 解析结果经它产出（类型断言退化为「校验后收窄」）；
//   ② 提供 parse 且载荷不合法 ⇒ parse 抛错 ⇒ 请求 reject（**不**静默 cast 成 T）；
//   ③ 未提供 parse ⇒ 历史行为逐字不变（raw JSON 原样返回）。
// 走真实 httpClient 链路（stub window/document/fetch，与 csrf-echo.test.ts 同惯例）。
import test from 'node:test';
import assert from 'node:assert/strict';

(globalThis as unknown as { window: unknown }).window = {
  location: { origin: 'http://test.local' },
};

let nextJson: unknown = { n: 1 };
let nextStatus = 200;

const originalFetch = globalThis.fetch;
(globalThis as unknown as { fetch: unknown }).fetch = async () =>
  new Response(JSON.stringify(nextJson), {
    status: nextStatus,
    headers: { 'Content-Type': 'application/json' },
  });

Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: {
    get cookie() {
      return '';
    },
  },
});

const { httpClient } = await import('../src/api/client.ts');

test.after(() => {
  (globalThis as unknown as { fetch: unknown }).fetch = originalFetch;
  delete (globalThis as unknown as { document?: unknown }).document;
});

test('① 提供 parse ⇒ 边界经它产出 T（不再直接 as T）', async () => {
  nextJson = { n: 1 };
  let seenRaw: unknown;
  const result = await (httpClient.get as unknown as (p: string, c: unknown) => Promise<{ n: number }>)(
    '/api/parse-ok',
    {
      parse: (raw: unknown) => {
        seenRaw = raw;
        return { n: 42 };
      },
    },
  );
  assert.deepEqual(seenRaw, { n: 1 }, 'parse 必须拿到原始 JSON');
  assert.equal(result.n, 42, '返回值必须来自 parse（而非被忽略后直接 as T）');
});

test('② 提供 parse 且载荷不合法 ⇒ reject，不静默 cast 成 T', async () => {
  nextJson = { n: 'not-a-number' };
  await assert.rejects(
    (httpClient.get as unknown as (p: string, c: unknown) => Promise<unknown>)('/api/parse-bad', {
      parse: (raw: unknown) => {
        const n = (raw as { n?: unknown }).n;
        if (typeof n !== 'number') {
          throw new Error('响应缺少数值字段 n');
        }
        return { n };
      },
    }),
    /响应缺少数值字段 n/,
    '校验失败必须向上抛错，而不是把坏数据当 T 返回',
  );
});

test('③ 未提供 parse ⇒ 历史行为不变（raw JSON 原样返回）', async () => {
  nextJson = { n: 7 };
  const result = await httpClient.get<{ n: number }>('/api/parse-default');
  assert.deepEqual(result, { n: 7 }, '无 parse 时保持历史 as T 语义');
});
