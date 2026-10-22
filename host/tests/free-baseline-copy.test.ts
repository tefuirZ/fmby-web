// 免费基线能力被拒时的**文案真实性**契约（FREE-BASELINE-COPY）。
//
// 背景（今天实测）：未激活实例上，用户承诺免费的 12 项能力里有 4 项被门拦死
// （#1638 真机 403）。后端 403 文案是
//   `当前授权不包含能力 feature.compat.emby（请购买/升级授权）`
// 而 `feature.compat.emby` 是**承诺免费**的 ⇒ 用户被告知"要买" = 撒谎。
//
// 本卡只改前端表现：把「免费能力被拒」的文案改写成如实说明；付费能力保持引导购买。
//
// 跑法：node --import ./tests/register-aliases.mjs --test tests/free-baseline-copy.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FREE_BASELINE_FEATURES,
  extractFeatureKeyFromMessage,
  freeBaselineDeniedMessage,
  isFreeBaselineFeature,
} from '@fmby/v2-shared/contracts/manage/license/freeBaseline';

test('免费基线清单 = 用户裁定的 12 项（与后端 domain 同源）', () => {
  assert.equal(FREE_BASELINE_FEATURES.length, 12, '免费能力必须是 12 项');
  // 抽查四类：存储 / 兼容 / 上游 / 元数据
  for (const key of [
    'feature.storage.pan115.provider',
    'feature.compat.emby',
    'feature.upstream.apple_cms',
    'feature.metadata.advanced_scrape',
  ]) {
    assert.ok(isFreeBaselineFeature(key), `${key} 必须被判为免费`);
  }
  // 付费键不得误判为免费（放开=送钱）
  for (const paid of [
    'feature.storage.pan115.imghost',
    'feature.users.registration_codes',
    'feature.users.expiration',
  ]) {
    assert.ok(!isFreeBaselineFeature(paid), `${paid} 不属免费基线`);
  }
});

test('能从后端原文里抽到能力键（后端文案形如「…不包含能力 feature.x（请购买…）」）', () => {
  assert.equal(
    extractFeatureKeyFromMessage('当前授权不包含能力 feature.compat.emby（请购买/升级授权）'),
    'feature.compat.emby',
  );
  assert.equal(extractFeatureKeyFromMessage('没有键的文案'), null, '抽不到就该返回 null，不许猜');
});

test('免费能力的拒绝文案**不得**出现「购买/升级」字样', () => {
  const msg = freeBaselineDeniedMessage('feature.compat.emby');
  for (const banned of ['购买', '升级', '授权不足', '请付费']) {
    assert.ok(
      !msg.includes(banned),
      `免费能力被拒时不得说「${banned}」——用户会被误导以为要掏钱（实际：${msg}）`,
    );
  }
  assert.ok(msg.includes('feature.compat.emby'), '文案应带上能力键便于对账');
  assert.ok(msg.includes('免费'), '必须明确告知该能力属免费承诺');
});

test('改写判据：只对 license_feature_denied + 免费键生效（付费键原样）', async () => {
  // 这里直接测纯函数组合，不依赖 fetch：等价于 errorMapping 里的判定
  const shouldRewrite = (code: string, message: string): boolean => {
    if (code !== 'license_feature_denied') return false;
    const key = extractFeatureKeyFromMessage(message);
    return key !== null && isFreeBaselineFeature(key);
  };

  assert.equal(
    shouldRewrite('license_feature_denied', '当前授权不包含能力 feature.compat.emby（请购买/升级授权）'),
    true,
    '免费键 ⇒ 必须改写',
  );
  assert.equal(
    shouldRewrite(
      'license_feature_denied',
      '当前授权不包含能力 feature.storage.pan115.imghost（请购买/升级授权）',
    ),
    false,
    '付费键 ⇒ 保留原引导购买的文案',
  );
  assert.equal(
    shouldRewrite('forbidden', '无权限'),
    false,
    '非 license 拒绝 ⇒ 不动（避免误改普通 403）',
  );
});
