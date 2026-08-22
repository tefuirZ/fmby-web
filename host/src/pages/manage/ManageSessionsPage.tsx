import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  manageApi,
  type DangerousActionRequest,
  type SessionRecord,
} from '@fmby/v2-shared/contracts/manage';
import { queryKeys } from '@fmby/v2-shared/query';
import { FeedbackState } from '@fmby/v2-shared/ui';
import { InlineBanner } from '@fmby/v2-shared/ui';
import { SensitiveActionDialog } from '@fmby/v2-shared/ui';
import { StatusBadge } from '@fmby/v2-shared/ui';
import styles from './longtail-shared/ManageShared.module.css';
import {
  EmptyTableRow,
  ManagePageHeader,
  ManageSectionCard,
  getManageStatusVariant,
} from './longtail-shared/components';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { formatDateTime } from '@fmby/v2-shared/time';

export function ManageSessionsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'idle' | 'expired'>(
    'active',
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingSession, setPendingSession] = useState<SessionRecord | null>(null);

  const sessionsQuery = useQuery({
    queryKey: queryKeys.manage.sessions(),
    queryFn: () => manageApi.getSessions(),
  });

  const revokeMutation = useMutation({
    mutationFn: ({
      sessionId,
      confirmation,
    }: {
      sessionId: string;
      confirmation: DangerousActionRequest;
    }) => manageApi.revokeSession(sessionId, confirmation),
    onSuccess: async () => {
      setSuccessMessage('会话已移除。');
      setPendingSession(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.manage.sessions() });
    },
  });

  const sessions = sessionsQuery.data?.items ?? [];
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      if (statusFilter === 'all') return true;
      return session.status === statusFilter;
    });
  }, [sessions, statusFilter]);

  if (sessionsQuery.isPending) {
    return (
      <FeedbackState
        variant="loading"
        title="正在加载活动会话"
        description="正在读取真实设备、最近活跃时间和客户端信息。"
      />
    );
  }

  if (sessionsQuery.isError) {
    return (
      <FeedbackState
        variant="error"
        title="会话列表加载失败"
        description={getErrorMessage(sessionsQuery.error)}
        action={
          <button className={styles.primaryButton} onClick={() => sessionsQuery.refetch()}>
            重试
          </button>
        }
      />
    );
  }

  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="会话管理"
        description="只展示真实设备和当前活动信息，不暴露内部实现字段。"
        meta={<span className={styles.metaText}>当前展示 {filteredSessions.length} 个会话</span>}
      />

      {successMessage ? (
        <InlineBanner
          variant="success"
          title={successMessage}
          description="相关账号需要重新登录后才能恢复访问。"
        />
      ) : null}

      {revokeMutation.isError ? (
        <InlineBanner
          variant="error"
          title="会话移除失败"
          description={getErrorMessage(revokeMutation.error)}
        />
      ) : null}

      <ManageSectionCard
        title="设备列表"
        description="危险操作会立即影响对应设备访问。"
        actions={
          <label className={styles.label}>
            状态筛选
            <select
              className={styles.select}
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as 'all' | 'active' | 'idle' | 'expired')
              }
            >
              <option value="all">全部</option>
              <option value="active">活跃</option>
              <option value="idle">空闲</option>
              <option value="expired">过期</option>
            </select>
          </label>
        }
      >
        <div className={`${styles.tableWrap} ${styles.desktopOnly}`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>账号</th>
                <th>设备</th>
                <th>客户端</th>
                <th>状态</th>
                <th>最近活跃</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.length === 0 ? (
                <EmptyTableRow
                  colSpan={7}
                  title={sessions.length === 0 ? '暂无会话' : '没有匹配状态的会话'}
                  description={
                    sessions.length === 0
                      ? '待后端接入会话数据后展示。'
                      : '切换筛选查看其他会话状态。'
                  }
                />
              ) : (
                filteredSessions.map((session) => (
                  <tr key={session.id}>
                    <td>
                      <div className={styles.stackText}>
                        <span className={styles.primaryText}>{session.userName}</span>
                        {session.current ? <span className={styles.mutedText}>当前会话</span> : null}
                      </div>
                    </td>
                    <td>{session.deviceName}</td>
                    <td>
                      <div className={styles.stackText}>
                        <span>{session.clientName}</span>
                        <span className={styles.mutedText}>
                          {[session.clientHeader, session.ipAddress].filter(Boolean).join(' · ') || '—'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <StatusBadge
                        label={
                          session.status === 'active'
                            ? '活跃'
                            : session.status === 'idle'
                              ? '空闲'
                              : session.status === 'revoked'
                                ? '已移除'
                                : '已过期'
                        }
                        variant={getManageStatusVariant(session.status)}
                      />
                    </td>
                    <td>{formatDateTime(session.lastActiveAt)}</td>
                    <td>{formatDateTime(session.createdAt)}</td>
                    <td>
                      {session.current ? (
                        <span className={styles.mutedText}>当前设备不可移除</span>
                      ) : (
                        <button
                          className={styles.dangerButton}
                          type="button"
                          onClick={() => {
                            setSuccessMessage(null);
                            setPendingSession(session);
                          }}
                        >
                          移除会话
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className={`${styles.mobileOnly} ${styles.mobileCardList}`}>
          {filteredSessions.length === 0 ? (
            <div className={styles.emptyInlineState}>
              {sessions.length === 0 ? '暂无会话。' : '没有匹配状态的会话。'}
            </div>
          ) : (
            filteredSessions.map((session) => (
              <SessionMobileCard
                key={session.id}
                session={session}
                onRevoke={() => {
                  setSuccessMessage(null);
                  setPendingSession(session);
                }}
              />
            ))
          )}
        </div>
      </ManageSectionCard>

      <SensitiveActionDialog
        open={pendingSession !== null}
        actionKey="revoke-session"
        title={pendingSession ? `移除会话：${pendingSession.deviceName}` : ''}
        description="移除后目标设备会立即失去当前登录态。"
        impact={
          pendingSession
            ? `${pendingSession.userName} / ${pendingSession.clientName} / 最近活跃 ${formatDateTime(pendingSession.lastActiveAt)}`
            : undefined
        }
        confirmLabel="确认移除"
        onOpenChange={(open) => {
          if (!open) {
            setPendingSession(null);
          }
        }}
        onConfirm={(confirmation) => {
          if (!pendingSession) return;
          revokeMutation.mutate({
            sessionId: pendingSession.id,
            confirmation,
          });
        }}
        pending={revokeMutation.isPending}
      />
    </div>
  );
}

function SessionMobileCard({
  session,
  onRevoke,
}: {
  session: SessionRecord;
  onRevoke: () => void;
}) {
  return (
    <article className={styles.mobileRecordCard}>
      <div className={styles.mobileRecordHeader}>
        <div className={styles.stackText}>
          <strong className={styles.mobileRecordTitle}>{session.userName}</strong>
          <span className={styles.mobileRecordMeta}>{session.deviceName}</span>
        </div>
        <StatusBadge
          label={
            session.status === 'active'
              ? '活跃'
              : session.status === 'idle'
                ? '空闲'
                : session.status === 'revoked'
                  ? '已移除'
                  : '已过期'
          }
          variant={getManageStatusVariant(session.status)}
        />
      </div>
      <div className={styles.mobileRecordGrid}>
        <span>客户端</span>
        <strong>{session.clientName}</strong>
        <span>来源</span>
        <strong>{[session.clientHeader, session.ipAddress].filter(Boolean).join(' · ') || '—'}</strong>
        <span>最近活跃</span>
        <strong>{formatDateTime(session.lastActiveAt)}</strong>
        <span>创建时间</span>
        <strong>{formatDateTime(session.createdAt)}</strong>
      </div>
      <div className={styles.mobileRecordActions}>
        {session.current ? (
          <span className={styles.mutedText}>当前设备不可移除</span>
        ) : (
          <button className={styles.dangerButton} type="button" onClick={onRevoke}>
            移除会话
          </button>
        )}
      </div>
    </article>
  );
}

export default ManageSessionsPage;
