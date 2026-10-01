/**
 * FE-USABILITY-FIX-1 · 字幕 serve URL 解析单测（TDD：先 RED 后 GREEN）。
 *
 * 真源：V2 `crates/fmby-v2-bridges/src/bridges/playback/session_service.rs:401-419`
 * 把 `subtitle_tracks[].id` 装配为**完整 serve 路径**
 * `/api/assets/media-items/{item_id}/subtitles/{override_id}`；
 * V2 路由表**没有** V1 形态 `/api/assets/subtitles/{id}`
 * （命中 blob 路由 ⇒ 400，产物↔后端寻址不一致的根因）。
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveSubtitleUrl } from '../src/pages/browse/subtitleUrl.ts';

test('id 已是完整路径 ⇒ 原样使用（后端约定的主路径）', () => {
  assert.equal(
    resolveSubtitleUrl('/api/assets/media-items/42/subtitles/7', '42'),
    '/api/assets/media-items/42/subtitles/7',
  );
});

test('裸 override id ⇒ 按 V2 成形（不再拼 V1 /api/assets/subtitles/…）', () => {
  const url = resolveSubtitleUrl('7', '42');
  assert.equal(url, '/api/assets/media-items/42/subtitles/7');
  assert.ok(!url?.includes('/assets/subtitles/'), '不得回落到 V1 寻址');
});

test('既非路径也非数字 id ⇒ 不发出请求（宁缺勿 4xx）', () => {
  assert.equal(resolveSubtitleUrl('sub-7.vtt', '42'), undefined);
});

test('无字幕轨 ⇒ undefined', () => {
  assert.equal(resolveSubtitleUrl(undefined, '42'), undefined);
});
