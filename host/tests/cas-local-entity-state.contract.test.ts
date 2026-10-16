// FE-CAS-G2：`has_local_entity` 三态（未知/无/有）回归契约（#658 · FIX-CAS-G1+G2）
//
// 跑法：cd host && node --import ./tests/register-aliases.mjs --test tests/cas-local-entity-state.contract.test.ts
//
// 钉的是什么（**行为级**，不做源码字符串断言 —— 那种断言对「把未知默认成无」恒绿）：
//   ① 后端 `has_local_entity` 在 #373 接线前**恒 false**（`cas_admin.rs` 字段注），
//      ⇒ 未接线期 `false` **必须**是「未知」，绝不得渲染成「无」；
//   ② 字段缺失/`null` 同样是未知（不折叠成布尔）；
//   ③ 只有显式 `wired=true`（后端真填充了 `media_item_id`）之后，`false` 才允许叫「无」；
//   ④ 未知的色调必须是 warning —— 与「无」的 neutral 区分开（色盲也读得出「信息缺失」）；
//   ⑤ 真值 true 一律「有」，与接线开关无关。
import test from 'node:test';
import assert from 'node:assert/strict';

const {
  LOCAL_ENTITY_FIELD_WIRED,
  resolveLocalEntityState,
  resolveLocalEntityLabel,
  resolveLocalEntityTone,
} = await import('../src/pages/manage/cas/formatCasDrive.ts');

test('① 未接线期 false ⇒ 未知（绝不默认成「无」）', () => {
  assert.equal(LOCAL_ENTITY_FIELD_WIRED, false, '后端 #373 未接线 ⇒ 开关必须仍是 false');
  for (const wired of [false, undefined]) {
    assert.equal(
      resolveLocalEntityState(false, wired),
      'unknown',
      `wired=${wired} 时 false 必须是未知，不是「无」`,
    );
  }
  // 默认参数（页面就是这么调的）也必须落到未知
  assert.equal(resolveLocalEntityState(false), 'unknown', '缺省 wired ⇒ 未知');
});

test('② 字段缺失/null ⇒ 未知（不折叠成布尔）', () => {
  for (const missing of [null, undefined]) {
    assert.equal(resolveLocalEntityState(missing, true), 'unknown', '接线后缺字段仍是未知');
    assert.equal(resolveLocalEntityLabel(resolveLocalEntityState(missing)), '未知（后端未接线）');
  }
});

test('③ 接线后（wired=true）才允许把 false 判成「无」', () => {
  assert.equal(resolveLocalEntityState(false, true), 'none', '接线后 false = 真值「无本地实体」');
  assert.equal(resolveLocalEntityLabel('none'), '无');
});

test('④ 三态文案与色调互不混淆（未知≠无，且未知醒目）', () => {
  assert.equal(resolveLocalEntityLabel('unknown'), '未知（后端未接线）');
  assert.equal(resolveLocalEntityLabel('none'), '无');
  assert.equal(resolveLocalEntityLabel('present'), '有');
  assert.equal(resolveLocalEntityTone('unknown'), 'warning', '未知必须与「无」不同色');
  assert.equal(resolveLocalEntityTone('none'), 'neutral');
  assert.equal(resolveLocalEntityTone('present'), 'success');
});

test('⑤ 真值 true 恒「有」，与接线开关无关', () => {
  for (const wired of [false, true]) {
    assert.equal(resolveLocalEntityState(true, wired), 'present');
  }
});
