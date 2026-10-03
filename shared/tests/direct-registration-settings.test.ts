import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { httpClient } from '@fmby/v2-shared/api/client';
import { manageApi } from '@fmby/v2-shared/contracts/manage';

/**
 * FE-REGISTRATION-WINDOW-UI：直接注册窗口设置的契约对拍（RED→GREEN）。
 *
 * 后端真源（origin/main，已核实）：
 *   GET /api/manage/users/direct-registration/settings
 *   PUT /api/manage/users/direct-registration/settings（全量替换，回落库后真值）
 *   `crates/fmby-v2-http/src/routes/manage_registration_window.rs`
 *   DTO `DirectRegistrationSettingsDto` @ `crates/fmby-v2-contracts/src/dto_registration.rs:17`
 *
 * ★三个易错点（本测试钉死）：
 *   1. 时间单位是 **epoch 毫秒**（`availability_of(cfg, now_ms)` 比较 now_ms<start_at / now_ms>end_at）
 *      ⇒ UI 用 datetime-local（秒级字符串）必须显式 ×1000 / ÷1000 换算，**不可猜**。
 *   2. DTO 是 `#[serde(default, deny_unknown_fields)]` ⇒ 前端**只能发这 5 个字段**，
 *      多一个即 400。
 *   3. 未持久化 ⇒ `unset_default()` = 全 false/None（**关闭**，与注册侧「未配置=关闭」同语义）。
 */

const ISO = '2026-10-05T12:00'; // datetime-local 值（本地、秒级精度）
const MS = Date.parse('2026-10-05T12:00'); // 同一时刻的 epoch 毫秒

test('DTO 字段面：恰好 5 个，且未配置缺省 = 关闭（enabled=false）', () => {
  const unset = manageApi.unsetDirectRegistrationSettings();
  assert.deepEqual(
    Object.keys(unset).sort(),
    ['defaultRoleTemplate', 'enabled', 'endAt', 'maxUsers', 'startAt'].sort(),
    '不得多/少字段（后端 deny_unknown_fields）',
  );
  assert.equal(unset.enabled, false, '未持久化 ⇒ 关闭');
  assert.equal(unset.startAt, null);
  assert.equal(unset.endAt, null);
  assert.equal(unset.maxUsers, null);
  assert.equal(unset.defaultRoleTemplate, null);
});

test('GET：走 /api/manage/users/direct-registration/settings，snake→camel 对拍', async () => {
  const calls: string[] = [];
  const get = mock.method(
    httpClient,
    'get',
    async (path: string) => {
      calls.push(path);
      return {
        enabled: true,
        start_at: MS,
        end_at: MS + 3_600_000,
        max_users: 50,
        default_role_template: 'viewer',
      };
    },
  );

  const settings = await manageApi.getDirectRegistrationSettings();

  assert.deepEqual(calls, ['/api/manage/users/direct-registration/settings']);
  assert.deepEqual(settings, {
    enabled: true,
    startAt: MS,
    endAt: MS + 3_600_000,
    maxUsers: 50,
    defaultRoleTemplate: 'viewer',
  });

  // 未持久化/缺省字段 ⇒ null，绝不臆造 0（后端 Option<i64>）
  get.mock.restore();
});

test('换算：datetime-local 字符串 ⇄ epoch 毫秒（双向，不丢精度到秒）', () => {
  assert.equal(manageApi.toDateTimeLocal(MS), '2026-10-05T12:00');
  assert.equal(manageApi.fromDateTimeLocal('2026-10-05T12:00'), MS);
  // 空值不臆造 0：清空 = null（后端 Option<i64>）
  assert.equal(manageApi.fromDateTimeLocal(''), null);
  assert.equal(manageApi.toDateTimeLocal(null), '');
});

test('PUT：全量替换，wire 只发 5 个 snake_case 字段（多传即 400）', async () => {
  // ★不 mock 自己的方法（那只会录到 camelCase 入参）；要 mock httpClient.put，
  //   才能断言真正上线的 wire body（后端 deny_unknown_fields ⇒ 多一个字段即 400）。
  const calls: Array<{ path: string; body: unknown }> = [];
  const put = mock.method(
    httpClient,
    'put',
    async (path: string, cfg?: { body?: unknown }) => {
      calls.push({ path, body: cfg?.body });
      return {
        enabled: true,
        start_at: MS,
        end_at: MS + 3_600_000,
        max_users: 50,
        default_role_template: 'viewer',
      };
    },
  );

  const saved = await manageApi.putDirectRegistrationSettings({
    enabled: true,
    startAt: MS,
    endAt: MS + 3_600_000,
    maxUsers: 50,
    defaultRoleTemplate: 'viewer',
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/api/manage/users/direct-registration/settings');
  assert.deepEqual(
    calls[0].body,
    {
      enabled: true,
      start_at: MS,
      end_at: MS + 3_600_000,
      max_users: 50,
      default_role_template: 'viewer',
    },
    'PUT wire 必须恰好这 5 个 snake_case 字段',
  );
  // 回落库后真值（PUT 是 replace，前端以响应为准）
  assert.deepEqual(saved, {
    enabled: true,
    startAt: MS,
    endAt: MS + 3_600_000,
    maxUsers: 50,
    defaultRoleTemplate: 'viewer',
  });
  put.mock.restore();
});
