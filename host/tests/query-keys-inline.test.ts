// F-27（fmby-web#1）：queryKey 工厂回归锁（可证伪）。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// F-27 的真实缺陷是「结构脱队」：9 处 useQuery/invalidateQueries 直接内联
// queryKey 数组，与 shared/src/query/keys.ts 的工厂不同族——一侧改名即静默失联。
//
// ⚠️ 诚实边界：卡面称「挂载抽屉改完绑定列表不刷新」**不成立**——原代码里
// useQuery 与 invalidate 用的是同一个内联字面量，self-invalidate 本就生效。
// 本测试因此不声称修复该症状，只锁三件可证伪的事实：
//   1. 迁移后的工厂键与原内联字面量**逐段相同**（缓存键不变、已有缓存不失效）；
//   2. 失效前缀确实可达（MfaTotpSection 的 invalidate 能打到 mfaStatus）；
//   3. host/src 内已无内联 queryKey 字面量（防回流）。

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { queryKeys } from '@fmby/v2-shared/query';

const HOST_SRC = new URL('../src/', import.meta.url).pathname;

/** tanstack 的前缀匹配语义：失效键是查询键的前缀即命中。 */
function invalidateReaches(invalidateKey: readonly unknown[], queryKey: readonly unknown[]): boolean {
  return invalidateKey.every((seg, i) => queryKey[i] === seg);
}

test('F-27：迁移后工厂键与原内联字面量逐段相同（缓存行为不变）', () => {
  // 这 9 组即 F-27 逐处记录的原始内联字面量。键值必须完全一致——
  // 改一个字符串就会让用户已缓存的查询失联（表现为多余的一次网络往返）。
  assert.deepEqual(queryKeys.install.status(), ['install', 'status']);
  assert.deepEqual(queryKeys.auth.mfa(), ['auth', 'mfa']);
  assert.deepEqual(queryKeys.auth.mfaStatus(), ['auth', 'mfa', 'status']);
  assert.deepEqual(queryKeys.identity.loginProviders(), ['identity', 'login-providers']);
  assert.deepEqual(queryKeys.identity.callback('google', 'ch-1', 'cd'), [
    'identity', 'callback', 'google', 'ch-1', 'cd',
  ]);
  assert.deepEqual(queryKeys.identity.telegramLoginStatus('ch-1'), [
    'identity', 'telegram-login-status', 'ch-1',
  ]);
  assert.deepEqual(queryKeys.manage.mounts.librariesForBinding(), [
    'manage', 'libraries', 'for-binding',
  ]);
  // 'mount' 单数是**存量事实**：原字面量就是单数，迁移必须原样保留。
  assert.deepEqual(queryKeys.manage.mounts.libraries('m-1'), [
    'manage', 'mount', 'm-1', 'libraries',
  ]);
});

test('F-27：MfaTotpSection 的失效前缀确实打到 mfaStatus', () => {
  // invalidate(['auth','mfa']) 必须前缀命中 status(['auth','mfa','status'])，
  // 否则「MFA 改动后状态不刷新」——正是本卡关心的失效可达性。
  assert.equal(
    invalidateReaches(queryKeys.auth.mfa(), queryKeys.auth.mfaStatus()),
    true,
    'auth.mfa() 失效前缀必须可达 auth.mfaStatus()',
  );
});

test('F-27：挂载绑定列表 self-invalidate 仍命中（跨键失效本就不成立）', () => {
  // 诚实记录既有语义：libraries() 与 detail() 是两把独立键，谁也打不到谁。
  // 本 PR 不擅自改语义，但把它写成断言，防止有人误以为已「打通」。
  assert.equal(
    invalidateReaches(queryKeys.manage.mounts.libraries('m-1'), queryKeys.manage.mounts.libraries('m-1')),
    true,
    '同一把键 self-invalidate 必须命中',
  );
  assert.equal(
    invalidateReaches(queryKeys.manage.mounts.detail('m-1'), queryKeys.manage.mounts.libraries('m-1')),
    false,
    'detail 不应跨键打到 libraries（存量语义，本次不改）',
  );
});

/** 递归收集 host/src 下的 .ts/.tsx。 */
function collectSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectSources(full));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

test('F-27：host/src 内已无内联 queryKey 字面量（防回流）', () => {
  const offenders: string[] = [];
  for (const file of collectSources(HOST_SRC)) {
    if (file.includes('/api/')) continue; // 例外：host/src/api 直接透传
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (/queryKey\s*:\s*\[[^\]]/.test(line)) {
          offenders.push(`${file.slice(HOST_SRC.length)}:${i + 1} ${line.trim()}`);
        }
      });
  }
  assert.deepEqual(
    offenders,
    [],
    `host/src 出现内联 queryKey，应改用 queryKeys.* 工厂：\n${offenders.join('\n')}`,
  );
});