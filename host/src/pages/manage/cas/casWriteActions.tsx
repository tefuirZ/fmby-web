/**
 * fmby-web#658 / #671：CAS 写操作按钮（触发对账 / 重试复制）。
 *
 * 从 ManageCasPage 抽出以守 400 行门禁（component-size）。
 *
 * ★两条纪律（沿用本页既有 fail-closed）：
 * 1. 失败**透传后端原文**（`getErrorMessage`），不另造文案、不美化；
 * 2. 端点未装配（503）/ 能力不足（403）/ 缺 confirmed（400）一律显式呈现，
 *    **绝不**显示成「已触发 / 成功」。
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';
import { casAdminApi } from '@fmby/v2-shared/contracts/manage/casAdmin';
import type { CasReconcileTrigger } from '@fmby/v2-shared/contracts/manage/casAdmin';
import { resolveReconcileReceiptView, resolveRetryCopyView } from './casWriteReceipt';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { queryKeys } from '@fmby/v2-shared/query';
import styles from '../longtail-shared/ManageShared.module.css';

/**
 * 触发一次 `.cas` 对账（`POST /api/admin/cas/reconcile/trigger?confirmed=true`）。
 *
 * 三态：idle / 进行中 / 结果（成功或失败原因可见）。
 */
export function ReconcileTriggerButton({
  mutation,
}: {
  mutation: UseMutationResult<CasReconcileTrigger, unknown, void>;
}) {
  return (
    <div>
      <button type="button" className={styles.casHitBtn} disabled={mutation.isPending} onClick={() => mutation.mutate()}>
        {mutation.isPending ? '触发中…' : '触发对账'}
      </button>
      {mutation.isSuccess && mutation.data ? (
        // ★G4：回执 `created` 决定这句话的真假 —— 幂等命中不能说成「已入队新任务」。
        (() => {
          const view = resolveReconcileReceiptView(mutation.data!);
          return <span data-tone={view.tone}>{view.label}（报告稍后刷新）</span>;
        })()
      ) : null}
      {mutation.isError ? (
        // ★透传后端原文：503/403/400 的原因由后端给出，前端不猜测、不美化。
        <span>触发失败：{getErrorMessage(mutation.error)}</span>
      ) : null}
    </div>
  );
}

/**
 * 重试某内容在某盘上的复制
 * （`POST /api/admin/cas/fanout/{contentId}/drives/{driveId}/retry?confirmed=true`）。
 *
 * ★rb01 本端点**尚未合入** ⇒ 接线但**不伪装可用**：未装配时后端返 503，
 *   此处显式报后端原文「端点未装配…」，绝不显示成「已重试」。
 */
export function RetryCopyButton({
  contentId,
  driveId,
}: {
  contentId: number;
  driveId: number;
}) {
  const queryClient = useQueryClient();
  const retry = useMutation({
    mutationFn: () => casAdminApi.retryFanoutCopy(contentId, driveId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.manage.cas.fanout(contentId) });
    },
  });

  return (
    <div>
      <button type="button" className={styles.casHitBtn} disabled={retry.isPending} onClick={() => retry.mutate()}>
        {retry.isPending ? '重试中…' : '重试复制'}
      </button>
      {retry.isSuccess && retry.data ? (
        // ★G4：按 `copy_state` 分支 —— 旧版无条件写「已触发重试」，failed 也被显示成成功。
        (() => {
          const view = resolveRetryCopyView(retry.data!);
          return <span data-tone={view.tone}>{view.label}</span>;
        })()
      ) : null}
      {retry.isError ? (
        <span>重试失败：{getErrorMessage(retry.error)}</span>
      ) : null}
    </div>
  );
}
