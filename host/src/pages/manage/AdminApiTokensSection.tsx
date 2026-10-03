/**
 * 管理面 API 令牌（FE-UI-BACKLOG-2）。
 *
 * 契约层 `adminApiTokensApi`（list / create / revoke）已合入且**前端零 UI**；
 * 后端 `admin_list_api_tokens` / `admin_create_api_token` / `admin_revoke_api_token`
 * 为**真实实现非 501**（能力门 `MANAGE_ACCESS`；端口未装配 ⇒ 后端 Validation）。
 *
 * ★字段按 `shared/src/contracts/manage/adminApiTokens/types.ts` 实测（不凭记忆）：
 *   `AdminApiToken{ id:number, name, scopes:string[], createdAtMs, expiresAtMs:number|null }`
 *   —— `expiresAtMs` 为 null 表示**不过期**，本页如实显示「长期有效」，不伪造日期。
 *
 * ★诚实口径：
 *   - 列表为空 ⇒ 显式空态，不伪造占位令牌；
 *   - **revoke 不可逆** ⇒ 走 `ConfirmDialog`（真实 props：需 `onOpenChange`）二次确认；
 *   - 错误一律经既有 `getErrorMessage` 出后端原文，不本地臆造。
 *
 * 形态照同目录既有管理页：`ManageSectionCard` + `FeedbackState` + `InlineBanner` +
 * `StatusBadge` + `ConfirmDialog` + `ManageShared.module.css`，未新造外壳/样式。
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adminApiTokensApi,
  type AdminApiToken,
} from '@fmby/v2-shared/contracts/manage/adminApiTokens';
import { ConfirmDialog, FeedbackState, InlineBanner, StatusBadge } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from './longtail-shared/ManageShared.module.css';
import { ManageSectionCard } from './longtail-shared/components';

const TOKENS_KEY = ['manage', 'admin', 'api-tokens'] as const;

function formatEpochMs(epochMs: number | null): string {
  if (epochMs === null || !Number.isFinite(epochMs) || epochMs <= 0) {
    return '—';
  }
  return new Date(epochMs).toLocaleString('zh-CN', { hour12: false });
}

export function AdminApiTokensSection() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [scopesText, setScopesText] = useState('');
  const [pendingRevoke, setPendingRevoke] = useState<AdminApiToken | null>(null);

  const tokensQuery = useQuery({
    queryKey: TOKENS_KEY,
    queryFn: () => adminApiTokensApi.list(),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: TOKENS_KEY });
  }

  const createMutation = useMutation({
    mutationFn: () =>
      adminApiTokensApi.create({
        name: name.trim(),
        // 逗号/空白分隔；留空 ⇒ 空 scope 列表（由后端校验）
        scopes: scopesText
          .split(/[,，\s]+/)
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      setError(null);
      setNotice('API 令牌已创建。');
      setName('');
      setScopesText('');
      invalidate();
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: number) => adminApiTokensApi.revoke(id),
    onSuccess: () => {
      setError(null);
      setNotice('API 令牌已吊销。');
      setPendingRevoke(null);
      invalidate();
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const tokens = tokensQuery.data ?? [];

  return (
    <>
      <ManageSectionCard
        title="API 令牌"
        description="为自动化脚本签发管理面调用凭据；吊销不可逆，请谨慎操作。"
      >
        {notice ? <InlineBanner variant="success" title={notice} /> : null}
        {error ? <InlineBanner variant="error" title={error} /> : null}

        <div className={styles.fieldGroup}>
          <label className={styles.label}>
            令牌名称（必填）
            <input
              className={styles.input}
              aria-label="API 令牌名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className={styles.label}>
            权限范围（逗号分隔，可留空）
            <input
              className={styles.input}
              aria-label="API 令牌权限范围"
              placeholder="例如：manage:library,manage:mount"
              value={scopesText}
              onChange={(e) => setScopesText(e.target.value)}
            />
          </label>
        </div>

        <div className={styles.buttonRow}>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={createMutation.isPending || !name.trim()}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? '创建中…' : '新建令牌'}
          </button>
        </div>

        {tokensQuery.isPending ? (
          <div className={styles.fieldHint}>正在读取 API 令牌…</div>
        ) : tokensQuery.isError ? (
          <FeedbackState
            variant="error"
            title="无法读取 API 令牌"
            description={getErrorMessage(tokensQuery.error)}
            action={
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => void tokensQuery.refetch()}
              >
                重试
              </button>
            }
          />
        ) : tokens.length === 0 ? (
          <FeedbackState
            variant="empty"
            title="暂无 API 令牌"
            description="创建令牌后可用于脚本化管理调用。"
          />
        ) : (
          <ul className={styles.activityList}>
            {tokens.map((token) => (
              <li key={token.id} className={styles.activityItem}>
                <span className={styles.activityTitle}>{token.name}</span>
                <span className={styles.activityTime}>
                  {token.scopes.length > 0 ? token.scopes.join('、') : '（无显式 scope）'}
                </span>
                <span className={styles.activityTime}>
                  {token.expiresAtMs === null
                    ? '长期有效'
                    : `到期 ${formatEpochMs(token.expiresAtMs)}`}
                </span>
                <StatusBadge label={`#${token.id}`} variant="neutral" />
                <button
                  type="button"
                  className={styles.dangerButton}
                  onClick={() => setPendingRevoke(token)}
                >
                  吊销
                </button>
              </li>
            ))}
          </ul>
        )}
      </ManageSectionCard>

      <ConfirmDialog
        open={pendingRevoke !== null}
        title="吊销 API 令牌"
        description={
          pendingRevoke
            ? `确定吊销「${pendingRevoke.name}」？吊销后使用该令牌的调用将立即失败，且无法恢复。`
            : ''
        }
        impact="使用该令牌的外部脚本将立即失效"
        confirmLabel="吊销"
        pending={revokeMutation.isPending}
        onOpenChange={(open) => {
          if (!open) setPendingRevoke(null);
        }}
        onConfirm={() => {
          if (pendingRevoke) revokeMutation.mutate(pendingRevoke.id);
        }}
      />
    </>
  );
}
