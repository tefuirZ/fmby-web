/**
 * AI 辅助 provider / 策略设置面板（FE-AI-INTERVENTIONS）。
 *
 * 照 V1 `AiInterventionProviderPanel` 对位；数据源 `GET/PUT /api/settings/integrations/ai-assist`。
 * ★脱敏：响应只给 `hasApiKey` + 掩码；明文 apiKey 仅在本次提交里出现一次。
 * ★读写两向不同形由契约层负责（domain camelCase ↔ 读 snake / 写 camel+policy snake）。
 */

import { useEffect, useState } from 'react';
import { FeedbackState } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import type {
  AiAssistProvider,
  AiAssistSettingsRecord,
  UpdateAiAssistSettingsInput,
} from '@fmby/v2-shared/contracts/settings/aiAssist.api';
import styles from '../../../longtail-shared/ManageShared.module.css';

interface AiInterventionProviderPanelProps {
  settings: AiAssistSettingsRecord | undefined;
  isPending: boolean;
  error: unknown;
  savePending: boolean;
  saveError: unknown;
  saved: boolean;
  onSave: (input: UpdateAiAssistSettingsInput) => void;
}

const PROVIDER_OPTIONS: Array<{ value: AiAssistProvider; label: string }> = [
  { value: 'disabled', label: '未启用' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'claude', label: 'Claude' },
];

interface FormState {
  provider: AiAssistProvider;
  model: string;
  baseUrl: string;
  apiKey: string;
  clearApiKey: boolean;
  timeoutSeconds: string;
  maxTokens: string;
  temperature: string;
  enableCandidateRerank: boolean;
  enableConfidenceExplain: boolean;
  requireNonAiEvidence: boolean;
  maxAiWeight: string;
  strongEvidenceThreshold: string;
  weakEvidenceThreshold: string;
}

function toForm(settings: AiAssistSettingsRecord): FormState {
  return {
    provider: settings.provider,
    model: settings.model,
    baseUrl: settings.baseUrl ?? '',
    apiKey: '',
    clearApiKey: false,
    timeoutSeconds: String(settings.timeoutSeconds),
    maxTokens: String(settings.maxTokens),
    temperature: String(settings.temperature),
    enableCandidateRerank: settings.enableCandidateRerank,
    enableConfidenceExplain: settings.enableConfidenceExplain,
    requireNonAiEvidence: settings.policy.requireNonAiEvidence,
    maxAiWeight: String(settings.policy.maxAiWeight),
    strongEvidenceThreshold: String(settings.policy.strongEvidenceThreshold),
    weakEvidenceThreshold: String(settings.policy.weakEvidenceThreshold),
  };
}

