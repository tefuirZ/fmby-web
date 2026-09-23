/**
 * FE-AI-INTERVENTIONS wire 对拍（TDD：先 RED 后 GREEN）。
 *
 * 后端真源（V2，实为 **7** 条路由；卡面「6 条」有误）：
 * - `crates/fmby-v2-http/src/routes/router_manage.rs:239-267` 注册
 * - handler `crates/fmby-v2-http/src/routes/ai_interventions.rs`：
 *   :71 threads（**裸数组**）/ :91 media/{id} 详情 / :111 session/open /
 *   :132 session/message（`session_id` 版）/ :151 session/close / :170 media/{id}/apply /
 *   :202 media/{id}/suggest（A2 只读）
 * - 能力闸统一 MANAGE_LIBRARY；端口未装配 → 500 fail-closed。
 *
 * AI-assist 设置（同端点**两向不同形**）：
 * - GET  → `AiAssistSettingsView` **snake_case**（`crates/fmby-v2-application/src/settings/ai_assist.rs:49`）
 * - PUT  → `UpdateAiAssistSettingsRequest` **camelCase 正名 + snake alias**（同文件 :123），
 *          但嵌套 `policy` 是 **snake_case**（`:88`）——混合 casing，须分别钉死。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { aiInterventionsApi } from '@fmby/v2-shared/contracts/manage/aiInterventions';
import { aiAssistApi } from '@fmby/v2-shared/contracts/settings/aiAssist.api';

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
  captured.url = String(url).replace('http://localhost:5173', '');
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

/** 后端 AiInterventionThread（snake_case，逐字段照 `fmby-v2-domain/src/ai_intervention.rs:80`）。 */
function threadRaw(patch: Record<string, unknown> = {}) {
  return {
    id: '11',
    media_item_id: '5',
    latest_run_id: 'r1',
    latest_auto_task_id: null,
    latest_summary_json: '{"summary":"ok"}',
    latest_evidence_json: '{}',
    latest_result_json: '{}',
    latest_diff_json: '{}',
    latest_skill_key: 'naming_cleanup',
    latest_provider: 'openai',
    latest_model: 'gpt-4o-mini',
    latest_run_status: 'succeeded',
    latest_applied_run_id: null,
    latest_applied_result_json: '{}',
    session_state: 'Open',
    current_session_id: 'sess-1',
    current_session_skill_key: 'naming_cleanup',
    session_opened_by_user_id: '1',
    session_opened_at: 1735689600000,
    session_last_activity_at: 1735689660000,
    archived_session_summary_json: '[]',
    created_at: 1735689600000,
    updated_at: 1735689660000,
    ...patch,
  };
}

test('① threads：GET 路径 + 裸数组（无包裹）+ camelCase 映射 + Pascal 枚举保留', async () => {
  setResponse([threadRaw()]);
  const list = await aiInterventionsApi.listThreads();
  assert.equal(captured.method, 'GET');
  assert.equal(captured.url, '/api/manage/ai-interventions/threads');
  assert.ok(Array.isArray(list), 'threads 必须返回裸数组');
  assert.equal(list[0].mediaItemId, '5');
  assert.equal(list[0].latestSkillKey, 'naming_cleanup'); // snake 值
  assert.equal(list[0].sessionState, 'Open'); // Pascal 值保留
  assert.equal(list[0].sessionOpenedAt, 1735689600000);
});

test('①b threads：limit/offset 作为查询参数', async () => {
  setResponse([]);
  await aiInterventionsApi.listThreads({ limit: 10, offset: 20 });
  assert.equal(captured.url, '/api/manage/ai-interventions/threads?limit=10&offset=20');
});

