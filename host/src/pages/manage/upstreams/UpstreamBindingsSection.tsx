import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { manageApi } from '@fmby/v2-shared/contracts/manage';
import {
  upstreamsApi,
  type UpstreamCategoryRecord,
} from '@fmby/v2-shared/contracts/manage/upstreams';
import { queryKeys } from '@fmby/v2-shared/query';
import { FeedbackState, InlineBanner, StatusBadge } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from '../longtail-shared/ManageShared.module.css';
import { EmptyTableRow, ManageSectionCard } from '../longtail-shared/components';
import { formatEpochMs } from './shared';

type BindScope = 'apple-cms' | 'emby';

const SCOPE_LABELS: Record<BindScope, string> = {
  'apple-cms': 'Apple CMS 分类',
  emby: 'Emby 媒体库',
};

/** 类别 / 媒体库发现与绑定（V1F-02 S2 + S3）。 */
export function UpstreamBindingsSection({ sourceId }: { sourceId: string }) {
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<BindScope>('apple-cms');
  const [banner, setBanner] = useState<string | null>(null);
  /** 类目 → 本地库 id 的草稿（未保存前只在本地）。 */
  const [draft, setDraft] = useState<Record<string, string>>({});

  const categoriesKey =
    scope === 'apple-cms'
      ? queryKeys.manage.upstreams.categories(sourceId)
      : queryKeys.manage.upstreams.libraries(sourceId);

  const categoriesQuery = useQuery({
    queryKey: categoriesKey,
    queryFn: () =>
      scope === 'apple-cms'
        ? upstreamsApi.listAppleCmsCategories(sourceId)
        : upstreamsApi.listEmbyLibraries(sourceId),
  });

  const librariesQuery = useQuery({
    queryKey: queryKeys.manage.libraries.list(),
    queryFn: () => manageApi.getLibraries(),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: categoriesKey });
    void queryClient.invalidateQueries({ queryKey: queryKeys.manage.upstreams.bindings() });
  };

  const discoverMutation = useMutation({
    mutationFn: () =>
      scope === 'apple-cms'
        ? upstreamsApi.discoverAppleCmsCategories(sourceId)
        : upstreamsApi.discoverEmbyLibraries(sourceId),
    onSuccess: (r) => {
      setBanner(`发现完成：共 ${r.items.length} 个${SCOPE_LABELS[scope].slice(-2)}。`);
      invalidate();
    },
    onError: (e) => setBanner(getErrorMessage(e)),
  });

  const replaceMutation = useMutation({
    mutationFn: (bindings: { categoryId: string; libraryId: string }[]) =>
      scope === 'apple-cms'
        ? upstreamsApi.replaceAppleCmsCategoryBindings(sourceId, bindings)
        : upstreamsApi.replaceEmbyLibraryBindings(sourceId, bindings),
    onSuccess: (r) => {
      setBanner(`绑定已保存：${r.items.length} 条。`);
      setDraft({});
      invalidate();
    },
    onError: (e) => setBanner(getErrorMessage(e)),
  });

  const items = categoriesQuery.data?.items ?? [];

  // 服务端数据回来后以它为草稿基线（避免脏草稿覆盖真实绑定）。
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const item of items) {
      if (item.libraryId) {
        next[item.id] = item.libraryId;
      }
    }
    setDraft(next);
  }, [items]);

  if (categoriesQuery.isPending) {
    return <FeedbackState variant="loading" title="正在加载类目" description="正在读取已发现的上游类目与当前绑定。" />;
  }

  if (categoriesQuery.isError) {
    return (
      <FeedbackState
        variant="error"
        title="类目加载失败"
        description={getErrorMessage(categoriesQuery.error)}
        action={
          <button className={styles.primaryButton} type="button" onClick={() => categoriesQuery.refetch()}>
            重试
          </button>
        }
      />
    );
  }

  const libraries = librariesQuery.data?.items ?? [];
  const dirtyCount = items.filter((i) => (draft[i.id] ?? '') !== (i.libraryId ?? '')).length;

  function saveBindings() {
    const bindings = items
      .filter((i) => (draft[i.id] ?? '').length > 0)
      .map((i) => ({ categoryId: i.id, libraryId: draft[i.id] }));
    replaceMutation.mutate(bindings);
  }

  return (
    <>
      {banner ? <InlineBanner variant="info" title={banner} description="操作结果。" /> : null}

      <ManageSectionCard
        title="类目与绑定"
        description={`先「发现」拉取上游${SCOPE_LABELS[scope]}，再逐项选择本地库。绑定保存为整表替换（未选中的会解除绑定）。`}
        actions={
          <>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => discoverMutation.mutate()}
              disabled={discoverMutation.isPending}
            >
              {discoverMutation.isPending ? '发现中…' : '发现'}
            </button>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={saveBindings}
              disabled={replaceMutation.isPending || dirtyCount === 0}
            >
              {replaceMutation.isPending ? '保存中…' : `保存绑定${dirtyCount > 0 ? `（${dirtyCount} 项改动）` : ''}`}
            </button>
          </>
        }
      >
        <div className={styles.toolbar}>
          <label className={styles.label}>
            范围
            <select
              className={styles.select}
              value={scope}
              onChange={(e) => setScope(e.target.value as BindScope)}
            >
              {(Object.keys(SCOPE_LABELS) as BindScope[]).map((s) => (
                <option key={s} value={s}>{SCOPE_LABELS[s]}</option>
              ))}
            </select>
          </label>
          <span className={styles.tableHint}>共 {items.length} 个类目</span>
        </div>

        {items.length === 0 ? (
          <div className={styles.emptyInlineState}>
            还没有已发现的类目，先点「发现」从上游拉取。
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>名称</th>
                  <th>上游 ID</th>
                  <th>当前绑定</th>
                  <th>绑定到</th>
                  <th>发现时间</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <CategoryRow
                    key={item.id}
                    item={item}
                    libraries={libraries.map((l) => ({ id: l.id, name: l.name }))}
                    value={draft[item.id] ?? ''}
                    onChange={(libraryId) => setDraft((d) => ({ ...d, [item.id]: libraryId }))}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ManageSectionCard>
    </>
  );
}

