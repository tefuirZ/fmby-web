// W-A-RESUME 展示面契约锁：已知状态值必须有正确文案，未知值落 default。
//
// 旧实现只认 V1 词表 ⇒ 后端二元真值（mounted/identified/configured/…）全落
// default，列表每行显示「状态缺失/元数据缺失/挂载缺失」（每行说假话）。
// 后端真源：fmby-v2 catalog_repo read.rs:195-205 / dto/manage.rs:188-202 /
// browse/query_mapping.rs:49-66（筛选白名单，V1 值 400）。

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getSourceStatusLabel,
  getSourceStatusVariant,
  getMetadataStatusLabel,
} from '../src/pages/manage/media-items/formUtils';
import {
  getMountStatusLabel,
  getMountStatusVariant,
} from '../src/pages/manage/media-item-detail/formatters';

test('source：mounted → 已挂载（success），missing → 来源缺失', () => {
  assert.equal(getSourceStatusLabel('mounted'), '已挂载');
  assert.equal(getSourceStatusLabel('missing'), '来源缺失');
  assert.equal(getSourceStatusVariant('mounted'), 'success');
});

test('metadata：identified → 已识别（success），missing → 元数据缺失', () => {
  assert.equal(getMetadataStatusLabel('identified'), '已识别');
  assert.equal(getMetadataStatusLabel('missing'), '元数据缺失');
});

test('mount：后端四值各有正确文案（不再全落「挂载缺失」）', () => {
  assert.equal(getMountStatusLabel('configured'), '已配置');
  assert.equal(getMountStatusLabel('verified'), '已验证');
  assert.equal(getMountStatusLabel('unavailable'), '挂载不可用');
  assert.equal(getMountStatusLabel('maintenance'), '维护中');
  assert.equal(getMountStatusVariant('verified'), 'success');
  assert.equal(getMountStatusVariant('unavailable'), 'danger');
  assert.equal(getMountStatusVariant('maintenance'), 'warning');
});

test('未知值 → default（fail-soft，不崩溃也不冒充已知态）', () => {
  // 类型收窄后运行时仍可能收到旧后端/未知串（防御边界），断言 default 文案。
  assert.equal(getSourceStatusLabel('mystery' as never), '状态缺失');
  assert.equal(getMetadataStatusLabel('mystery' as never), '元数据缺失');
  assert.equal(getMountStatusLabel('mystery' as never), '挂载缺失');
});
