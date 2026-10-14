// fmby-web#658：CAS `copy_state` **四态 × 未知码穷举表**（纯逻辑，不依赖后端）。
// 运行：node --import ./tests/register-aliases.mjs --test tests/cas-copy-state-matrix.test.ts
//
// 背景（用户指令③）：把 formatCasDrive / CasCopyStateBadge 的四态与未知码做成穷举表，
//   逐条写「当前显示什么 / 期望显示什么」，并把**契约未列出的新码**的行为定死：
//     fail-closed ⇒ **显示原文码**，绝不静默归入 Present。
//
// ★最危险的一条：把未知码显示成「已复制/正常」。运维据此以为副本齐了，
//   实际可能实体已丢失 —— 这类谎言必须被逐条打红。

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KNOWN_COPY_STATES,
  formatUnknownCopyState,
  isKnownCopyState,
  resolveCopyStateLabel,
  resolveCopyStateTone,
} from '../src/pages/manage/cas/formatCasDrive';

/** 穷举表：后端枚举四态（权威 fmby-v2-domain/src/cas.rs:64）。 */
const MATRIX: Array<{
  code: string;
  expectLabel: string;
  expectTone: string;
  meaning: string;
}> = [
  { code: 'pending', expectLabel: '待落位', expectTone: 'warning', meaning: '尚未得出落位结论' },
  { code: 'present', expectLabel: '已复制', expectTone: 'success', meaning: '盘上确认存在（reconciled）' },
  { code: 'failed', expectLabel: '实体丢失', expectTone: 'danger', meaning: '实体丢失（三类差异之一）' },
  { code: 'tombstoned', expectLabel: '上游已删', expectTone: 'danger', meaning: '上游已删 / 墓碑化（非 reconciled）' },
];

test('① 四态穷举：每个已知码的文案与色调逐条对（含语义注释）', () => {
  for (const row of MATRIX) {
    assert.equal(
      resolveCopyStateLabel(row.code),
      row.expectLabel,
      `${row.code}（${row.meaning}）的文案不符`,
    );
    assert.equal(
      resolveCopyStateTone(row.code),
      row.expectTone,
      `${row.code}（${row.meaning}）的色调不符`,
    );
    assert.ok(isKnownCopyState(row.code), `${row.code} 须属于已知四态`);
  }
});

test('② 已知集合**精确等于**四态（不多不少，防凭空发明幽灵状态）', () => {
  assert.deepEqual(
    [...KNOWN_COPY_STATES].sort(),
    ['failed', 'pending', 'present', 'tombstoned'],
    'KNOWN_COPY_STATES 须与后端枚举精确相等',
  );
  // 反例：后端不存在的取值不得被发明出来。
  for (const ghost of ['copying', 'missing', 'ok', 'conflict', 'synced']) {
    assert.ok(!KNOWN_COPY_STATES.includes(ghost), `${ghost} 后端不存在，不得发明`);
  }
});

test('③ 未知码 fail-closed：显示**原文码**，绝不静默归入 present/已复制', () => {
  for (const code of ['weird-new-backend-state', 'Present', 'PRESENT', 'replicating', 'x']) {
    const label = resolveCopyStateLabel(code);
    // ★核心：不得显示成「已复制」或任何已知语义。
    assert.notEqual(label, '已复制', `${code} 不得被显示成「已复制」`);
    assert.notEqual(label, '待落位');
    assert.notEqual(label, '实体丢失');
    assert.notEqual(label, '上游已删');
    // ★必须保留原文码（运维要能照着上报）。
    assert.ok(
      label.includes(code),
      `未知码 ${code} 的展示须包含原文码，实际：${label}`,
    );
    assert.equal(resolveCopyStateTone(code), 'neutral', '未知码色调须为 neutral（不与成功混淆）');
  }
});

test('④ 空码 / 空白码：明确说「未提供」，不显示空括号（看着像渲染 bug）', () => {
  const empty = resolveCopyStateLabel('');
  assert.notEqual(empty, '已复制');
  assert.ok(!empty.includes('（）'), `空码不得渲染成空括号：${empty}`);
  assert.ok(empty.length > 0);
  // 纯空白同样按「未提供」处理（trim 后判空）。
  assert.equal(resolveCopyStateLabel('   '), resolveCopyStateLabel(''));
});

test('⑤ formatUnknownCopyState 直接断言（供调用方复用同一口径）', () => {
  assert.equal(formatUnknownCopyState('zzz'), '未知状态（zzz）');
  assert.equal(formatUnknownCopyState('  zzz  '), '未知状态（zzz）', '需 trim');
  assert.equal(formatUnknownCopyState(''), '未知状态（后端未提供状态码）');
  // 已知码不应走未知分支（由 resolveCopyStateLabel 保证，此处交叉验证）。
  assert.notEqual(resolveCopyStateLabel('present'), formatUnknownCopyState('present'));
});

test('⑥ 四态 + 未知 = 完备：任何输入必落在「已知四态」或「未知带原文码」之一', () => {
  const inputs = [...MATRIX.map((r) => r.code), 'brand-new-code', '', '  '];
  for (const code of inputs) {
    if (isKnownCopyState(code)) {
      assert.ok(
        MATRIX.some((r) => r.code === code),
        `${code} 判为已知却不在四态表内`,
      );
    } else {
      const label = resolveCopyStateLabel(code);
      assert.ok(label.startsWith('未知状态'), `${code} 判为未知，文案须以「未知状态」开头：${label}`);
    }
  }
});
