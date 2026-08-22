/**
 * 设置中心共享组件与数据 hook（暗房皮肤）
 *
 * 数据逻辑（useEditableSettings）从旧 UI src/pages/settings/components.tsx 原样移植，
 * 仅追加 toast 反馈与 7 状态解析；视觉层全部重写。
 */
import * as React from 'react';
import type { ReactNode } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseQueryResult,
} from '@tanstack/react-query';
import { Button, FeedbackState, useToast } from '@/shared/ui';
import { isApiError } from '@/shared/types';
import { getErrorMessage } from '@/shared/utils/error';
import styles from './SettingsCenter.module.css';

export function SettingsPageHeader({
  title,
  description,
  meta,
}: {
  title: string;
  description: string;
  meta?: ReactNode;
}) {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.pageHeaderContent}>
        <div className={styles.pageEyebrow}>设置中心</div>
        <h1 className={styles.pageTitle}>{title}</h1>
        <p className={styles.pageDescription}>{description}</p>
      </div>
      {meta ? <div className={styles.pageMeta}>{meta}</div> : null}
    </header>
  );
}

export function SettingsSectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {description ? <p className={styles.sectionDescription}>{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

interface EditableSettingsOptions<T> {
  queryKey: QueryKey;
  load: () => Promise<T>;
  save: (draft: T) => Promise<T | void>;
  successMessage: string;
}

export function useEditableSettings<T>({
  queryKey,
  load,
  save,
  successMessage,
}: EditableSettingsOptions<T>) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const query = useQuery({
    queryKey,
    queryFn: load,
  });
  const [draft, setDraft] = React.useState<T | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (query.data) {
      setDraft(query.data);
    }
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: async (nextDraft: T) => {
      const response = await save(nextDraft);
      return (response ?? nextDraft) as T;
    },
    onSuccess: (response) => {
      queryClient.setQueryData(queryKey, response);
      setDraft(response);
      setSuccess(successMessage);
      toast.success({ title: successMessage });
    },
    onError: (error) => {
      toast.error({ title: '保存失败', description: getErrorMessage(error) });
    },
  });

  const isDirty =
    query.data !== undefined &&
    draft !== null &&
    JSON.stringify(query.data) !== JSON.stringify(draft);

  return {
    query,
    draft,
    setDraft,
    isDirty,
    success,
    setSuccess,
    mutation,
    reset() {
      if (query.data) {
        setDraft(query.data);
      }
    },
    save() {
      if (draft) {
        mutation.mutate(draft);
      }
    },
  };
}

export function StickySaveBar({
  dirty,
  pending,
  success,
  onReset,
  onSave,
}: {
  dirty: boolean;
  pending: boolean;
  success?: string | null;
  onReset: () => void;
  onSave: () => void;
}) {
  if (!dirty && !success) {
    return null;
  }

  return (
    <div className={styles.stickyBar}>
      <div className={styles.stickyText}>
        <strong>{dirty ? '有未保存修改' : '设置已保存'}</strong>
        <div className={styles.stickyHint}>
          {dirty ? '当前页按分组保存，保存成功前会保留脏状态。' : success}
        </div>
      </div>
      {dirty ? (
        <div className={styles.stickyActions}>
          <Button variant="ghost" onClick={onReset}>
            放弃修改
          </Button>
          <Button variant="primary" loading={pending} onClick={onSave}>
            保存设置
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 7 状态解析：loading / empty / error / forbidden / unauthorized /     */
/* partial / outdated                                                   */
/* ------------------------------------------------------------------ */

export type SettingsQueryState =
  | 'ready'
  | 'loading'
  | 'empty'
  | 'error'
  | 'forbidden'
  | 'unauthorized'
  | 'partial'
  | 'outdated';

function resolveErrorState(error: unknown): 'forbidden' | 'unauthorized' | 'error' {
  if (isApiError(error)) {
    if (error.code === 'HTTP_403' || error.code === 'FORBIDDEN') return 'forbidden';
    if (
      error.code === 'HTTP_401' ||
      error.code === 'UNAUTHORIZED' ||
      error.code === 'AUTH_EXPIRED'
    ) {
      return 'unauthorized';
    }
  }
  return 'error';
}

export function resolveSettingsQueryState<T>(
  query: UseQueryResult<T>,
  draft: T | null,
): SettingsQueryState {
  if (query.isError) {
    const errorState = resolveErrorState(query.error);
    // 有旧数据兜底时，鉴权类错误仍需拦截，普通失败降级为“过期数据”提示
    if (errorState === 'error' && draft !== null) return 'outdated';
    return errorState;
  }
  if (query.isPending || draft === null) return 'loading';
  if (
    query.data !== undefined &&
    typeof query.data === 'object' &&
    query.data !== null &&
    Object.keys(query.data as object).length === 0
  ) {
    return 'empty';
  }
  if (query.isFetching) return 'partial';
  return 'ready';
}

/** 阻断型状态（loading/empty/error/forbidden/unauthorized）统一渲染。 */
export function SettingsFeedbackGate({
  state,
  scopeLabel,
  error,
  onRetry,
}: {
  state: SettingsQueryState;
  scopeLabel: string;
  error?: unknown;
  onRetry: () => void;
}) {
  switch (state) {
    case 'loading':
      return (
        <FeedbackState
          variant="loading"
          title={`正在加载${scopeLabel}`}
          description="正在同步最新配置，请稍候。"
        />
      );
    case 'empty':
      return (
        <FeedbackState
          variant="empty"
          title={`${scopeLabel}暂无数据`}
          description="服务端未返回可编辑的配置内容。"
          action={<Button variant="ghost" onClick={onRetry}>刷新</Button>}
        />
      );
    case 'forbidden':
      return (
        <FeedbackState
          variant="warning"
          title="没有访问权限"
          description={`当前账号无权查看${scopeLabel}，请联系管理员开通站点管理能力。`}
        />
      );
    case 'unauthorized':
      return (
        <FeedbackState
          variant="warning"
          title="登录状态已失效"
          description="会话已过期或未登录，请重新登录后再访问设置中心。"
        />
      );
    case 'error':
      return (
        <FeedbackState
          variant="error"
          title={`${scopeLabel}加载失败`}
          description={getErrorMessage(error)}
          action={
            <Button variant="primary" onClick={onRetry}>
              重试
            </Button>
          }
        />
      );
    default:
      return null;
  }
}
