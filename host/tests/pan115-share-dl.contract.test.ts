/**
 * FE-PARITY-PAN115-SHARE-DL wire 对拍（分享下载预览预览段）。
 *
 * 真源：crates/fmby-v2-http/src/routes/pan115_share_download.rs:224/228/232
 *      crates/fmby-v2-http/src/state/pan115_share_download.rs
 * 能力门 MANAGE_MOUNT；文件内 require_confirmed 出现 **0 次** → 不带 confirmed=true。
 * wire：请求与响应**均 snake_case**；qr-status 的 query 例外——后端按 V1 wire
 *       取 camelCase `sessionId`（同时接受 snake_case 别名）。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pan115Api } from '@fmby/v2-shared/contracts/manage/pan115';

const captured: { method?: string; url?: string; body?: unknown } = {};
let nextResponse = { status: 200, json: {} as unknown };

(globalThis as unknown as { window: unknown }).window = {
  location: { origin: 'http://localhost:5173' },
};
(globalThis as unknown as { fetch: unknown }).fetch = async (
  url: string,
  init?: { method?: string; body?: string },
) => {
  captured.method = init?.method ?? 'GET';
  captured.url = url.replace('http://localhost:5173', '');
  captured.body = init?.body ? JSON.parse(init.body) : undefined;
  const body = nextResponse.status === 204 ? null : JSON.stringify(nextResponse.json);
  return new Response(body, {
    status: nextResponse.status,
    headers: { 'content-type': 'application/json' },
  });
};

function setResponse(json: unknown, status = 200) {
  nextResponse = { status, json };
}

test('① POST share-download-preview/qr-login — body snake_case，响应映射 camelCase', async () => {
  setResponse({
    session_id: 'sess-1',
    uid: 'uid-1',
    qr_url: 'https://qr.example/abc',
    qr_image: 'data:image/png;base64,AAAA',
  });
  const r = await pan115Api.previewQrLogin();
  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, '/api/manage/pan115/share-download-preview/qr-login');
  // ★JSON.stringify 会丢弃 undefined 值键 → 线上实际 body 为空对象（不传 app_id）
  assert.deepEqual(captured.body, {});
  assert.equal(r.sessionId, 'sess-1');
  assert.equal(r.uid, 'uid-1');
  assert.equal(r.qrUrl, 'https://qr.example/abc');
  assert.equal(r.qrImage, 'data:image/png;base64,AAAA');
});

test('①b qr-login 带 appId → app_id 上抛', async () => {
  setResponse({ session_id: 's', uid: 'u', qr_url: 'q', qr_image: null });
  await pan115Api.previewQrLogin({ appId: 'app-1' });
  assert.deepEqual(captured.body, { app_id: 'app-1' });
});

test('①c qr_image 为 null（取图失败）必须如实透传 null，不伪造占位图', async () => {
  setResponse({ session_id: 's', uid: 'u', qr_url: 'q', qr_image: null });
  const r = await pan115Api.previewQrLogin();
  assert.equal(r.qrImage, null);
});

test('② GET qr-status — query 用 camelCase sessionId（后端 V1 wire）', async () => {
  setResponse({ status: 'pending' });
  const r = await pan115Api.previewQrStatus('sess-1');
  assert.equal(captured.method, 'GET');
  assert.equal(
    captured.url,
    '/api/manage/pan115/share-download-preview/qr-status?sessionId=sess-1',
  );
  assert.equal(r.status, 'pending');
});

test('②b 状态词原样透传（confirmed / expired / scanned 不本地改词）', async () => {
  for (const s of ['scanned', 'confirmed', 'expired']) {
    setResponse({ status: s });
    const r = await pan115Api.previewQrStatus('x');
    assert.equal(r.status, s);
  }
});

test('③ POST create — 三种模式入参均 snake_case', async () => {
  setResponse({ preview_id: 'pv-9' });
  const r = await pan115Api.previewCreate({
    sessionId: 'sess-1',
    cookieHeader: 'Cookie: a=b',
    sourceMountId: 'mt-1',
  });
  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, '/api/manage/pan115/share-download-preview/create');
  assert.deepEqual(captured.body, {
    session_id: 'sess-1',
    cookie_header: 'Cookie: a=b',
    source_mount_id: 'mt-1',
  });
  assert.equal(r.previewId, 'pv-9');
});

test('④ URL 均不带 confirmed（后端本文件 require_confirmed=0）', async () => {
  setResponse({ session_id: 's', uid: 'u', qr_url: 'q', qr_image: null });
  await pan115Api.previewQrLogin();
  assert.equal(captured.url.includes('confirmed'), false);
  setResponse({ preview_id: 'p' });
  await pan115Api.previewCreate({ sessionId: 's' });
  assert.equal(captured.url.includes('confirmed'), false);
});

test('⑤ fail-closed：403 缺 MANAGE_MOUNT 必须抛出，不吞成空结果', async () => {
  setResponse({ code: 'forbidden', message: 'missing capability manage:mount' }, 403);
  await assert.rejects(() => pan115Api.previewQrLogin());
  await assert.rejects(() => pan115Api.previewCreate({ sessionId: 's' }));
});

test('⑥ fail-closed：503 端口未装配必须抛出（不假装扫码成功）', async () => {
  setResponse({ code: 'service_unavailable', message: 'pan115 provider port not assembled' }, 503);
  await assert.rejects(() => pan115Api.previewQrLogin());
});

test('⑦ qr-status 缺 sessionId → 后端校验失败，前端不得自行补默认会话', async () => {
  setResponse({ code: 'invalid_argument', message: '缺少 sessionId' }, 400);
  await assert.rejects(() => pan115Api.previewQrStatus(''));
});