test('② 详情：GET media/{id} + {thread,messages,runs}', async () => {
  setResponse({
    thread: threadRaw(),
    messages: [
      {
        id: 'm1',
        thread_id: '11',
        media_item_id: '5',
        session_id: 'sess-1',
        role: 'Assistant',
        content_text: 'hi',
        archived_summary_text: null,
        evidence_snapshot_json: '{}',
        skill_result_ref_json: '{}',
        created_by_user_id: '1',
        archived_at: null,
        created_at: 1735689600000,
      },
    ],
    runs: [],
  });
  const detail = await aiInterventionsApi.getThread('5');
  assert.equal(captured.method, 'GET');
  assert.equal(captured.url, '/api/manage/ai-interventions/media/5');
  assert.equal(detail.thread.id, '11');
  assert.equal(detail.messages[0].role, 'Assistant'); // Pascal 值
  assert.equal(detail.messages[0].contentText, 'hi');
  assert.deepEqual(detail.runs, []);
});

test('③ session/open：POST media/{id}/session/open + body {preferred_skill_key}', async () => {
  setResponse(threadRaw());
  const thread = await aiInterventionsApi.openSession('5', 'naming_cleanup');
  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, '/api/manage/ai-interventions/media/5/session/open');
  assert.deepEqual(captured.body, { preferred_skill_key: 'naming_cleanup' });
  assert.equal(thread.id, '11');
});

test('③b session/open：无 preferredSkillKey 时 body 为空对象', async () => {
  setResponse(threadRaw());
  await aiInterventionsApi.openSession('5');
  assert.deepEqual(captured.body, {});
});

test('④ session/message：POST /session/message + body {session_id,message}（V2 session 版）', async () => {
  setResponse({
    id: 'm2',
    thread_id: '11',
    media_item_id: '5',
    session_id: 'sess-1',
    role: 'User',
    content_text: 'hello',
    archived_summary_text: null,
    evidence_snapshot_json: '{}',
    skill_result_ref_json: '{}',
    created_by_user_id: '1',
    archived_at: null,
    created_at: 1735689600000,
  });
  const msg = await aiInterventionsApi.sendMessage('sess-1', 'hello');
  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, '/api/manage/ai-interventions/session/message');
  assert.deepEqual(captured.body, { session_id: 'sess-1', message: 'hello' });
  assert.equal(msg.role, 'User');
});

test('⑤ session/close：POST /session/close + body {session_id}', async () => {
  setResponse(threadRaw({ session_state: 'Closed' }));
  const thread = await aiInterventionsApi.closeSession('sess-1');
  assert.equal(captured.url, '/api/manage/ai-interventions/session/close');
  assert.deepEqual(captured.body, { session_id: 'sess-1' });
  assert.equal(thread.sessionState, 'Closed');
});

test('⑥ apply：POST media/{id}/apply + body {session_id}', async () => {
  setResponse(threadRaw({ latest_applied_run_id: 'r1' }));
  const thread = await aiInterventionsApi.applyLatestResult('5', 'sess-1');
  assert.equal(captured.url, '/api/manage/ai-interventions/media/5/apply');
  assert.deepEqual(captured.body, { session_id: 'sess-1' });
  assert.equal(thread.latestAppliedRunId, 'r1');
});

test('⑦ suggest（A2）：POST media/{id}/suggest + camelCase 响应', async () => {
  setResponse({
    mediaItemId: '5',
    suggestedTitle: 'Dune',
    suggestedYear: 2021,
    suggestedSeason: null,
    suggestedEpisode: null,
    externalId: { provider: 'tmdb', kind: 'movie', value: '438631' },
    confidence: 0.87,
    reasoning: '匹配到标题与年份',
    wouldAutoBind: false,
  });
  const suggest = await aiInterventionsApi.suggestForMediaItem('5');
  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, '/api/manage/ai-interventions/media/5/suggest');
  assert.equal(suggest.mediaItemId, '5');
  assert.equal(suggest.suggestedTitle, 'Dune');
  assert.equal(suggest.confidence, 0.87);
  assert.equal(suggest.wouldAutoBind, false);
});

