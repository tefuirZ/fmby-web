// FE-CAS-G3（#658 内容列表首屏截断可见化）：截断判定 + 「不许撒谎」的措辞断言。
// 运行：node --import ./tests/register-aliases.mjs --test tests/cas-contents-truncation.test.ts
//
// 后端事实（`admin_cas.rs::cas_list_contents`）：返回**裸数组**（无 total/has_more）、
// `page_size` 默认 20 钳 1..=200、`page≠1` 直接 400（键集仓储禁 OFFSET）。
// ⇒ UI 只能说「已到首屏上限、无法翻页」；写「共 N 条 / 还有 M 条」就是编造不知道的数。

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveContentsTruncation } from '../src/pages/manage/cas/contentsTruncation';
import { CAS_CONTENTS_LIMIT } from '@fmby/v2-shared/contracts/manage/casAdmin';

const base = { unwired: false, loading: false, isError: false, limit: 20 };

test('① 数到上限 ⇒ 提示可见，且数字用真实 limit', () => {
  const { notice } = resolveContentsTruncation({ ...base, count: 20 });
  assert.ok(notice, 'count==limit 必须提示（G3 的病因就是这里零提示）');
  assert.ok(notice!.includes('20'), `须写出上限数字：${notice}`);
});

test('② 措辞诚实性：不得出现「共/全部/剩余/还有 N」这类编造总数的说法', () => {
  const { notice } = resolveContentsTruncation({ ...base, count: 20 }) as { notice: string };
  assert.doesNotMatch(notice, /共\s*\d+\s*条/, `不得编造总数：${notice}`);
  assert.doesNotMatch(notice, /已显示全部|全部加载|所有内容/, `不得暗示全量：${notice}`);
  assert.doesNotMatch(notice, /还有\s*\d+\s*条/, `剩余条数不可知，不得写：${notice}`);
  assert.match(notice, /不代表全量/, '必须正面声明「不代表全量」');
});

test('③ 未达上限 / 假空态 / 载入中 / 出错 ⇒ 一律不提示（提示在这些态是叠加误导）', () => {
  assert.equal(resolveContentsTruncation({ ...base, count: 19 }).notice, null, '未达上限不该提示');
  assert.equal(resolveContentsTruncation({ ...base, count: 0 }).notice, null);
  assert.equal(
    resolveContentsTruncation({ ...base, count: 20, unwired: true }).notice,
    null,
    '未装配是「服务没启用」，不是截断',
  );
  assert.equal(resolveContentsTruncation({ ...base, count: 20, loading: true }).notice, null);
  assert.equal(resolveContentsTruncation({ ...base, count: 20, isError: true }).notice, null);
  assert.equal(
    resolveContentsTruncation({ ...base, count: 0, limit: 0, unwired: true }).notice,
    null,
    '未装配时 limit=0 不得被当成「上限 0 条」',
  );
});

test('④ 前端必须显式发 page_size，且**绝不发 page**（后端 page≠1 返 400 ⇒ 发 page = 造假翻页）', () => {
  const src = readFileSync(
    new URL('../../shared/src/contracts/manage/casAdmin/api.ts', import.meta.url),
    'utf8',
  );
  const i = src.indexOf('async listCasContents');
  assert.ok(i >= 0, '找不到 listCasContents');
  const body = src.slice(i, src.indexOf('},', i));
  assert.match(body, /page_size:\s*CAS_CONTENTS_LIMIT/, '必须显式声明首屏条数（截断提示的依据）');
  assert.doesNotMatch(body, /params:\s*\{[^}]*\bpage\b\s*:/, '不得发 page（后端只放行首屏）');
  assert.equal(CAS_CONTENTS_LIMIT, 20, '与后端默认值同数（改了要两边一起改，别单侧漂）');
});
