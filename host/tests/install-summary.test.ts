import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeCache, describeDatabase } from '../src/pages/install/serverConfigLabels.ts';

/**
 * #640 ② 页「生效值摘要」的**凭据不回显**实测（rb01 评审 C2）。
 *
 * 为什么导出这两个纯函数来测：摘要页是「把将要写入的生效值摊开给人核对」，
 * 它**天然会碰到连接串**，而连接串里可能带 `:口令@`。此前 `describeCache` 原样
 * 回显整串、`describeDatabase` 却只取 host/port/db ⇒ 同一页两处口径不一致，
 * 前者会把口令显示在屏幕上。这类回归靠人眼看不住 ⇒ 要可机器重跑的断言。
 *
 * ★纯逻辑已抽到 `serverConfigLabels.ts`：node 加载不了 `.tsx`
 *   （ERR_UNKNOWN_FILE_EXTENSION，含 JSX），与 `passwordPolicy.ts` 同模式
 *   —— 组件只做呈现，判定交给可真跑的纯函数。
 */

const base = {
  dbKind: 'sqlite' as const,
  sqlitePath: '',
  cacheKind: 'builtin' as const,
  redisUrl: '',
  pg: { host: '', port: '', database: '', username: '', password: '' },
  adminUsername: '',
  adminPassword: '',
  adminConfirm: '',
  adminDisplayName: '',
};

test('① Redis 连接串里的口令不得出现在摘要里（原样回显即泄露）', () => {
  const out = describeCache({
    ...base,
    cacheKind: 'redis',
    redisUrl: 'redis://:sup3rSecret@10.0.0.7:6379/2',
  });
  assert.equal(out.includes('sup3rSecret'), false, `摘要泄露了 Redis 口令：${out}`);
  // 主机端口仍要可见 —— 打码不是把信息全抹掉，是只抹凭据。
  assert.match(out, /10\.0\.0\.7/, '主机须保留（否则用户没法核对填错没有）');
  assert.match(out, /6379/, '端口须保留');
});

test('② Redis 带用户名口令时同样不回显', () => {
  const out = describeCache({
    ...base,
    cacheKind: 'redis',
    redisUrl: 'redis://admin:pw123@redis.internal:6379',
  });
  assert.equal(out.includes('admin'), false, `泄露账号：${out}`);
  assert.equal(out.includes('pw123'), false, `泄露口令：${out}`);
  assert.match(out, /redis\.internal/, '主机须保留');
});

test('③ 无凭据的 Redis 串应完整保留（不要过度打码）', () => {
  const out = describeCache({ ...base, cacheKind: 'redis', redisUrl: 'redis://127.0.0.1:6379' });
  assert.match(out, /redis:\/\/127\.0\.0\.1:6379/, `无凭据串不该被动过：${out}`);
});

test('④ 解析不了的连接串：绝不原样回显（里面可能正写着明文口令）', () => {
  const out = describeCache({
    ...base,
    cacheKind: 'redis',
    redisUrl: 'redis://:still秘密@[坏的主机名',
  });
  assert.equal(out.includes('still秘密'), false, `非法串被原样回显：${out}`);
  assert.equal(out.includes('坏的'), false, '非法串不得原样吐出');
});

test('⑤ 未填 / 内置缓存的两种文案', () => {
  assert.match(describeCache({ ...base, cacheKind: 'redis', redisUrl: '   ' }), /未填/);
  assert.match(describeCache({ ...base, cacheKind: 'builtin' }), /内存/);
});

test('⑥ 数据库摘要同样不得带出口令（与 ① 同口径）', () => {
  const out = describeDatabase({
    ...base,
    dbKind: 'postgresql',
    pg: { host: 'db.internal', port: '5432', database: 'fmby', username: 'fmby', password: 'p@ss:w/rd' },
  });
  assert.equal(out.includes('p@ss:w/rd'), false, `PG 口令进摘要：${out}`);
  assert.match(out, /db\.internal/, '主机须保留');
  assert.match(out, /fmby/, '库名须保留');
});

test('⑦ SQLite 路径与空值兜底', () => {
  assert.match(describeDatabase({ ...base, sqlitePath: './data/fmby.db' }), /data\/fmby\.db/);
  assert.match(describeDatabase({ ...base, sqlitePath: '' }), /内置默认路径/);
});
