import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { installStatusProblem } from '../src/pages/install/installStatus.ts';

/**
 * #640 卡面「已安装后安装页不可达（后端拒访时给对提示）」的**纯函数实测**。
 *
 * 背景（真源）：`install_flow::router` 只挂在**安装模式进程**；已安装实例的
 * `assemble_api_router` 里没有 install ⇒ `/api/install/status` 直接 404。
 * 前端把这个 404 当成「通用读取失败」会误导运维去查网络 —— 实际是**安装面根本没挂**。
 *
 * ★印记：不能把 404 一律说成「已安装」。`/api/install/*` 在**未装**的安装模式进程里
 *   是存在的（status 会回 needs_database），404 只可能来自「没挂安装面」这一形态 ⇒
 *   文案说「很可能已安装」，并给出两条可行动作，而不是断言。
 */

test('① 404（安装面未挂载）⇒ 专属提示，并给出下一步动作', () => {
  const text = installStatusProblem({ code: 'HTTP_404', message: 'Not Found', status: 404 });
  assert.ok(text, '404 须有专属文案');
  assert.match(text, /已安装|安装面/);
  assert.match(text, /登录|重启|主应用/, '须给可行动作，而不是只说 404');
});

test('② 401 / 403：认得出是「拒访」而不是下载失败', () => {
  for (const [code, status] of [['HTTP_401', 401], ['unauthorized', 401], ['HTTP_403', 403], ['forbidden', 403]] as const) {
    const text = installStatusProblem({ code, message: 'nope', status });
    assert.ok(text, `${code} 须有专属文案`);
    assert.match(text, /拒绝|未授权|无权|权限/, `${code} 文案须点明是权限/拒访`);
  }
});

test('③ 认不出的错误返回 null（交给通用错误展示，不抢话）', () => {
  assert.equal(installStatusProblem({ code: 'dependency_timeout', message: 'x', status: 504 }), null);
  assert.equal(installStatusProblem(new Error('boom')), null);
  assert.equal(installStatusProblem(undefined), null);
  assert.equal(installStatusProblem(null), null);
  assert.equal(installStatusProblem('nope'), null);
});

test('④ 只有 code 没有 status 也要认（不同传输层给的字段不一样）', () => {
  assert.ok(installStatusProblem({ code: 'HTTP_404', message: 'Not Found' }), '仅 code=HTTP_404 须认');
  assert.ok(installStatusProblem({ code: 'not_found', message: 'Not Found' }), '后端 slug not_found 须认');
});

test('⑤ 文案不得泄露内部路径以外的实现细节，也不得谎报「数据已丢失」', () => {
  const text = installStatusProblem({ code: 'HTTP_404', message: 'Not Found', status: 404 }) ?? '';
  assert.equal(/已丢失|数据丢失|损坏/.test(text), false, '不得吓唬用户说数据丢了');
  assert.equal(/traceback|panic|unwrap/i.test(text), false, '不得透出后端内部错误细节');
});

test('⑥ 编排页必须真的用上它（不是写了不接的死代码）', () => {
  const page = readFileSync(
    new URL('../../host/src/pages/install/InstallPage.tsx', import.meta.url),
    'utf8',
  );
  assert.match(page, /installStatusProblem\(/, 'InstallPage 须调 installStatusProblem');
  // 未识别时仍要有回退文案，不能把错误吞成空白横幅。
  assert.match(page, /getErrorMessage\(/, '回退分支仍须展示通用错误文本');
});
