// FE-LICENSE-REMAINING：字段级付费门接线对拍（RED → GREEN）。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// V1 4 处 canUsePaidFeature 字段级门 → V2 对位（本卡逐项证伪后落地）：
//   ① upstream-emby  → users 页「从 Emby 导入」入口 + 契约（后端
//     /manage/users/emby-import* 3 端点已挂，前端此前 0 消费）
//   ② user-expiration → users 表单 validUntil 字段已存在（接线 characterization）
//   ③ registration-window / ④ identity-* → license visibility 契约字段已在，
//     V2 identity 另立 auth-providers 页（不适用 site-settings tab 语义）
//
// 门语义照 V1：isPaidFeatureEnabled(status, feature) = visibility[surface]。

import test from 'node:test';
import assert from 'node:assert/strict';

(globalThis as { window?: unknown }).window = { location: { origin: 'http://localhost:5173' } };

let nextResponse: { status: number; json: unknown } = { status: 200, json: {} };
let lastUrl = '';

(globalThis as { fetch?: unknown }).fetch = async (input: unknown) => {
  lastUrl = typeof input === 'string' ? input : String(input);
  const { status, json } = nextResponse;
  return new Response(JSON.stringify(json), {
    status,
    headers: { 'content-type': 'application/json' },
  });
};

const { isPaidFeatureEnabled, canUsePaidFeature } = await import(
  '@fmby/v2-shared/../../host/src/pages/manage/license/licenseAccess'
);

const VIS = (overrides: Record<string, boolean> = {}) => ({
  pan115Provider: false,
  pan115Share: false,
  pan115Imghost: false,
  microsoftProvider: false,
  microsoftAccountPool: false,
  upstreamEmby: false,
  upstreamAppleCms: false,
  registrationCodes: false,
  registrationWindow: false,
  userExpiration: false,
  identityTelegram: false,
  identityGoogle: false,
  posterImghost: false,
  internalImghost: false,
  ...overrides,
});

const STATUS = (visibility: Record<string, boolean>) => ({
  plan: 'pro',
  summary: { visibility },
});

test('① upstream-emby：visibility.upstreamEmby=true 才放行', () => {
  assert.equal(canUsePaidFeature(VIS(), 'upstream-emby'), false);
  assert.equal(canUsePaidFeature(VIS({ upstreamEmby: true }), 'upstream-emby'), true);
  assert.equal(isPaidFeatureEnabled(STATUS(VIS({ upstreamEmby: true })) as never, 'upstream-emby'), true);
});

test('② user-expiration：visibility.userExpiration 门（表单字段已存在， characterization）', () => {
  assert.equal(canUsePaidFeature(VIS(), 'user-expiration'), false);
  assert.equal(canUsePaidFeature(VIS({ userExpiration: true }), 'user-expiration'), true);
});

test('③ registration-window：visibility.registrationWindow 门', () => {
  assert.equal(canUsePaidFeature(VIS({ registrationWindow: true }), 'registration-window'), true);
});

test('④ identity-google/telegram：门可判定（V2 另立 auth-providers 页）', () => {
  assert.equal(canUsePaidFeature(VIS({ identityGoogle: true }), 'identity-google'), true);
  assert.equal(canUsePaidFeature(VIS({ identityTelegram: true }), 'identity-telegram'), true);
});

test('Emby 导入契约：preview 端点 wire（用户面 0 消费 → 本卡补）', async () => {
  const { manageApi } = await import('@fmby/v2-shared/contracts/manage');
  nextResponse = {
    status: 200,
    json: {
      users: [],
      summary: {
        total_count: 0,
        selected_count: 0,
        created_count: 0,
        updated_count: 0,
        skipped_count: 0,
        failed_count: 0,
      },
    },
  };
  if (typeof (manageApi as Record<string, unknown>).previewEmbyUserImport !== 'function') {
    assert.fail('manageApi.previewEmbyUserImport 未实现（RED 特征）');
  }
  await (manageApi as {
    previewEmbyUserImport: (p: Record<string, unknown>) => Promise<unknown>;
  }).previewEmbyUserImport({ upstreamId: 'up-1' });
  assert.ok(lastUrl.includes('/manage/users/emby-import/preview'), `wire 不符: ${lastUrl}`);
});


test('users 页 Emby 导入门决策：isPaidFeatureEnabled 驱动入口渲染条件', async () => {
  // V1 ManageUsersPage:205 语义 = canUseUpstreamEmby 决定入口渲染；
  // V2 落法 = isPaidFeatureEnabled(licenseStatus, 'upstream-emby')（组件接线经 code review 把关）。
  const vis = VIS({ upstreamEmby: true });
  assert.equal(isPaidFeatureEnabled(STATUS(vis) as never, ['upstream-emby']), true);
  assert.equal(isPaidFeatureEnabled(STATUS(VIS()) as never, ['upstream-emby']), false);
});