/** 数字解析：非法/空 → undefined（不提交该字段，避免把 NaN 写进契约）。 */
function numberOrUndefined(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function buildSaveInput(form: FormState): UpdateAiAssistSettingsInput {
  const input: UpdateAiAssistSettingsInput = {
    provider: form.provider,
    model: form.model.trim(),
    baseUrl: form.baseUrl.trim() || null,
    clearApiKey: form.clearApiKey,
    timeoutSeconds: numberOrUndefined(form.timeoutSeconds),
    maxTokens: numberOrUndefined(form.maxTokens),
    temperature: numberOrUndefined(form.temperature),
    enableCandidateRerank: form.enableCandidateRerank,
    enableConfidenceExplain: form.enableConfidenceExplain,
    policy: {
      requireNonAiEvidence: form.requireNonAiEvidence,
      maxAiWeight: numberOrUndefined(form.maxAiWeight) ?? 0,
      strongEvidenceThreshold: numberOrUndefined(form.strongEvidenceThreshold) ?? 0,
      weakEvidenceThreshold: numberOrUndefined(form.weakEvidenceThreshold) ?? 0,
    },
  };
  // 明文 key 只在用户真填了才提交；填了就不带 clear；未填且未勾清除 → 保留现有 key。
  if (form.apiKey.trim()) {
    input.apiKey = form.apiKey.trim();
  } else if (form.clearApiKey) {
    input.clearApiKey = true;
  } else {
    input.keepExistingApiKey = true;
  }
  return input;
}

export function AiInterventionProviderPanel({
  settings,
  isPending,
  error,
  savePending,
  saveError,
  saved,
  onSave,
}: AiInterventionProviderPanelProps) {
  const [form, setForm] = useState<FormState | null>(settings ? toForm(settings) : null);

  useEffect(() => {
    if (settings) setForm(toForm(settings));
  }, [settings]);

  if (isPending) {
    return (
      <FeedbackState
        variant="loading"
        title="正在加载 AI 辅助设置"
        description="正在读取 provider 与策略配置。"
      />
    );
  }

  if (error) {
    return (
      <FeedbackState
        variant="error"
        title="AI 辅助设置加载失败"
        description={getErrorMessage(error)}
      />
    );
  }

  if (!form || !settings) {
    return <div className={styles.emptyInlineState}>未取到 AI 辅助设置。</div>;
  }

  function patch(next: Partial<FormState>) {
    setForm((prev) => (prev ? { ...prev, ...next } : prev));
  }

  return (
    <div className={styles.fieldGroup}>
      {saveError ? <div className={styles.dangerPanel}>{getErrorMessage(saveError)}</div> : null}
      {saved ? <div className={styles.fieldHint}>设置已保存。</div> : null}

      <div className={styles.rowActions}>
        <label className={styles.label}>
          Provider
          <select
            className={styles.select}
            value={form.provider}
            aria-label="AI provider"
            onChange={(e) => patch({ provider: e.target.value as AiAssistProvider })}
          >
            {PROVIDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.label}>
          模型
          <input
            className={styles.input}
            value={form.model}
            aria-label="AI 模型"
            onChange={(e) => patch({ model: e.target.value })}
          />
        </label>
        <label className={styles.label}>
          Base URL
          <input
            className={styles.input}
            value={form.baseUrl}
            aria-label="AI base url"
            placeholder="留空用官方默认"
            onChange={(e) => patch({ baseUrl: e.target.value })}
          />
        </label>
      </div>

      <div className={styles.rowActions}>
        <label className={styles.label}>
          API Key
          <input
            className={styles.input}
            type="password"
            autoComplete="off"
            value={form.apiKey}
            aria-label="AI api key"
            placeholder={settings.hasApiKey ? '留空 = 保留现有 key' : '未设置'}
            onChange={(e) => patch({ apiKey: e.target.value })}
          />
        </label>
        <span className={styles.mutedText}>
          当前：{settings.hasApiKey ? `已设置（${settings.apiKeyMasked ?? '掩码'}）` : '未设置'}
        </span>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={form.clearApiKey}
            disabled={!settings.hasApiKey}
            aria-label="清除现有 API Key"
            onChange={(e) => patch({ clearApiKey: e.target.checked })}
          />
          清除现有 key
        </label>
      </div>

      <div className={styles.rowActions}>
        <label className={styles.label}>
          超时（秒）
          <input
            className={styles.input}
            value={form.timeoutSeconds}
            aria-label="AI 超时秒数"
            onChange={(e) => patch({ timeoutSeconds: e.target.value })}
          />
        </label>
        <label className={styles.label}>
          Max tokens
          <input
            className={styles.input}
            value={form.maxTokens}
            aria-label="AI max tokens"
            onChange={(e) => patch({ maxTokens: e.target.value })}
          />
        </label>
        <label className={styles.label}>
          Temperature
          <input
            className={styles.input}
            value={form.temperature}
            aria-label="AI temperature"
            onChange={(e) => patch({ temperature: e.target.value })}
          />
        </label>
      </div>

      <div className={styles.checkboxRow}>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={form.enableCandidateRerank}
            onChange={(e) => patch({ enableCandidateRerank: e.target.checked })}
          />
          启用候选重排
        </label>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={form.enableConfidenceExplain}
            onChange={(e) => patch({ enableConfidenceExplain: e.target.checked })}
          />
          启用置信度解释
        </label>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={form.requireNonAiEvidence}
            onChange={(e) => patch({ requireNonAiEvidence: e.target.checked })}
          />
          要求非 AI 证据
        </label>
      </div>

      <div className={styles.rowActions}>
        <label className={styles.label}>
          Max AI 权重
          <input
            className={styles.input}
            value={form.maxAiWeight}
            onChange={(e) => patch({ maxAiWeight: e.target.value })}
          />
        </label>
        <label className={styles.label}>
          强证据阈值
          <input
            className={styles.input}
            value={form.strongEvidenceThreshold}
            onChange={(e) => patch({ strongEvidenceThreshold: e.target.value })}
          />
        </label>
        <label className={styles.label}>
          弱证据阈值
          <input
            className={styles.input}
            value={form.weakEvidenceThreshold}
            onChange={(e) => patch({ weakEvidenceThreshold: e.target.value })}
          />
        </label>
      </div>

      <div className={styles.rowActions}>
        <button
          className={styles.primaryButton}
          type="button"
          disabled={savePending}
          onClick={() => onSave(buildSaveInput(form))}
        >
          {savePending ? '保存中…' : '保存设置'}
        </button>
      </div>
    </div>
  );
}