function CategoryRow({
  item,
  libraries,
  value,
  onChange,
}: {
  item: UpstreamCategoryRecord;
  libraries: { id: string; name: string }[];
  value: string;
  onChange: (libraryId: string) => void;
}) {
  const changed = value !== (item.libraryId ?? '');
  return (
    <tr>
      <td>{item.name}</td>
      <td className={styles.mono}>{item.upstreamCategoryId}</td>
      <td>
        {item.libraryName ? (
          <StatusBadge label={item.libraryName} variant="success" />
        ) : (
          <span className={styles.mutedText}>未绑定</span>
        )}
      </td>
      <td>
        <select
          className={styles.select}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`将 ${item.name} 绑定到本地库`}
        >
          <option value="">（不绑定）</option>
          {libraries.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        {changed ? <span className={styles.tableHint}> · 未保存</span> : null}
      </td>
      <td className="nowrap">{formatEpochMs(item.discoveredAt)}</td>
    </tr>
  );
}

/** 绑定总览（只读，按本页源列出当前生效绑定）。 */
export function UpstreamBindingsOverview({ sourceId }: { sourceId: string }) {
  const bindingsQuery = useQuery({
    queryKey: queryKeys.manage.upstreams.bindings(sourceId),
    queryFn: () => upstreamsApi.listBindings(sourceId),
  });

  return (
    <ManageSectionCard
      title="当前生效绑定"
      description="GET /api/manage/upstreams/{id}/bindings 只读总览。"
    >
      {bindingsQuery.isPending ? (
        <div className={styles.tableHint}>正在加载绑定…</div>
      ) : bindingsQuery.isError ? (
        <div className={styles.tableHint}>绑定加载失败：{getErrorMessage(bindingsQuery.error)}</div>
      ) : (bindingsQuery.data?.items ?? []).length === 0 ? (
        <div className={styles.emptyInlineState}>该源暂无绑定。</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>类目</th>
                <th>类型</th>
                <th>本地库</th>
                <th>更新时间</th>
              </tr>
            </thead>
            <tbody>
              {(bindingsQuery.data?.items ?? []).length === 0 ? (
                <EmptyTableRow colSpan={4} title="暂无绑定" description="" />
              ) : (
                (bindingsQuery.data?.items ?? []).map((b) => (
                  <tr key={b.id}>
                    <td>{b.name}</td>
                    <td>{b.kind}</td>
                    <td>{b.libraryName ?? '—'}</td>
                    <td className="nowrap">{formatEpochMs(b.updatedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </ManageSectionCard>
  );
}
