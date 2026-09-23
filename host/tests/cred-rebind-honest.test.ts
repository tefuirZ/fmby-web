/**
 * W5-E 卡 2 契约测试（NIGHT-FE-CRED-REBIND-HONEST）。
 *
 * 断言（不渲染组件，纯函数 providerRebindSupport + 既有 supportsMicrosoftRebind）：
 * ① 微软 expired ⇒ 真重绑入口（supportsMicrosoftRebind = true，providerRebindSupport = 'microsoft'）
 * ② 139/AList expired ⇒ 缺口提示（providerRebindSupport = 'unsupported-gap'）、伪造的重绑按钮不在
 *    （providerRebindSupport ≠ 'microsoft'，故抽屉不会渲染 MicrosoftRebindSection 的入口）
 * ③ not_required / bound / 未知 ⇒ 两者都不显示（'none'）
 * ④ 仍不显示密钥/密封引用（resolveCredentialBadge 四态输出不含 __sealed/secret/token）
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  providerRebindSupport,
  supportsMicrosoftRebind,
  resolveCredentialBadge,
  type ManageMountCredentialStatus,
} from '../src/pages/manage/mounts/credentialPresentation';

describe('W5-E 卡2 ① 微软 expired ⇒ 真重绑入口', () => {
  it('微软 + drive_id + expired ⇒ microsoft 专用流在', () => {
    assert.equal(
      supportsMicrosoftRebind({ providerType: 'microsoft_onedrive', configJson: { drive_id: 'd1' } }),
      true,
    );
    assert.equal(
      providerRebindSupport({
        providerType: 'microsoft_onedrive',
        credentialStatus: 'expired',
        configJson: { drive_id: 'd1' },
      }),
      'microsoft',
    );
  });
});

describe('W5-E 卡2 ② 139/AList expired ⇒ 缺口提示在，伪造按钮不在', () => {
  it('139 expired ⇒ unsupported-gap（不渲染真重绑入口）', () => {
    const r = providerRebindSupport({
      providerType: 'yun139',
      credentialStatus: 'expired',
      configJson: {},
    });
    assert.equal(r, 'unsupported-gap');
    // 伪造的「真重绑入口」必须不在：微软专用流判定为 false
    assert.equal(
      supportsMicrosoftRebind({ providerType: 'yun139', configJson: {} }),
      false,
    );
  });

  it('AList expired ⇒ unsupported-gap（不渲染真重绑入口）', () => {
    const r = providerRebindSupport({
      providerType: 'alist',
      credentialStatus: 'expired',
      configJson: {},
    });
    assert.equal(r, 'unsupported-gap');
    assert.equal(supportsMicrosoftRebind({ providerType: 'alist', configJson: {} }), false);
  });

  it('openlist 别名也算缺口', () => {
    assert.equal(
      providerRebindSupport({ providerType: 'openlist', credentialStatus: 'unbound', configJson: {} }),
      'unsupported-gap',
    );
  });

  it('139 但非 expired/unbound（后端恒 bound）⇒ 不渲染重绑 UI（none）', () => {
    assert.equal(
      providerRebindSupport({ providerType: 'yun139', credentialStatus: 'bound', configJson: {} }),
      'none',
    );
  });
});

describe('W5-E 卡2 ③ not_required / bound / 未知 ⇒ 两者都不显示', () => {
  for (const status of ['not_required', 'bound', null, undefined, 'weird-future'] as const) {
    it(`status=${String(status)} 非微软 provider ⇒ none`, () => {
      for (const provider of ['yun139', 'alist', 'local', 'pan115']) {
        assert.equal(
          providerRebindSupport({
            providerType: provider,
            credentialStatus: status as ManageMountCredentialStatus | null | undefined,
            configJson: {},
          }),
          'none',
          `${provider}/${String(status)}`,
        );
      }
    });
    it(`status=${String(status)} 微软(drive_id) ⇒ microsoft（专用流始终可用，与 W5-C 入口不变一致）`, () => {
      assert.equal(
        providerRebindSupport({
          providerType: 'microsoft_onedrive',
          credentialStatus: status as ManageMountCredentialStatus | null | undefined,
          configJson: { drive_id: 'd' },
        }),
        'microsoft',
      );
    });
  }
});

describe('W5-E 卡2 ④ 仍不显示密钥/密封引用', () => {
  it('四态徽标文案不含 __sealed / secret / token', () => {
    for (const status of ['bound', 'unbound', 'expired', 'not_required'] as const) {
      const badge = resolveCredentialBadge(status, null);
      const text = `${badge.label}|${badge.hint ?? ''}|${badge.actionLabel ?? ''}`;
      assert.ok(!/__sealed|secret|token/i.test(text), `status=${status} 泄漏密钥: ${text}`);
    }
  });
});