test('⑧ ai-assist GET：读体 snake_case → 域 camelCase', async () => {
  setResponse({
    provider: 'openai',
    enabled: true,
    configured: true,
    model: 'gpt-4o-mini',
    base_url: 'https://api.openai.com',
    timeout_seconds: 30,
    max_tokens: 2048,
    temperature: 0.2,
    enable_candidate_rerank: true,
    enable_confidence_explain: false,
    has_api_key: true,
    api_key_masked: '********',
    policy: {
      require_non_ai_evidence: true,
      max_ai_weight: 0.5,
      strong_evidence_threshold: 0.8,
      weak_evidence_threshold: 0.3,
    },
  });
  const s = await aiAssistApi.getSettings();
  assert.equal(captured.method, 'GET');
  assert.equal(captured.url, '/api/settings/integrations/ai-assist');
  assert.equal(s.baseUrl, 'https://api.openai.com');
  assert.equal(s.hasApiKey, true);
  assert.equal(s.apiKeyMasked, '********');
  assert.equal(s.enableCandidateRerank, true);
  assert.equal(s.policy.requireNonAiEvidence, true);
  assert.equal(s.policy.maxAiWeight, 0.5);
});

test('⑨ ai-assist PUT：写体 **camelCase 正名** + 嵌套 policy **snake_case**（混合 casing）', async () => {
  setResponse({
    provider: 'claude',
    enabled: true,
    configured: true,
    model: 'claude-3',
    base_url: null,
    timeout_seconds: 30,
    max_tokens: 1024,
    temperature: 0.1,
    enable_candidate_rerank: false,
    enable_confidence_explain: true,
    has_api_key: true,
    api_key_masked: '********',
    policy: {
      require_non_ai_evidence: true,
      max_ai_weight: 0.4,
      strong_evidence_threshold: 0.7,
      weak_evidence_threshold: 0.2,
    },
  });
  await aiAssistApi.saveSettings({
    provider: 'claude',
    model: 'claude-3',
    baseUrl: 'https://api.anthropic.com',
    apiKey: 'sk-secret',
    clearApiKey: false,
    keepExistingApiKey: true,
    timeoutSeconds: 30,
    maxTokens: 1024,
    temperature: 0.1,
    enableCandidateRerank: false,
    enableConfidenceExplain: true,
    policy: {
      requireNonAiEvidence: true,
      maxAiWeight: 0.4,
      strongEvidenceThreshold: 0.7,
      weakEvidenceThreshold: 0.2,
    },
  });
  assert.equal(captured.method, 'PUT');
  assert.equal(captured.url, '/api/settings/integrations/ai-assist');
  const body = captured.body as Record<string, unknown>;
  // 顶层 canonical = camelCase（反例：snake 不得出现）
  assert.equal(body.baseUrl, 'https://api.anthropic.com');
  assert.equal(body.apiKey, 'sk-secret');
  assert.equal(body.clearApiKey, false);
  assert.equal(body.keepExistingApiKey, true);
  assert.equal(body.enableCandidateRerank, false);
  assert.equal(body.enableConfidenceExplain, true);
  assert.equal(body.base_url, undefined);
  assert.equal(body.api_key, undefined);
  // 嵌套 policy = snake_case（反例：camel 不得出现）
  const policy = body.policy as Record<string, unknown>;
  assert.equal(policy.require_non_ai_evidence, true);
  assert.equal(policy.max_ai_weight, 0.4);
  assert.equal(policy.strong_evidence_threshold, 0.7);
  assert.equal(policy.weak_evidence_threshold, 0.2);
  assert.equal(policy.maxAiWeight, undefined);
});

test('⑩ fail-closed：端口未装配 500 必须 reject（不吞成空数组/假成功）', async () => {
  setResponse({ error_code: 'INTERNAL', message: 'AI 干预服务未装配' }, 500);
  await assert.rejects(() => aiInterventionsApi.listThreads());
  await assert.rejects(() => aiInterventionsApi.getThread('5'));
  await assert.rejects(() => aiAssistApi.getSettings());
});
