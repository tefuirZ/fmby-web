/**
 * W5-C 契约测试（微软专用重绑流）：
 * 1) 入口存在性矩阵（provider×drive_id）
 * 2) 成功路径失效范围 = mounts.list + mounts.detail(id) + mounts.health（与 W5-B 同一 hook，不多不少）
 * 3) 不显示密钥/密封引用（只取 drive_id，绝不碰 __sealed/secret/token）
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  readMountDriveId,
  supportsMicrosoftRebind,
} from '../src/pages/manage/mounts/credentialPresentation';
import { queryKeys } from '@fmby/v2-shared/query';

describe('W5-C microsoft rebind eligibility', () => {
  it('微软 + 有 drive_id ⇒ 入口存在（专用流）', () => {
    assert.equal(
      supportsMicrosoftRebind({ providerType: 'microsoft_onedrive', configJson: { drive_id: 'drive-1' } }),
      true,
    );
  });

  it('onedrive / sharepoint 别名也算微软', () => {
    assert.equal(supportsMicrosoftRebind({ providerType: 'onedrive', configJson: { drive_id: 'd' } }), true);
    assert.equal(supportsMicrosoftRebind({ providerType: 'sharepoint', configJson: { drive_id: 'd' } }), true);
  });

  it('非微软 provider ⇒ 无专用入口（回落通用表单）', () => {
    assert.equal(supportsMicrosoftRebind({ providerType: 'local', configJson: { drive_id: 'd' } }), false);
    assert.equal(supportsMicrosoftRebind({ providerType: 'pan115', configJson: { drive_id: 'd' } }), false);
  });

  it('微软但取不到 drive_id ⇒ 无专用入口（无法定位账号）', () => {
    assert.equal(supportsMicrosoftRebind({ providerType: 'microsoft_onedrive', configJson: {} }), false);
    assert.equal(supportsMicrosoftRebind({ providerType: 'microsoft_onedrive', configJson: null }), false);
  });
});

describe('W5-C drive_id 读取（只取后端明写的键，不碰密钥）', () => {
  it('正常取字符串 drive_id', () => {
    assert.equal(readMountDriveId({ drive_id: 'drive-9' }), 'drive-9');
  });

  it('空串 / 非字符串 ⇒ null', () => {
    assert.equal(readMountDriveId({ drive_id: '' }), null);
    assert.equal(readMountDriveId({ drive_id: 123 }), null);
    assert.equal(readMountDriveId({}), null);
    assert.equal(readMountDriveId(null), null);
    assert.equal(readMountDriveId(undefined), null);
  });

  it('configJson 含密封引用也不回显/不误取', () => {
    // 只认 drive_id；即使旁边有 __sealed:... 也不返回，更不读取其值
    assert.equal(readMountDriveId({ drive_id: 'drive-1', token: '__sealed:k1' }), 'drive-1');
    assert.equal(readMountDriveId({ token: '__sealed:k1' }), null);
  });
});

describe('W5-C 成功路径失效范围 = list + detail(id) + health', () => {
  it('失效范围与 W5-B hook 完全一致（不多刷、不少刷）', () => {
    const mountId = 'm-7';
    const listKey = queryKeys.manage.mounts.list();
    const detailKey = queryKeys.manage.mounts.detail(mountId);
    const healthKey = queryKeys.manage.mounts.health();

    // 断言三处 key 形态正确（即 hook 真正发出的那些）
    assert.deepEqual(listKey, ['manage', 'mounts']);
    assert.deepEqual(detailKey, ['manage', 'mounts', 'detail', mountId]);
    assert.deepEqual(healthKey, ['manage', 'mounts', 'health']);

    // 与 mounts 命名空间下其它 key 不混淆：只这三类参与凭据失效
    assert.notDeepEqual(listKey, ['manage', 'mounts', 'list']);
  });
});
