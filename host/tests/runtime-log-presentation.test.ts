import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RuntimeLogRecord } from '@fmby/v2-shared/contracts/manage';
import {
  buildRuntimeLogView,
  extractStructuredFields,
  formatRuntimeTargetLabel,
} from '../src/pages/manage/runtimeLogPresentation/index';

/**
 * FE-COMPONENT-SPLIT-B2：runtimeLogPresentation 拆分的**行为与导出面快照**。
 *
 * ★为什么要这份测试：拆分（桶+子模块）必须**保导出面与行为**。本仓此前该文件
 * 零测试 ⇒ 纯重构无法证「行为不变」。本测试锁住三个对外函数的行为与 5 个导出，
 * 拆分前后必须同绿（拆分前因 barrel 不存在而红 ⇒ 即为 RED）。
 */

const record: RuntimeLogRecord = {
  id: '1',
  timestamp: '2026-10-03T00:00:00Z',
  level: 'info',
  target: 'http_access',
  message: 'compat playback info request',
  requestId: 'req-1',
  sourceFile: 'a.rs',
  rawLine: 'method=GET path=/api/x status=200 elapsed_ms=12 request_id=req-1 client=c ip=1.2.3.4',
};

test('导出面：三个对外函数可用且为函数', () => {
  assert.equal(typeof buildRuntimeLogView, 'function');
  assert.equal(typeof extractStructuredFields, 'function');
  assert.equal(typeof formatRuntimeTargetLabel, 'function');
});

test('extractStructuredFields：按 key= 切分并清理空白', () => {
  const fields = extractStructuredFields(record.rawLine);
  assert.equal(fields.get('method'), 'GET');
  assert.equal(fields.get('path'), '/api/x');
  assert.equal(fields.get('status'), '200');
  assert.equal(fields.get('request_id'), 'req-1');
});

test('buildRuntimeLogView：事件/目标/结果标签与字段分桶', () => {
  const view = buildRuntimeLogView(record);

  assert.equal(view.record, record, 'record 原样带回');
  assert.equal(view.targetLabel, '网页请求', 'http_access → 网页请求');
  assert.equal(view.eventLabel, '兼容播放信息请求');
  assert.ok(view.headline.length > 0, 'headline 非空');

  const primaryKeys = view.primaryFields.map((f) => f.key);
  assert.ok(primaryKeys.includes('status'), 'status 属主字段');
  assert.ok(primaryKeys.includes('elapsed_ms'), 'elapsed_ms 属主字段');

  // 主字段与附加字段互斥（PRIMARY_FIELD_ORDER 内的不重复进 extraFields）
  for (const extra of view.extraFields) {
    assert.ok(!primaryKeys.includes(extra.key), `主字段 ${extra.key} 不得重复出现在 extraFields`);
  }
});

test('buildRuntimeLogView：无结构化字段时不炸（rawLine 无 key=）', () => {
  // 注意：requestId 会兜底注入 request_id 主字段 ⇒ 本例须一并去掉 requestId，
  // 才能断言「真·零字段」分支（与拆分前原实现同行为，非弱化断言）。
  const bare: RuntimeLogRecord = {
    ...record,
    rawLine: 'plain text without kv',
    requestId: undefined,
  };
  const view = buildRuntimeLogView(bare);
  assert.equal(view.primaryFields.length, 0);
  assert.equal(view.extraFields.length, 0);
  assert.ok(view.headline.length > 0);
});

test('buildRuntimeLogView：requestId 兜底注入 request_id 主字段', () => {
  // 拆分前既有行为（requestId ?? fieldMap.get('request_id') 后回写），拆分后须保持。
  const bare: RuntimeLogRecord = { ...record, rawLine: 'plain text without kv' };
  const view = buildRuntimeLogView(bare);
  assert.ok(
    view.primaryFields.some((f) => f.key === 'request_id'),
    'requestId 存在时 request_id 必须作为主字段出现',
  );
});

test('formatRuntimeTargetLabel：已知 target 映射中文，未知原样返回', () => {
  assert.equal(formatRuntimeTargetLabel('http_access'), '网页请求');
  assert.equal(formatRuntimeTargetLabel('compat_access'), '兼容客户端请求');
  assert.equal(formatRuntimeTargetLabel('totally_unknown_target'), 'totally_unknown_target');
});
