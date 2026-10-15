/**
 * FE-LICENSE-GATED-MODULES：未激活实例付费模块不显示裸 403 —— 契约测试。
 *
 * 后端权威（license_gate_requirement，未激活 ⇒ 必然 403，版权门 fail-closed，禁放宽）：
 *  Feature 门：/manage/microsoft/auth/ · /manage/pan115/imghost · /manage/pan115/share-mounts/
 *    + share-download-preview · /manage/pan115/（除 sync/）· /manage/registration-codes
 *  Exempt（未激活仍 200，别动）：auth/install、/manage/license 全部、其余 /manage 页面、以及 /manage/pan115/sync（同步面）。
 *
 * 前端修法（复用既有可复用件 ManagePaidFeatureGuard + isPaidFeatureEnabled）：
 *  ① 读 GET /manage/license/status（business_access_allowed / summary.visibility）⇒ 未授权时
 *     付费模块不请求、不报错，改显「此功能需要授权」引导（可点去许可管理）。
 *  ② 403 若漏进来按「未授权」语义识别（不弹「你没有权限」让人以为账号坏）。
 *  ③ microsoft 优先（用户第一轮撞到），其余同类顺手覆盖；不动 Exempt。
 *
 * 本仓无 jsdom ⇒ 纯函数 + 源码级契约检查（照 installStatus / secrets-metadata 范式）。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isForbiddenError } from '@fmby/v2-shared/errors';

// ───────────────────────────────────────────────────────────────────────────
// 纯函数：isForbiddenError（② 的 403 判定）
// ───────────────────────────────────────────────────────────────────────────

test('① isForbiddenError — 403（forbidden/HTTP_403/status 403）判定', () => {
  assert.equal(isForbiddenError({ code: 'forbidden', message: 'x', retryable: false }), true);
  assert.equal(isForbiddenError({ code: 'HTTP_403', message: 'x', retryable: false }), true);
  assert.equal(
    isForbiddenError({ code: 'whatever', message: 'x', retryable: false, status: 403 }),
    true,
  );
});

test('①b isForbiddenError — 非 403（404/401/500/网络错）一律 false', () => {
  assert.equal(isForbiddenError({ code: 'HTTP_404', message: 'x', retryable: false, status: 404 }), false);
  assert.equal(isForbiddenError({ code: 'HTTP_500', message: 'x', retryable: true, status: 500 }), false);
  assert.equal(isForbiddenError(new Error('fetch failed')), false);
  assert.equal(isForbiddenError(null), false);
});

// ───────────────────────────────────────────────────────────────────────────
// 源码级契约
// ───────────────────────────────────────────────────────────────────────────

async function readSrc(rel: string): Promise<string> {
  const { readFile } = await import('node:fs/promises');
  return readFile(new URL(`../src/${rel}`, import.meta.url), 'utf8');
}

test('② microsoft 页用 ManagePaidFeatureGuard feature="microsoft"，queries 收进 Content（未授权不请求）', async () => {
  const src = await readSrc('pages/manage/microsoft/index.tsx');
  assert.match(src, /ManagePaidFeatureGuard/, 'microsoft 页必须用可复用付费守卫');
  assert.match(src, /feature="microsoft"/, '守卫 feature 必须是 microsoft（对齐 FEATURE_STORAGE_MICROSOFT_PROVIDER）');
  // 查询收进 *Content，外层 guard 未授权时不挂载 Content ⇒ 不发 /manage/microsoft/auth/* 请求
  assert.match(src, /ManageMicrosoftPageContent/, '须抽出 Content 承载 queries');
  assert.match(
    src,
    /ManagePaidFeatureGuard[\s\S]{0,200}<ManageMicrosoftPageContent/,
    'guard 必须包裹 Content（未授权时 Content 不挂载）',
  );
});

test('②b microsoft Content 错误分支：403 识别为「需要授权」语义（isForbiddenError，不弹账号坏）', async () => {
  const src = await readSrc('pages/manage/microsoft/index.tsx');
  assert.match(src, /isForbiddenError/, '错误分支须用 isForbiddenError 识别 403');
  assert.match(src, /授权/, '403 语义文案须提「授权」（非「你没有权限」）');
});

test('③ pan115-share：gated 三区块按 surface 守卫，SyncSection（Exempt）不守卫', async () => {
  const src = await readSrc('pages/manage/pan115-share/index.tsx');
  // share-download-preview ⇒ pan115-share
  assert.match(src, /feature="pan115-share"/, 'PreviewCredentialSection（share-download-preview）须守卫 pan115-share');
  // share-items / previews ⇒ pan115（/manage/pan115/ 除 sync）
  assert.match(src, /feature="pan115"/, 'ShareItem/PreviewBrowse（share-items/previews）须守卫 pan115');
  // SyncSection（/manage/pan115/sync/ Exempt）不得被 guard 包裹
  const syncIdx = src.indexOf('SyncSection');
  assert.ok(syncIdx !== -1, 'SyncSection 应在页面中（Exempt，未激活仍可用）');
  const before = src.slice(0, src.lastIndexOf('<SyncSection'));
  assert.equal(
    /<ManagePaidFeatureGuard[^>]*>\s*$/.test(before.trimEnd().slice(-60)),
    false,
    'SyncSection 前不得紧邻未闭合的 guard（Exempt 不门控）',
  );
});

test('④ 回归钉：registration-codes / pan115-imghost 保持 guarded（别回退成裸 403）', async () => {
  const rc = await readSrc('pages/manage/ManageRegistrationCodesPage.tsx');
  assert.match(rc, /feature="registration-codes"/, 'registration-codes 须保持 guarded');
  const ih = await readSrc('pages/manage/pan115-imghost/index.tsx');
  assert.match(ih, /feature="pan115-imghost"/, 'pan115-imghost 须保持 guarded');
});

test('⑤ 不误伤 Exempt：users 等免费页无 ManagePaidFeatureGuard', async () => {
  const users = await readSrc('pages/manage/ManageUsersPage.tsx');
  assert.equal(users.includes('ManagePaidFeatureGuard'), false, 'users 是 Exempt 免费页，不得误加付费守卫');
});
