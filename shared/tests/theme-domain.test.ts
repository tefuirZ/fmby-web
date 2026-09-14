// WEB-C1 ①：PageDomain 粗粒度定版与路由判定单源锁定。
// 跑法（对齐 shared tests 形态）：node --import ./tests/register-aliases.mjs --test tests/theme-domain.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PAGE_DOMAINS,
  PAGE_DOMAIN_ROUTES,
  resolvePageDomain,
} from '../src/theme/index';

test('page domains are the WEB-C1 coarse seven', () => {
  assert.deepEqual([...PAGE_DOMAINS], [
    'browse.home',
    'browse.library',
    'browse.item',
    'browse.play',
    'manage',
    'settings',
    'observability',
  ]);
});

test('route resolution maps concrete prefixes before the root fallback', () => {
  assert.equal(resolvePageDomain('/'), 'browse.home');
  assert.equal(resolvePageDomain('/history'), 'browse.home');
  assert.equal(resolvePageDomain('/libraries'), 'browse.home');
  assert.equal(resolvePageDomain('/libraries/42'), 'browse.library');
  assert.equal(resolvePageDomain('/item/9'), 'browse.item');
  assert.equal(resolvePageDomain('/play/9'), 'browse.play');
  assert.equal(resolvePageDomain('/manage'), 'manage');
  assert.equal(resolvePageDomain('/manage/media/mounts'), 'manage');
  assert.equal(resolvePageDomain('/settings'), 'settings');
  assert.equal(resolvePageDomain('/settings/appearance'), 'settings');
  assert.equal(resolvePageDomain('/observability'), 'observability');
});

test('non-domain routes fall back to null (login/install)', () => {
  assert.equal(resolvePageDomain('/login'), null);
  assert.equal(resolvePageDomain('/install'), null);
});

test('root forms are exact-only so non-domain routes fall through', () => {
  const rootRule = PAGE_DOMAIN_ROUTES.find((rule) => rule.prefix === '/');
  assert.ok(rootRule, 'root rule present');
  assert.equal(rootRule.exact, true, 'root rule is exact-only');
  assert.equal(rootRule.domain, 'browse.home');
});
