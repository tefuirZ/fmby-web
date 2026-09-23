/**
 * 运营看板：数据源负载 + 活跃播放明细（FE-PARITY-OPERATIONS-EXTRA）。
 *
 * 端点（真源 `crates/fmby-v2-http/src/routes/manage_operations_gap.rs`）：
 * - GET /api/manage/operations/data-sources/load （:145，响应 :175-224）
 * - GET /api/manage/operations/playback/active    （:228，响应 :294-300）
 *
 * 二者均为真实调用点（useQuery + queryKey），不是只落类型的死契约。
 *
 * ★诚实呈现：
 * - OUTBOUND 计数端口未装配 → 后端给 null（未知 ≠ 0），页面显示「—」不补 0。
 * - playback/active 的设备/客户端/剧集字段 V2 无源 → 恒 null/空，照实显示「—」。
 * - limit 越界由后端 clamp，前端原值上送并以响应回显的 limit 为准。
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  operationsApi,
  OPERATIONS_ACTIVE_PLAYBACK_LIMIT_DEFAULT,
  OPERATIONS_ACTIVE_PLAYBACK_LIMIT_MAX,
} from '@fmby/v2-shared/contracts/manage/operations';
import { useOperationsRealtime } from '@/features/operations/useOperationsRealtime';
import { queryKeys } from '@fmby/v2-shared/query';
import { InlineBanner, StatusBadge } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from '../longtail-shared/ManageShared.module.css';
import { ManageSectionCard } from '../longtail-shared/components';

const LIMIT_OPTIONS = [50, 200, 500] as const;
const EM_DASH = '—';

function numOrDash(value: number | null): string {
  return value === null ? EM_DASH : String(value);
}

function textOrDash(value: string | null): string {
  return value === null || value === '' ? EM_DASH : value;
}

export function OperationsGapSections() {
  const [limit, setLimit] = useState<number>(OPERATIONS_ACTIVE_PLAYBACK_LIMIT_DEFAULT);

  const mountLoadQuery = useQuery({
    queryKey: queryKeys.manage.operations.mountLoad(),
    queryFn: () => operationsApi.mountLoad(),
  });

  const activePlaybackQuery = useQuery({
    queryKey: queryKeys.manage.operations.activePlayback(limit),
    queryFn: () => operationsApi.activePlayback({ limit }),
  });

  const loadItems = mountLoadQuery.data?.items ?? [];
  const sessions = activePlaybackQuery.data?.sessions ?? [];

  // W5-E：实时通道（WS `/api/playback/realtime/ws`）。
  // 优先级：实时快照 > REST；REST 仍作首屏与回退（WS 断开/不可用时不白屏）。
  const realtime = useOperationsRealtime();
  const effectiveLoadItems = realtime.mountLoad?.items ?? loadItems;
  const effectiveSessions = realtime.activePlayback?.sessions ?? sessions;
  const isRealtimeLive = realtime.status === 'open';

  return (
    <>
      <ManageSectionCard
        title="数据源负载（负载端点）"
        description="按挂载聚合的活跃会话与出站计数；负载等级与建议由后端按阈值下发。"
        actions={
          <div className={styles.actionGroup}>
            {isRealtimeLive ? (
              <StatusBadge label="实时" variant="success" />
            ) : realtime.status === 'error' || realtime.status === 'closed' ? (
              <StatusBadge label="实时离线·REST 回退" variant="warning" />
            ) : null}
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => void mountLoadQuery.refetch()}
            >
              刷新
            </button>
          </div>
        }
      >
        {mountLoadQuery.isPending ? (
          <div className={styles.tableHint}>正在加载数据源负载…</div>
        ) : mountLoadQuery.isError ? (
          <InlineBanner
            variant="error"
            title="数据源负载读取失败"
            description={getErrorMessage(mountLoadQuery.error)}
          />
        ) : loadItems.length === 0 ? (
          <div className={styles.emptyInlineState}>当前无数据源负载观测。</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>数据源</th>
                  <th>类型</th>
                  <th>活跃</th>
                  <th>播放中</th>
                  <th>暂停</th>
                  <th>等级</th>
                  <th>请求</th>
                  <th>成功</th>
                  <th>错误</th>
                  <th>限流</th>
                </tr>
              </thead>
              <tbody>
                {effectiveLoadItems.map((item) => (
                  <tr key={item.sourceId}>
                    <td>{item.sourceName}</td>
                    <td>{item.providerType}</td>
                    <td>{item.activeSessionCount}</td>
                    <td>{item.playingCount}</td>
                    <td>{item.pausedCount}</td>
                    <td>
                      <StatusBadge
                        label={item.loadLevel}
                        variant={
                          item.loadLevel === 'critical'
                            ? 'danger'
                            : item.loadLevel === 'warning'
                              ? 'warning'
                              : 'success'
                        }
                      />
                    </td>
                    {/* ★未知（端口未装配）显示 —，不补 0 */}
                    <td>{numOrDash(item.requestsTotal)}</td>
                    <td>{numOrDash(item.successTotal)}</td>
                    <td>{numOrDash(item.errorsTotal)}</td>
                    <td>{numOrDash(item.rateLimitedTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {loadItems.some((item) => item.advice) ? (
          <div className={styles.fieldHint}>
            {loadItems
              .filter((item) => item.advice)
              .map((item) => `${item.sourceName}：${item.advice}`)
              .join('；')}
          </div>
        ) : null}
      </ManageSectionCard>

      <ManageSectionCard
        title="活跃播放明细"
        description={`最近活跃播放会话；limit 缺省 ${OPERATIONS_ACTIVE_PLAYBACK_LIMIT_DEFAULT}，后端 clamp(1, ${OPERATIONS_ACTIVE_PLAYBACK_LIMIT_MAX})。`}
        actions={
          <label className={styles.label}>
            条数
            <select
              className={styles.select}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              {LIMIT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  最近 {option} 条
                </option>
              ))}
            </select>
          </label>
        }
      >
        {activePlaybackQuery.isPending ? (
          <div className={styles.tableHint}>正在加载活跃播放…</div>
        ) : activePlaybackQuery.isError ? (
          <InlineBanner
            variant="error"
            title="活跃播放读取失败"
            description={getErrorMessage(activePlaybackQuery.error)}
          />
        ) : sessions.length === 0 ? (
          <div className={styles.emptyInlineState}>当前没有活跃播放会话。</div>
        ) : (
          <>
            <div className={styles.fieldHint}>
              后端回显 limit={activePlaybackQuery.data?.limit ?? EM_DASH}，
              本次返回 {activePlaybackQuery.data?.totalReturned ?? 0} 条。
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>用户</th>
                    <th>条目</th>
                    <th>来源</th>
                    <th>状态</th>
                    <th>进度</th>
                    <th>开始时间</th>
                  </tr>
                </thead>
                <tbody>
                  {effectiveSessions.map((session) => (
                    <tr key={session.sessionId}>
                      <td>{session.user.username}</td>
                      <td>{session.item.title}</td>
                      <td>{textOrDash(session.source.sourceName)}</td>
                      <td>{session.status}</td>
                      <td>
                        {session.progressPercent === null
                          ? EM_DASH
                          : `${session.progressPercent}%`}
                      </td>
                      <td className="nowrap">{session.startedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </ManageSectionCard>
    </>
  );
}
