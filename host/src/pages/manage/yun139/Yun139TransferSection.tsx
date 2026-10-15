/**
 * 139 分享转存任务面板（YUN139-TRANSFERS-W1F，#658 前端 CAS 编排剩余项 ③ 转存/离线入口）。
 *
 * 三态：loading / empty / error 均显式呈现，不白屏、不吐原始错误对象。
 *
 * ★诚实登记（非缺陷）：
 *   - V2 无转存编排引擎 ⇒ `prepare_transfer` 仅落一条 PENDING 记录（target_file_id /
 *     transfer_task_id 留空），**不真发起转存**（后端 handoff 边界的诚实降级）。
 *     UI 据实呈现 status / target_file_discovery_status，不伪造「已转存」假态。
 *   - 后端无 share-mounts 列表端点 ⇒ mountId 手动输入（不臆造挂载）。
 *   - 形态差异（V1 URL vs V2 ID）：prepare 收 share_entry_id + source_file_id
 *     （来自浏览分享项的内部 ID），非 V1 的 URL/ed2k/磁力直提；URL→ID 解析是
 *     share-browse 另一特性，超本卡范围。
 *
 * ★权限门：后端三端点全 MANAGE_MOUNT（真闸在后端）；前端 PermissionGate manage:mount
 *   仅为 UX 降级（有 manage:access 但无 manage:mount 的用户看不到本面板，避免点了才 403）。
 */

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { yun139Api } from '@fmby/v2-shared/contracts/manage/yun139';
import { queryKeys } from '@fmby/v2-shared/query';
import { FeedbackState, InlineBanner, StatusBadge } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { PermissionGate } from '@/guards/PermissionGate';
import styles from '@/pages/manage/longtail-shared/ManageShared.module.css';
import { ManageSectionCard } from '@/pages/manage/longtail-shared/components';
import { useTableRowRoving } from '../../../features/a11y/useTableRowRoving';

/** ISO 字符串时间 → 本地可读；null/空 → 「—」。 */
function formatIso(iso: string | null): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleString('zh-CN', { hour12: false });
}

