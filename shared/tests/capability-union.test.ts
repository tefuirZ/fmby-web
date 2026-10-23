/**
 * Capability 字面量联合的**契约钉子**（F1）。
 *
 * 为什么需要它：后端 `Capability` 是 Rust 枚举（`fmby-v2-domain/src/access/models.rs:197`），
 * 有 `as_str()` 单一真源与 `parse()` fail-closed；前端本卡把它落成 TS 字面量联合后，
 * 两份清单就**物理分居两仓**。后端加第 9 个能力而前端没跟 ⇒ 类型面说谎（比 `string`
 * 更隐蔽：联合类型是「看起来受保护」的假安全）。故必须有这条计数断言。
 *
 * 钉三件事：
 *   ① 联合成员数 == 后端 `Capability::ALL` 长度（本卡当刻 8）；
 *   ② 成员值与后端 `as_str()` 逐值相等（顺序无关，防改名漂移）；
 *   ③ `parseCapability` 对未知串 fail-closed（不回落默认、不静默放行）。
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CAPABILITIES,
  parseCapability,
  type Capability,
} from '../src/contracts/auth/capability';
import { hasCapabilityIn } from '../src/contracts/auth/capabilityCheck';
import type { User } from '../src/contracts/auth/user';

/** 后端 `Capability::as_str()` 的逐值镜像（models.rs:210-223）。改后端枚举 ⇒ 这里必须同步。 */
const BACKEND_CAPABILITY_STRINGS: readonly string[] = [
  'Browse',
  'Play',
  'ManageAccess',
  'ManageLibrary',
  'ManageMount',
  'ManageSettings',
  'DangerousAction',
  'ViewAudit',
];

test('① 前端联合成员数 == 后端 Capability::ALL 长度（8）', () => {
  assert.equal(
    CAPABILITIES.length,
    BACKEND_CAPABILITY_STRINGS.length,
    `前端 ${CAPABILITIES.length} 项 vs 后端 ${BACKEND_CAPABILITY_STRINGS.length} 项 ⇒ 后端加/删能力时前端没同步（类型面说谎）`,
  );
});

test('② 成员值与后端 as_str() 逐值相等（防改名漂移）', () => {
  assert.deepEqual(
    [...CAPABILITIES].sort(),
    [...BACKEND_CAPABILITY_STRINGS].sort(),
    '能力字面量与后端 as_str() 不一致 ⇒ wire 串对不上（microsoft 403 同型漂移）',
  );
});

test('③ parseCapability 对未知串 fail-closed（不回落默认）', () => {
  for (const bad of ['', 'managee:access', 'BrowseX', 'SUPER_ADMIN', 'browse ']) {
    assert.equal(parseCapability(bad), null, `未知串「${bad}」必须 fail-closed 返回 null`);
  }
});

test('③b parseCapability 认得全部后端字面量', () => {
  for (const ok of BACKEND_CAPABILITY_STRINGS) {
    assert.equal(parseCapability(ok), ok as Capability, `后端能力「${ok}」应被识别`);
  }
});

test('③c 归一契约：PascalCase 与 colon 风格在查询侧等价（hasCapabilityIn）', () => {
  // 后端发 PascalCase（capability_to_str），前端历史查询面是 colon 风格 ⇒
  // 这层归一是契约必需（见 capabilityCheck.ts 文件头 #289 纪律），一并废除会误禁真管理员。
  const user: User = { id: '1', name: 'u', roles: [], capabilities: ['ManageAccess'] };
  assert.equal(hasCapabilityIn(user, 'ManageAccess'), true);
  assert.equal(hasCapabilityIn(user, 'manage:access'), true);
  // 反例：能力面绝不做子串匹配（ManageAccessXxx ≠ manage:access）
  const other: User = { id: '2', name: 'u', roles: [], capabilities: ['ManageAccessXxx'] };
  assert.equal(hasCapabilityIn(other, 'manage:access'), false);
});
