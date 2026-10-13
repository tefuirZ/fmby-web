import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildPgUrl,
  classifyProbeFailure,
  PROBE_FAILURE_LABEL,
  pgFieldsProblem,
  type PgFields,
  type ProbeFailureKind,
} from '../src/pages/install/pgConnection.ts';

/**
 * fmby-v2 #640 卡面「PG 表单：主机/端口/账号/密码 + 连接测试，五类失败各给明确原因」的**纯函数实测**。
 *
 * ★诚实边界（ponytail）：后端 `DatabaseProbeResponse` 只有 `message` 一个自由文本
 *   （`shared/src/contracts/auth/api.ts:94`），**没有结构化错误码**。故分类靠
 *   message 关键词匹配 —— 这是前端侧的尽力而为，不是权威判定；后端 `install_flow.rs`
 *   补出 `code` 字段后应改为直接读 code（升级路径见 pgConnection.ts 注释）。
 *   认不出的一律归 unknown 并**原样展示后端 message**，绝不编造原因。
 */

const full: PgFields = {
  host: 'db.internal',
  port: '5432',
  database: 'fmby',
  username: 'fmby',
  password: 'secret',
};

test('① 必填缺失逐项给中文原因（host/database/username/password）', () => {
  assert.equal(pgFieldsProblem({ ...full, host: '' }), '请填写数据库主机');
  assert.equal(pgFieldsProblem({ ...full, database: '' }), '请填写数据库名');
  assert.equal(pgFieldsProblem({ ...full, username: '' }), '请填写数据库账号');
  assert.equal(pgFieldsProblem({ ...full, password: '' }), '请填写数据库密码');
});

test('② 端口：留空走默认 5432，非数字或越界才报错', () => {
  assert.equal(pgFieldsProblem({ ...full, port: '' }), null, '端口留空应可过（用默认）');
  assert.equal(pgFieldsProblem({ ...full, port: 'abc' }), '端口必须是数字');
  assert.equal(pgFieldsProblem({ ...full, port: '0' }), '端口须在 1-65535 之间');
  assert.equal(pgFieldsProblem({ ...full, port: '65536' }), '端口须在 1-65535 之间');
  assert.equal(pgFieldsProblem(full), null, '五项齐备应通过');
});

test('③ 留空 host 优先报主机（一次只报第一条，不刷屏）', () => {
  assert.equal(pgFieldsProblem({ host: '', database: '', username: '', password: '', port: '' }), '请填写数据库主机');
});

test('④ buildPgUrl：拼出可被 sqlx 直接吃的 postgres:// URL', () => {
  assert.equal(buildPgUrl(full), 'postgres://fmby:secret@db.internal:5432/fmby');
  assert.equal(
    buildPgUrl({ ...full, port: '' }),
    'postgres://fmby:secret@db.internal:5432/fmby',
    '端口留空须落默认 5432',
  );
});

test('⑤ buildPgUrl：密码/账号里的保留字符必须百分号编码（否则 URL 解析错位）', () => {
  const url = buildPgUrl({
    host: 'db.internal',
    port: '5432',
    database: 'fmby',
    username: 'f@mby',
    password: 'p@ss:w/rd#1',
  });
  // '@' 不编码会把 host 截断到错误位置；':' '/' '#' 同理。
  assert.equal(url, 'postgres://f%40mby:p%40ss%3Aw%2Frd%231@db.internal:5432/fmby');
  assert.equal(url.includes('p@ss'), false, '明文保留字符不得裸奔在 URL 里');
  // 编码后必须还能解回来（凭据没被改坏）。
  const parsed = new URL(url);
  assert.equal(decodeURIComponent(parsed.password), 'p@ss:w/rd#1');
  assert.equal(decodeURIComponent(parsed.username), 'f@mby');
  assert.equal(parsed.hostname, 'db.internal');
  assert.equal(parsed.pathname, '/fmby');
});

test('⑥ 五类失败各归其类（DNS/TCP/认证/库不存在/schema 不可写）', () => {
  const cases: [string, ProbeFailureKind][] = [
    ['could not translate host name "nope.invalid": Name or service not known', 'dns'],
    ['error connecting server: Connection refused (os error 111)', 'tcp'],
    ['timeout while connecting to 10.0.0.8:5432', 'tcp'],
    ['password authentication failed for user "fmby"', 'auth'],
    ['database "fmby" does not exist', 'database-missing'],
    ['permission denied for schema public', 'schema-unwritable'],
  ];
  for (const [message, expected] of cases) {
    assert.equal(classifyProbeFailure(message), expected, `${message} 应归 ${expected}`);
  }
  // 大小写不敏感（后端错误串大小写不稳）
  assert.equal(classifyProbeFailure('CONNECTION REFUSED'), 'tcp');
});

test('⑦ 认不出的一律 unknown（不编造原因），空/undefined 也走 unknown', () => {
  assert.equal(classifyProbeFailure('something exotic happened'), 'unknown');
  assert.equal(classifyProbeFailure(''), 'unknown');
  assert.equal(classifyProbeFailure(undefined), 'unknown');
});

test('⑧ 五类每类都有可展示的中文原因，且 unknown 也在表内', () => {
  const kinds: ProbeFailureKind[] = ['dns', 'tcp', 'auth', 'database-missing', 'schema-unwritable', 'unknown'];
  for (const kind of kinds) {
    const label = PROBE_FAILURE_LABEL[kind];
    assert.equal(typeof label, 'string', `${kind} 须有文案`);
    assert.ok(label.length > 0, `${kind} 文案不得为空`);
  }
  // 原因要「可行动」：告诉用户下一步查什么，而不是只说失败了。
  assert.match(PROBE_FAILURE_LABEL['database-missing'], /不存在/);
  assert.match(PROBE_FAILURE_LABEL['schema-unwritable'], /权限|写/);
  assert.match(PROBE_FAILURE_LABEL.dns, /主机名|域名|解析/);
});

test('⑨ 分类器是关键词匹配不是整串相等（同一类不同措辞同类）', () => {
  assert.equal(
    classifyProbeFailure('dns error: failed to lookup address information'),
    classifyProbeFailure('could not translate host name "x": Name or service not known'),
    '两种 DNS 措辞应归同类',
  );
});
