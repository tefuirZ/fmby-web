// FE-CAS-G1：盘配置**写面可用性**回归契约（#658 · FIX-CAS-G1+G2）
//
// 跑法：cd host && node --import ./tests/register-aliases.mjs --test tests/cas-drive-write-affordance.contract.test.ts
//
// 钉的是什么：`PUT /api/admin/cas/drives` 的桥层实现**不存在**（fmby-v2
// `git grep -n 'fn upsert_drive_config' -- crates/fmby-v2-bridges` 零命中
// ⇒ 命中 `CasAdminService` trait 默认体 `AppError::Internal` ⇒ **点即 500**）。
// 因此页面必须**在渲染期**就不可写并说明原因 —— 既不许"点了没反应"，也不许"假装保存成功"。
//
// 主判据走**直接调用**纯函数（照本模块纪律：源码字符串断言对「把失败藏起来」恒绿）；
// 末尾一条 `readSrc` 只做**接线检查**（防"助手写了但没人用"），不冒充行为证明。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const HOST_ROOT = join(import.meta.dirname, '..');
const readSrc = (rel: string) => readFile(join(HOST_ROOT, 'src', rel), 'utf8');

const {
  DRIVE_CONFIG_WRITE_WIRED,
  resolveDriveWriteAffordance,
} = await import('../src/pages/manage/cas/driveConfigEditing.ts');

test('① 未接线 ⇒ 一律禁用，且原因文案点名 500（不藏失败）', () => {
  assert.equal(DRIVE_CONFIG_WRITE_WIRED, false, '桥层未实现 upsert_drive_config ⇒ 开关必须仍是 false');
  const w = resolveDriveWriteAffordance();
  assert.equal(w.disabled, true, '未接线 ⇒ 必须禁用');
  assert.ok(w.note, '禁用必须给原因（否则就是"点了没反应"）');
  assert.match(w.note!, /未接线/, `原因须写明是接线问题：${w.note}`);
  assert.match(w.note!, /500/, `原因须写明后果（保存会 500）：${w.note}`);
});

test('② 文案不得承诺成功，也不得暗示"稍后自动生效"', () => {
  const { note } = resolveDriveWriteAffordance();
  for (const bad of ['已保存', '保存成功', '稍后', '自动']) {
    assert.ok(!note!.includes(bad), `禁用文案里不该出现「${bad}」：${note}`);
  }
  assert.match(note!, /不会?被保存|只读/, `必须讲明改动不生效：${note}`);
});

test('③ 后端补齐实现后（wired=true）⇒ 可写且不再显示只读说明', () => {
  const w = resolveDriveWriteAffordance(true);
  assert.equal(w.disabled, false, '接线后不得继续禁用（否则本卡变成新的功能缺失）');
  assert.equal(w.note, null, '可写时不占位显示只读说明');
});

test('④ 接线检查（弱判据）：页面与三个控件确实消费该可用性', async () => {
  const page = await readSrc('pages/manage/ManageCasPage.tsx');
  assert.match(page, /resolveDriveWriteAffordance\(\)/, '页面必须取可用性判据');
  assert.match(page, /disabled=\{write\.disabled \|\| saving \|\| !dirty\}/, '「保存」按钮必须吃该判据');
  assert.match(page, /checked=\{draft\.enabled\}\s*\n\s*disabled=\{write\.disabled\}/, '开关控件必须禁用');
  assert.match(page, /value=\{draft\.priority\}\s*\n\s*disabled=\{write\.disabled\}/, '优先级控件必须禁用');
  assert.match(page, /InlineBanner[\s\S]{0,160}write\.note/, '禁用态必须有可见说明');
});
