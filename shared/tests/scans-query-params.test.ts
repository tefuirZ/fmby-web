/**
 * FE-SCANS-NO-TASKTYPE 防回归单测（纯函数，无网络）。
 *
 * 背景：后端 `GET /api/manage/scans` **无 `task_type` 维度**——wire 结构体声明了
 * `taskType`（`crates/fmby-v2-http/src/routes/scan_trigger.rs:131`），但桥侧对非空值
 * fail-loud 400（`crates/fmby-v2-server/src/bridges/scan_trigger.rs:254`）。
 * 故前端**不声明、不发送**；本测试钉住「映射器运行期也不透出」。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

const { mapScansQueryToParams } = await import(
  '../src/contracts/manage/mapping/query-params.ts'
);

test('FE-SCANS-NO-TASKTYPE ①：映射器不输出 taskType（含绕过类型的运行期调用）', () => {
  const params = mapScansQueryToParams({
    page: 1,
    pageSize: 50,
    status: 'running',
    libraryId: '3',
    mountId: '7',
    librarySourceId: '7:3',
    // 类型层已删除该字段；此处强制绕过，证明**运行期同样不透出**（纵深防御）。
    taskType: 'manual-refresh',
  } as never);

  assert.ok(params);
  assert.equal(Object.keys(params).includes('taskType'), false);
  assert.equal(Object.values(params).includes('manual-refresh'), false);
  assert.deepEqual(Object.keys(params).sort(), [
    'libraryId',
    'librarySourceId',
    'mountId',
    'page',
    'pageSize',
    'status',
  ]);
});

test('FE-SCANS-NO-TASKTYPE ②：其余参数与后端 wire 名逐名一致', () => {
  const params = mapScansQueryToParams({ status: 'running' });
  assert.ok(params);
  // 后端 `parse_scan_state` 收 snake slug 与 PascalCase（routes/scan_trigger.rs:146），
  // 前端发 PascalCase 形态。
  assert.equal(params?.status, 'Running');
  assert.equal(Object.keys(params ?? {}).includes('taskType'), false);
});