function Yun139TransferPanel() {
  const queryClient = useQueryClient();
  const [mountId, setMountId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // prepare 表单（ID-based：来自浏览分享项的内部 ID）
  const [shareEntryId, setShareEntryId] = useState('');
  const [sourceFileId, setSourceFileId] = useState('');
  const [sourceRelativePath, setSourceRelativePath] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [sourceSize, setSourceSize] = useState('');

  const activeMount = mountId.trim();
  const transfersQuery = useQuery({
    queryKey: queryKeys.manage.yun139.transfers(activeMount || undefined),
    queryFn: () => yun139Api.listTransfers(activeMount),
    enabled: activeMount.length > 0,
  });

  function invalidate() {
    if (activeMount) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.manage.yun139.transfers(activeMount),
      });
    }
  }

  const prepareMutation = useMutation({
    mutationFn: () =>
      yun139Api.prepareTransfer(activeMount, {
        shareEntryId: shareEntryId.trim(),
        sourceFileId: sourceFileId.trim(),
        sourceRelativePath: sourceRelativePath.trim(),
        sourceName: sourceName.trim(),
        sourceSize: sourceSize.trim() ? Number(sourceSize.trim()) : undefined,
      }),
    onSuccess: (res) => {
      setError(null);
      setNotice(`已准备转存记录：${res.transfer.id}（状态 ${res.transfer.status}）。`);
      setShareEntryId('');
      setSourceFileId('');
      setSourceRelativePath('');
      setSourceName('');
      setSourceSize('');
      invalidate();
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const playbackMutation = useMutation({
    mutationFn: (recordId: string) => yun139Api.reportPlaybackSuccess(recordId),
    onSuccess: () => {
      setError(null);
      setNotice('已回写播放成功。');
      invalidate();
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const transfers = transfersQuery.data?.items ?? [];
  const canPrepare =
    activeMount.length > 0 &&
    shareEntryId.trim().length > 0 &&
    sourceFileId.trim().length > 0 &&
    sourceRelativePath.trim().length > 0 &&
    sourceName.trim().length > 0;

  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  useTableRowRoving({ tbodyRef, rowCount: transfers.length });

  return (
    <ManageSectionCard
      title="分享转存"
      description="对 139 分享挂载发起转存记录并查看任务状态。后端当前仅落记录、不真发起转存（诚实降级）。"
    >
      {error ? <InlineBanner variant="error" title="操作失败" description={error} /> : null}
      {notice ? <InlineBanner variant="success" title={notice} /> : null}

      <div className={styles.fieldGroup}>
        <label className={styles.label}>
          分享挂载 ID（share-mount，手动输入）
          <input
            className={styles.input}
            value={mountId}
            onChange={(e) => setMountId(e.target.value)}
            placeholder="例如：m1"
          />
        </label>

        <div className={styles.fieldGroup}>
          <div className={styles.label}>准备转存（收分享项内部 ID，非 URL 直提）</div>
          <label className={styles.label}>
            分享项 ID（shareEntryId）
            <input
              className={styles.input}
              value={shareEntryId}
              onChange={(e) => setShareEntryId(e.target.value)}
              placeholder="例如：se-1"
            />
          </label>
          <label className={styles.label}>
            源文件 ID（sourceFileId）
            <input
              className={styles.input}
              value={sourceFileId}
              onChange={(e) => setSourceFileId(e.target.value)}
              placeholder="例如：f-1"
            />
          </label>
          <label className={styles.label}>
            源相对路径（sourceRelativePath）
            <input
              className={styles.input}
              value={sourceRelativePath}
              onChange={(e) => setSourceRelativePath(e.target.value)}
              placeholder="例如：/movies/a.mkv"
            />
          </label>
          <label className={styles.label}>
            源文件名（sourceName）
            <input
              className={styles.input}
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="例如：a.mkv"
            />
          </label>
          <label className={styles.label}>
            源文件大小（可选，字节）
            <input
              className={styles.input}
              value={sourceSize}
              onChange={(e) => setSourceSize(e.target.value)}
              placeholder="留空则不发送"
              inputMode="numeric"
            />
          </label>
          <div className={styles.buttonRow}>
            <button
              className={styles.primaryButton}
              type="button"
              disabled={!canPrepare || prepareMutation.isPending}
              onClick={() => prepareMutation.mutate()}
            >
              {prepareMutation.isPending ? '准备中…' : '准备转存'}
            </button>
          </div>
          <div className={styles.fieldHint}>
            分享项 / 源文件 ID 来自浏览分享项（share-browse 特性，另行接入）；此处据实收 ID，不做
            URL→ID 解析。
          </div>
        </div>
      </div>

      {activeMount.length === 0 ? (
        <div className={styles.emptyInlineState}>请输入分享挂载 ID 以查看转存记录。</div>
      ) : transfersQuery.isPending ? (
        <div className={styles.tableHint}>正在加载转存记录…</div>
      ) : transfersQuery.isError ? (
        <FeedbackState
          variant="error"
          title="转存记录加载失败"
          description={getErrorMessage(transfersQuery.error)}
          action={
            <button
              className={styles.primaryButton}
              type="button"
              onClick={() => void transfersQuery.refetch()}
            >
              重试
            </button>
          }
        />
      ) : transfers.length === 0 ? (
        <div className={styles.emptyInlineState}>该挂载下暂无转存记录。</div>
      ) : (
        <div className={styles.tableWrap} role="region" aria-label="转存记录（可横向滚动）">
          <table className={styles.table}>
            <thead>
              <tr>
                <th>源文件</th>
                <th>状态</th>
                <th>目标发现</th>
                <th>尝试</th>
                <th>到期</th>
                <th>最近错误</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody ref={tbodyRef}>
              {transfers.map((t, rowIndex) => (
                <tr key={t.id} data-row-index={rowIndex}>
                  <td>
                    <div>{t.sourceName}</div>
                    <div className={styles.fieldHint}>{t.sourceRelativePath}</div>
                  </td>
                  <td>
                    <StatusBadge
                      label={t.status}
                      variant={t.status === 'pending' ? 'neutral' : 'success'}
                    />
                  </td>
                  <td className="nowrap">{t.targetFileDiscoveryStatus}</td>
                  <td className="nowrap">{t.attemptCount}</td>
                  <td className="nowrap">{formatIso(t.expiresAt)}</td>
                  <td>{t.lastErrorMessage ?? t.lastErrorKind ?? '—'}</td>
                  <td className="nowrap">
                    <button
                      className={styles.smallButton}
                      type="button"
                      disabled={playbackMutation.isPending}
                      aria-label={`回写播放成功：${t.sourceName}`}
                      onClick={() => playbackMutation.mutate(t.id)}
                    >
                      回写播放成功
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ManageSectionCard>
  );
}

export function Yun139TransferSection() {
  return (
    <PermissionGate
      required="manage:mount"
      fallback={<div className={styles.emptyInlineState}>无 manage:mount 权限，无法查看转存面板。</div>}
    >
      <Yun139TransferPanel />
    </PermissionGate>
  );
}
