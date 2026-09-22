/**
 * 开放 API 端点目录（FE-PARITY-DEVELOPER-ENDPOINTS）。
 *
 * ★诚实边界：后端 `items` 是 `serde_json::Value`，本卡**未实测**其内部结构，
 *   因此这里**不猜列名**，用 JSON 块原样呈现 + 提供筛选/分页；
 *   待结构确认后再改成具名列表。
 *
 * 端口未装配（后端 "API 令牌服务未装配…"）→ 原样呈现错误文案，不吞成空目录。
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { developerApi } from '@fmby/v2-shared/contracts/manage/developerApi';
import { queryKeys } from '@fmby/v2-shared/query';
import { FeedbackState, InlineBanner } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from '@/pages/manage/longtail-shared/ManageShared.module.css';
import { ManageSectionCard } from '@/pages/manage/longtail-shared/components';

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

export function DeveloperEndpointsSection() {
  const [method, setMethod] = useState('');
  const [scope, setScope] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);

  const queryKey = JSON.stringify({ method, scope, q: keyword, page, pageSize });

  const catalogQuery = useQuery({
    queryKey: queryKeys.manage.developerApi.endpoints(queryKey),
    queryFn: () =>
      developerApi.listEndpoints({
        method: method.trim() || undefined,
        scope: scope.trim() || undefined,
        q: keyword.trim() || undefined,
        page,
        pageSize,
      }),
  });

  const data = catalogQuery.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  if (catalogQuery.isPending) {
    return (
      <ManageSectionCard title="端点目录" description="按方法/作用域筛选开放 API 端点。">
        <div className={styles.tableHint}>正在加载端点目录…</div>
      </ManageSectionCard>
    );
  }

  if (catalogQuery.isError) {
    return (
      <ManageSectionCard title="端点目录" description="按方法/作用域筛选开放 API 端点。">
        <FeedbackState
          variant="error"
          title="端点目录读取失败"
          description={getErrorMessage(catalogQuery.error)}
          action={
            <button
              className={styles.primaryButton}
              type="button"
              onClick={() => void catalogQuery.refetch()}
            >
              重试
            </button>
          }
        />
      </ManageSectionCard>
    );
  }

  return (
    <ManageSectionCard
      title={`端点目录（共 ${data?.total ?? 0} 条）`}
      description="条目结构以 JSON 原样呈现；端口未装配时后端会直接给出未装配提示。"
    >
      <form
        className={styles.fieldGroup}
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          void catalogQuery.refetch();
        }}
      >
        <div className={styles.fieldRow}>
          <label className={styles.label}>
            HTTP 方法
            <select
              className={styles.select}
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="">全部</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>
          </label>
          <label className={styles.label}>
            作用域（scope）
            <input
              className={styles.input}
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="留空 = 全部"
            />
          </label>
          <label className={styles.label}>
            关键字
            <input
              className={styles.input}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="路径/描述关键字"
            />
          </label>
          <label className={styles.label}>
            每页
            <select
              className={styles.select}
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size} 条
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={styles.buttonRow}>
          <button className={styles.primaryButton} type="submit">
            应用筛选
          </button>
        </div>
      </form>

      {data && data.items.length === 0 ? (
        <div className={styles.emptyInlineState}>当前筛选条件下没有匹配的端点。</div>
      ) : null}

      {data && data.items.length > 0 ? (
        <>
          <pre className={styles.jsonBlock}>{JSON.stringify(data.items, null, 2)}</pre>
          <div className={styles.paginationBar}>
            <span className={styles.paginationLabel}>
              第 {data.page} / {totalPages} 页
            </span>
            <div className={styles.paginationActions}>
              <button
                className={styles.secondaryButton}
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                上一页
              </button>
              <button
                className={styles.secondaryButton}
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                下一页
              </button>
            </div>
          </div>
          <InlineBanner
            variant="info"
            title="条目结构尚未落到具名列"
            description="后端该数组目前写作通用 JSON，本页按原样呈现，未猜测字段名。确认结构后可改为具名表格。"
          />
        </>
      ) : null}
    </ManageSectionCard>
  );
}
