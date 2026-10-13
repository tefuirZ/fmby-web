import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/**
 * #640 卡面「PG 表单：主机/端口/账号/密码 + 连接测试，五类失败各给明确原因」的
 * **组件接线契约**断言。
 *
 * ★诚实说明（与 `install-wizard-honesty.test.ts` 同一口径）：本仓无 jsdom /
 *   testing-library，引入属新依赖（ponytail 纪律）⇒ 这里断言的是源码接线，
 *   判定本体另有**真跑**：`install-pg-connection.test.ts`（9 例 node:test）。
 *   本文件只保证「组件确实调了那些函数、确实把失败原因显示出来」。
 */

const ROOT = new URL('../../', import.meta.url).pathname;
const FIELDSET = 'host/src/pages/install/DatabaseCacheFieldset.tsx';
const PAGE = 'host/src/pages/install/InstallPage.tsx';

function read(rel: string): string {
  return readFileSync(`${ROOT}${rel}`, 'utf8');
}

test('① ① 页是独立组件文件（InstallPage 受 400 行棘轮约束，不能再堆表单）', () => {
  const src = read(FIELDSET);
  assert.ok(src.length > 0);
});

test('② PG 分支必须逐项给主机/端口/数据库名/账号/密码五个输入', () => {
  const src = read(FIELDSET);
  for (const label of ['主机', '端口', '数据库名', '账号', '密码']) {
    assert.ok(src.includes(label), `① 页应出现「${label}」输入项`);
  }
  // 五个字段的 state 键都在
  for (const key of ['host', 'port', 'database', 'username', 'password']) {
    assert.match(src, new RegExp(`pg\\.${key}|pg: \\{[^}]*${key}`), `应绑定 pg.${key}`);
  }
});

test('③ 不得再让运维手填整串 postgres URL（卡面要的是拆分表单）', () => {
  const src = read(FIELDSET);
  assert.equal(/placeholder="postgres/.test(src), false, '① 页不得出现让用户手写连接串的输入');
  assert.equal(/pgUrl/.test(src), false, '不得保留旧的单行 URL state');
});

test('④ 结构化字段必须经 buildPgUrl 转成 apply 用的 URL（契约 InstallDatabaseChoice 只收 url）', () => {
  const fieldset = read(FIELDSET);
  const page = read(PAGE);
  assert.match(page, /buildPgUrl/, '编排页须用 buildPgUrl 拼 apply 载荷');
  assert.match(fieldset, /pgFieldsProblem/, '① 页须用 pgFieldsProblem 做连接测试前置门控');
});

test('⑤ 连接测试失败必须显示分类原因（五类），不得只进通用错误横幅', () => {
  const src = read(FIELDSET);
  // 组件调 probeFailureText（它内部再走 describeProbeFailure）；把链路两端都钉住，
  // 免得后人把中间层换成「只显示 raw message」。
  assert.match(src, /probeFailureText/, '① 页须调 probeFailureText 把失败归到五类');
  assert.match(src, /连接测试失败/, '失败须在 ① 页就地显式展示（不是只丢给页顶横幅）');
  const pure = read('host/src/pages/install/pgConnection.ts');
  assert.match(pure, /describeProbeFailure/, 'probeFailureText 内部须走 describeProbeFailure');
  assert.match(pure, /PROBE_FAILURE_LABEL\[/, '须按分类取中文文案');
});

test('⑥ 探活文案仍须诚实：只探活、不写配置', () => {
  const src = read(FIELDSET);
  assert.match(src, /只探活|不写配置|尚未写入/, '不得让探活看起来像已落盘');
});

test('⑦ 探活请求对 PG 走结构化字段（契约 DatabaseProbeRequest 支持 host/port/...）', () => {
  const src = read(FIELDSET);
  assert.match(src, /kind:\s*'postgresql'/, 'PG 探活须按契约发 kind=postgresql');
  assert.match(src, /host:/, 'PG 探活须发 host');
  assert.match(src, /port:/, 'PG 探活须发 port');
});

test('⑧ 缓存段必须呈现「未选 Redis ⇒ 回落内置（内存+文件）」（卡面回落语义）', () => {
  const src = read(FIELDSET);
  assert.match(src, /回落/, '须说明未填 Redis 时的回落行为');
  assert.match(src, /内存|文件/, '回落目标要说清是内存+文件');
});

test('⑨ 编排页必须把 ① 页组件接进来（不是留一份死代码）', () => {
  const src = read(PAGE);
  assert.match(src, /DatabaseCacheFieldset/, 'InstallPage 须渲染 ① 页组件');
  assert.match(src, /from '\.\/DatabaseCacheFieldset'/, '须按相对路径引入同目录组件');
});

/**
 * ★用例名按 rb01 I3 修正：原名写「不得落 URL」，但下面只查持久化与日志，
 *   **URL 那条根本没查** ⇒ 名不符实。
 *   为何不补「URL」断言：`InstallDatabaseChoice` 的 postgres 分支契约本身就要求
 *   把整串 `postgres://user:口令@host/db` 作为 apply 载荷提交 —— 那是**契约行为**，
 *   不是泄漏；能守的是「不进 localStorage / sessionStorage / 日志」。
 *   （真要防的是口令进地址栏 query/history，但源码压根不碰 location/history，
 *    加一条永不转红的断言等于自欺，故不写 —— 如实写明。）
 */
test('⑩ 明文口令不得落持久化存储 / 日志（沿用 honesty ⑬ 口径）', () => {
  for (const rel of [FIELDSET, PAGE]) {
    const src = read(rel);
    for (const leak of ['localStorage', 'sessionStorage', 'console.log']) {
      assert.equal(src.includes(leak), false, `${rel} 不得把凭据写入 ${leak}`);
    }
  }
});
