import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { pan115ImghostApi } from '@/domains/manage/pan115Imghost';
import type { Pan115ImghostAsset, Pan115ImghostUploadResponse } from '@/domains/manage/pan115Imghost';
import { ManageSectionCard } from '@/pages/manage/longtail-shared/components';
import { FeedbackState } from '@/shared/ui';
import { InlineBanner } from '@/shared/ui';
import { queryKeys } from '@/shared/query-keys';
import { getErrorMessage } from '@/shared/utils/error';
import { AssetCard } from './AssetCard';
import styles from '@/pages/manage/longtail-shared/ManageShared.module.css';

// ─── 常量 ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;
const POLL_INTERVAL_MS = 3_000;
const POLL_STOP_AFTER_MS = 5 * 60 * 1_000; // 5 分钟

// ─── 工具 ─────────────────────────────────────────────────────────────────────

/** 将上传响应转换为 AssetItem 格式（乐观插入） */
function uploadResponseToAsset(r: Pan115ImghostUploadResponse): Pan115ImghostAsset {
  const now = new Date().toISOString();
  return {
    id: r.id,
    sha1: r.sha1,
    size: r.size,
    mime: r.mime,
    ext: r.mime.split('/')[1] ?? '',
    originalFilename: `${r.sha1}.${r.mime.split('/')[1] ?? 'bin'}`,
    mirrorStatus: r.mirrorStatus,
    localUrl: r.localUrl,
    hostUrl: r.hostUrl,
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AssetListProps {
  /** 由上传区传入的最新上传结果，用于顶部乐观插入 */
  pendingUpload: Pan115ImghostUploadResponse | null;
  onPendingConsumed: () => void;
}

// ─── 组件 ─────────────────────────────────────────────────────────────────────

/**
 * 图床资产列表。
 *
 * - 分页查询（目前固定每页 50 条）
 * - 上传后新资产插入列表顶部（乐观更新），mirror_status=Uploading 时轮询刷新
 * - 轮询最多持续 5 分钟
 */
export function AssetList({ pendingUpload, onPendingConsumed }: AssetListProps) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  // 顶部乐观插入：记录本地插入的资产
  const [optimisticItems, setOptimisticItems] = useState<Pan115ImghostAsset[]>([]);

  // 轮询相关
  const pollTimerRef = useRef<number | null>(null);
  const pollStartedAt = useRef<number | null>(null);

  const queryKey = queryKeys.manage.pan115Imghost.assets.list(page);

  const assetsQuery = useQuery({
    queryKey,
    queryFn: () => pan115ImghostApi.listAssets(page, PAGE_SIZE),
    staleTime: 10_000,
  });

  // ── 消费 pendingUpload，乐观插入 ──────────────────────────────────────────
  useEffect(() => {
    if (!pendingUpload) return;
    const asset = uploadResponseToAsset(pendingUpload);
    setOptimisticItems((prev) => [asset, ...prev.filter((a) => a.id !== asset.id)]);
    onPendingConsumed();
  }, [pendingUpload, onPendingConsumed]);

  // ── 轮询：若列表中有 Uploading 状态的资产则启动 ──────────────────────────
  const hasUploading =
    optimisticItems.some((a) => a.mirrorStatus === 'Uploading') ||
    (assetsQuery.data?.items ?? []).some((a) => a.mirrorStatus === 'Uploading');

  useEffect(() => {
    const stopPoll = () => {
      if (pollTimerRef.current !== null) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      pollStartedAt.current = null;
    };

    if (!hasUploading) {
      stopPoll();
      return;
    }

    if (pollTimerRef.current !== null) return; // 已在轮询

    pollStartedAt.current = Date.now();
    pollTimerRef.current = window.setInterval(() => {
      if (
        pollStartedAt.current !== null &&
        Date.now() - pollStartedAt.current > POLL_STOP_AFTER_MS
      ) {
        stopPoll();
        return;
      }
      // 刷新第一页（最新资产大概率在第一页）
      queryClient.invalidateQueries({ queryKey: queryKeys.manage.pan115Imghost.assets.all() });
    }, POLL_INTERVAL_MS);

    return stopPoll;
  }, [hasUploading, queryClient]);

  // ── 当服务端数据更新时，同步乐观列表中已确认的资产 ──────────────────────
  useEffect(() => {
    const serverItems = assetsQuery.data?.items ?? [];
    if (serverItems.length === 0 || optimisticItems.length === 0) return;

    const serverMap = new Map(serverItems.map((a) => [a.id, a]));
    setOptimisticItems((prev) => {
      const next = prev.map((a) => serverMap.get(a.id) ?? a);
      // 若所有乐观项都已 Ok，清空
      if (next.every((a) => a.mirrorStatus !== 'Uploading')) {
        return [];
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetsQuery.data]);

  const serverItems = assetsQuery.data?.items ?? [];
  const total = assetsQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  // 合并：乐观列表（去重）+ 服务端列表
  const optimisticIds = new Set(optimisticItems.map((a) => a.id));
  const mergedItems: Pan115ImghostAsset[] = [
    ...optimisticItems,
    ...serverItems.filter((a) => !optimisticIds.has(a.id)),
  ];

  return (
    <ManageSectionCard
      title="图片资产"
      description={`共 ${total} 张图片${hasUploading ? '（有镜像任务进行中，每 3 秒自动刷新）' : ''}`}
    >
      {assetsQuery.isPending && optimisticItems.length === 0 ? (
        <FeedbackState variant="loading" title="正在加载资产列表…" description="请稍候" />
      ) : assetsQuery.isError ? (
        <InlineBanner
          variant="error"
          title="资产列表加载失败"
          description={getErrorMessage(assetsQuery.error)}
        />
      ) : mergedItems.length === 0 ? (
        <FeedbackState
          variant="empty"
          title="暂无图片"
          description="上传第一张图片后将在此展示。"
        />
      ) : (
        <>
          {/* 资产卡片网格 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            {mergedItems.map((asset) => (
              <AssetCard key={asset.id} asset={asset} />
            ))}
          </div>

          {/* 分页控制 */}
          {totalPages > 1 ? (
            <div className={styles.rowActions} style={{ justifyContent: 'center', marginTop: 8 }}>
              <button
                className={styles.smallButton}
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                上一页
              </button>
              <span className={styles.mutedText}>
                第 {page} / {totalPages} 页
              </span>
              <button
                className={styles.smallButton}
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </button>
            </div>
          ) : null}
        </>
      )}
    </ManageSectionCard>
  );
}
