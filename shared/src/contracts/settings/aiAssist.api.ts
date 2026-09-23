/**
 * AI 辅助（ai-assist）设置 API（FE-AI-INTERVENTIONS）。
 *
 * 端点：`GET/PUT /api/settings/integrations/ai-assist`
 * ★**同端点两向不同形**（历史真 bug 类，须分开写）：
 * - GET 响应 `AiAssistSettingsView` → **snake_case**
 *   （`crates/fmby-v2-application/src/settings/ai_assist.rs:49`）。
 * - PUT 请求 `UpdateAiAssistSettingsRequest` → **camelCase 正名 + snake alias**
 *   （同文件 :123），但**嵌套 `policy` 仍是 snake_case**（同文件 :88）。
 *
 * 脱敏纪律：响应只含 `has_api_key` 与固定掩码 `api_key_masked`，**永不含明文**；
 * 明文 `apiKey` 只在 PUT 请求体出现一次。
 */

import { httpClient } from '@fmby/v2-shared/api/client';

const URL = '/api/settings/integrations/ai-assist';

export type AiAssistProvider = 'disabled' | 'openai' | 'claude';

export interface AiAssistPolicyRecord {
  requireNonAiEvidence: boolean;
  maxAiWeight: number;
  strongEvidenceThreshold: number;
  weakEvidenceThreshold: number;
}

export interface AiAssistSettingsRecord {
  provider: AiAssistProvider;
  enabled: boolean;
  configured: boolean;
  model: string;
  baseUrl: string | null;
  timeoutSeconds: number;
  maxTokens: number;
  temperature: number;
  enableCandidateRerank: boolean;
  enableConfidenceExplain: boolean;
  hasApiKey: boolean;
  apiKeyMasked: string | null;
  policy: AiAssistPolicyRecord;
}

/** PUT 输入（camelCase；明文 apiKey 只在此出现一次）。 */
export interface UpdateAiAssistSettingsInput {
  provider?: AiAssistProvider;
  model?: string;
  baseUrl?: string | null;
  apiKey?: string;
  clearApiKey?: boolean;
  keepExistingApiKey?: boolean;
  timeoutSeconds?: number;
  maxTokens?: number;
  temperature?: number;
  enableCandidateRerank?: boolean;
  enableConfidenceExplain?: boolean;
  policy?: AiAssistPolicyRecord;
}

// ─── Raw（GET 响应，snake_case） ──────────────────────────────────────────────

interface RawAiAssistPolicy {
  require_non_ai_evidence: boolean;
  max_ai_weight: number;
  strong_evidence_threshold: number;
  weak_evidence_threshold: number;
}

interface RawAiAssistSettings {
  provider: string;
  enabled: boolean;
  configured: boolean;
  model: string;
  base_url: string | null;
  timeout_seconds: number;
  max_tokens: number;
  temperature: number;
  enable_candidate_rerank: boolean;
  enable_confidence_explain: boolean;
  has_api_key: boolean;
  api_key_masked: string | null;
  policy: RawAiAssistPolicy;
}

const PROVIDERS = new Set<AiAssistProvider>(['disabled', 'openai', 'claude']);

function parseProvider(value: string): AiAssistProvider {
  const normalized = value.trim().toLowerCase() as AiAssistProvider;
  if (PROVIDERS.has(normalized)) return normalized;
  throw new Error(`未知 AI provider：${value}`);
}

function mapSettings(raw: RawAiAssistSettings): AiAssistSettingsRecord {
  return {
    provider: parseProvider(raw.provider),
    enabled: raw.enabled,
    configured: raw.configured,
    model: raw.model,
    baseUrl: raw.base_url,
    timeoutSeconds: raw.timeout_seconds,
    maxTokens: raw.max_tokens,
    temperature: raw.temperature,
    enableCandidateRerank: raw.enable_candidate_rerank,
    enableConfidenceExplain: raw.enable_confidence_explain,
    hasApiKey: raw.has_api_key,
    apiKeyMasked: raw.api_key_masked,
    policy: {
      requireNonAiEvidence: raw.policy.require_non_ai_evidence,
      maxAiWeight: raw.policy.max_ai_weight,
      strongEvidenceThreshold: raw.policy.strong_evidence_threshold,
      weakEvidenceThreshold: raw.policy.weak_evidence_threshold,
    },
  };
}

/**
 * 构造 PUT 请求体：顶层用 **camelCase 正名**（`baseUrl`/`apiKey`/`clearApiKey`/
 * `keepExistingApiKey`/`timeoutSeconds`/…），嵌套 `policy` 用 **snake_case**
 * （后端 `UpdateAiAssistPolicyRequest` 无 rename）。
 * 仅在提供时写入字段（`undefined` 由 JSON.stringify 丢弃）。
 */
function buildPutBody(input: UpdateAiAssistSettingsInput): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.provider !== undefined) body.provider = input.provider;
  if (input.model !== undefined) body.model = input.model;
  if (input.baseUrl !== undefined) body.baseUrl = input.baseUrl;
  if (input.apiKey !== undefined) body.apiKey = input.apiKey;
  if (input.clearApiKey !== undefined) body.clearApiKey = input.clearApiKey;
  if (input.keepExistingApiKey !== undefined) body.keepExistingApiKey = input.keepExistingApiKey;
  if (input.timeoutSeconds !== undefined) body.timeoutSeconds = input.timeoutSeconds;
  if (input.maxTokens !== undefined) body.maxTokens = input.maxTokens;
  if (input.temperature !== undefined) body.temperature = input.temperature;
  if (input.enableCandidateRerank !== undefined) {
    body.enableCandidateRerank = input.enableCandidateRerank;
  }
  if (input.enableConfidenceExplain !== undefined) {
    body.enableConfidenceExplain = input.enableConfidenceExplain;
  }
  if (input.policy !== undefined) {
    body.policy = {
      require_non_ai_evidence: input.policy.requireNonAiEvidence,
      max_ai_weight: input.policy.maxAiWeight,
      strong_evidence_threshold: input.policy.strongEvidenceThreshold,
      weak_evidence_threshold: input.policy.weakEvidenceThreshold,
    };
  }
  return body;
}

export const aiAssistApi = {
  async getSettings(): Promise<AiAssistSettingsRecord> {
    const raw = await httpClient.get<RawAiAssistSettings>(URL);
    return mapSettings(raw);
  },

  async saveSettings(input: UpdateAiAssistSettingsInput): Promise<AiAssistSettingsRecord> {
    const raw = await httpClient.put<RawAiAssistSettings>(URL, { body: buildPutBody(input) });
    return mapSettings(raw);
  },
};
