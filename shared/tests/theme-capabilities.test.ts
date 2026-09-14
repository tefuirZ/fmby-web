/**
 * 主题能力面契约单测（WEB-GOV ④）。
 * 用 node:test 断言 capabilities 契约的纯函数（与 viewmodels.test.ts 同惯例）。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DANGER_CONFIRM_DECISION,
  REQUIRED_CAPABILITIES_BY_DOMAIN,
  THEME_CAPABILITIES,
  declaredCapabilitiesFor,
  missingCapabilitiesFor,
  type ThemeCapabilitiesDeclaration,
} from '../src/theme/capabilities.ts';

const DOMAINS = [
  'browse.home',
  'browse.library',
  'browse.item',
  'browse.play',
  'manage',
  'settings',
  'observability',
] as const;

test('四项必须能力面，全 domain 齐备', () => {
  assert.deepEqual([...THEME_CAPABILITIES], [
    'realtime',
    'mobile',
    'timezone',
    'authorization',
  ]);
  for (const domain of DOMAINS) {
    assert.deepEqual(
      [...REQUIRED_CAPABILITIES_BY_DOMAIN[domain]],
      [...THEME_CAPABILITIES],
      `${domain} 必须要求四项能力面`,
    );
  }
});

test('未声明能力 → 四项全缺', () => {
  const missing = missingCapabilitiesFor(undefined, 'browse.home');
  assert.deepEqual(missing, ['realtime', 'mobile', 'timezone', 'authorization']);
});

test('global 声明覆盖所有 domain', () => {
  const declaration: ThemeCapabilitiesDeclaration = {
    global: ['realtime', 'mobile', 'timezone', 'authorization'],
  };
  for (const domain of DOMAINS) {
    assert.deepEqual(missingCapabilitiesFor(declaration, domain), [], `${domain} 应齐备`);
  }
});

test('byDomain 可单独补齐某 domain（global ∪ byDomain）', () => {
  const declaration: ThemeCapabilitiesDeclaration = {
    global: ['realtime'],
    byDomain: { 'browse.home': ['mobile', 'timezone', 'authorization'] },
  };
  assert.deepEqual(missingCapabilitiesFor(declaration, 'browse.home'), [], 'browse.home 应齐备');
  // 其他 domain 仍缺 mobile/timezone/authorization
  assert.deepEqual(missingCapabilitiesFor(declaration, 'manage'), [
    'mobile',
    'timezone',
    'authorization',
  ]);
});

test('declaredCapabilitiesFor 取并集', () => {
  const declaration: ThemeCapabilitiesDeclaration = {
    global: ['mobile'],
    byDomain: { manage: ['timezone'] },
  };
  assert.deepEqual([...declaredCapabilitiesFor(declaration, 'manage')].sort(), [
    'mobile',
    'timezone',
  ]);
});

test('G-06 裁决留痕：危险确认框不做', () => {
  assert.equal(DANGER_CONFIRM_DECISION.decision, 'no-danger-confirm-dialog');
  assert.ok(DANGER_CONFIRM_DECISION.rationale.includes('confirmed=true'));
});
