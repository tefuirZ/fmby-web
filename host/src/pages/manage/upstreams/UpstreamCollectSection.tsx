import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  upstreamsApi,
} from '@fmby/v2-shared/contracts/manage/upstreams';
import type {
  UpstreamAppleCmsSyncPageResponse,
  UpstreamAppleCmsSyncResponse,
} from '@fmby/v2-shared/contracts/manage/upstreams';
import { queryKeys } from '@fmby/v2-shared/query';
import { InlineBanner, ConfirmDialog } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from '@/pages/manage/longtail-shared/ManageShared.module.css';

type ResultState =
  | { kind: 'page'; data: UpstreamAppleCmsSyncPageResponse }
  | { kind: 'apple'; data: UpstreamAppleCmsSyncResponse }
  | null;

function ResultBanner({ result }: { result: ResultState }) {
  if (!result) return null;
  let title = '采集完成';
  let detail = '';
  if (result.kind === 'page') {
    title = '单页抽样采集完成';
    detail = `分类 ${result.data.categoryId} 第 ${result.data.page}/${result.data.pageCount} 页：导入条目 ${result.data.importedItemCount}、变体 ${result.data.importedVariantCount}（共 ${result.data.total}）。`;
  } else {
    title = 'AppleCMS 全量采集已触发';
    detail = `导入条目 ${result.data.importedItemCount}、变体 ${result.data.importedVariantCount}；已绑定分类 ${result.data.boundCategoryCount}，跳过未绑定 ${result.data.skippedUnboundCategoryCount}。`;
  }
  return (
    <InlineBanner variant="info" title={title} description={detail} />
  );
}

/**
 * 采集与导入触发（FE-PARITY-UPSTREAMS-SYNC）。
 *
 * 写操作：apple-cms 单页/全量。
 * 后端无 require_confirmed（fail-closed 500），但「全量采集」属长耗时/不可逆动作，
 * 前端用 ConfirmDialog 二次确认（口径同 SensitiveActionDialog）；
 * 单页抽样为轻量只读式，直接触发。所有错误透传后端 error_code。
 */
export function UpstreamCollectSection({ sourceId }: { sourceId: string }) {
  const queryClient = useQueryClient();
  const [categoryId, setCategoryId] = useState('');
  const [result, setResult] = useState<ResultState>(null);
  const [confirm, setConfirm] = useState<null | 'apple-full'>(null);

  const invalidateJobs = () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.manage.upstreams.syncJobs(sourceId),
    });
  };

  const pageMutation = useMutation({
    mutationFn: () =>
      upstreamsApi.appleCmsSyncPage(sourceId, {
        categoryId: categoryId.trim(),
        page: 1,
      }),
    onSuccess: (data) => setResult({ kind: 'page', data }),
    onError: () => setResult(null),
  });

  const appleFullMutation = useMutation({
    mutationFn: () => upstreamsApi.appleCmsSync(sourceId, { categoryId: categoryId.trim() || undefined }),
    onSuccess: (data) => {
      setResult({ kind: 'apple', data });
      invalidateJobs();
    },
  });

  const lastError = pageMutation.error ?? appleFullMutation.error;

  const pending = pageMutation.isPending || appleFullMutation.isPending;

  const runConfirmed = () => {
    if (confirm === 'apple-full') appleFullMutation.mutate();
    setConfirm(null);
  };

  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <div className={styles.headerContent}>
          <h2 className={styles.sectionTitle}>采集与导入</h2>
          <p className={styles.sectionDescription}>
            触发 AppleCMS 采集。端口未装配时后端返回 500（不会伪造成功）。
          </p>
        </div>
      </div>

      {result ? <ResultBanner result={result} /> : null}
      {lastError ? (
        <InlineBanner variant="error" title="操作失败" description={getErrorMessage(lastError)} />
      ) : null}

      <div className={styles.fieldRow}>
        <div className={styles.stackText}>
          <span className={styles.mutedText}>AppleCMS 分类 ID（可选，留空=全部分类）</span>
          <input
            className={styles.input}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            placeholder="如 7"
            aria-label="AppleCMS 分类 ID"
            disabled={pending}
          />
        </div>
      </div>

      <div className={styles.buttonRow}>
        <button
          className={styles.primaryButton}
          type="button"
          disabled={pending || !categoryId.trim()}
          onClick={() => pageMutation.mutate()}
        >
          {pageMutation.isPending ? '采集中…' : 'AppleCMS 单页抽样'}
        </button>
        <button
          className={styles.dangerButton}
          type="button"
          disabled={pending}
          onClick={() => setConfirm('apple-full')}
        >
          AppleCMS 全量采集
        </button>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title="AppleCMS 全量采集"
        description="该操作会触发上游拉取与落库，可能耗时较长。确认要继续吗？"
        impact="采集/导入为长耗时写操作，触发后由后台 worker 消费。"
        confirmLabel="确认触发"
        cancelLabel="取消"
        pending={pending}
        onOpenChange={(next) => {
          if (!next) setConfirm(null);
        }}
        onConfirm={runConfirmed}
      />
    </section>
  );
}
