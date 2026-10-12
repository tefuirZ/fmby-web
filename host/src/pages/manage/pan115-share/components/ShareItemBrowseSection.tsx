import { useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { pan115Api } from '@fmby/v2-shared/contracts/manage/pan115';
import type {
  Pan115ShareBrowseRequest,
  Pan115ShareBrowseResponse,
} from '@fmby/v2-shared/contracts/manage/pan115';
import { ManageSectionCard } from '@/pages/manage/longtail-shared/components';
import { InlineBanner } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { useTableRowRoving } from '@/features/a11y/useTableRowRoving';
import styles from '@/pages/manage/longtail-shared/ManageShared.module.css';

function formatSize(size: number | null): string {
  if (size == null) return '—';
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function BrowseResultTable({ data }: { data: Pan115ShareBrowseResponse }) {
  // FE-LIST-KEYNAV-10：浏览结果是**纯只读清单**（行内无控件）⇒ 不传 onActivate。
  // ★hook 必须早于下面的空列表 early return（Hooks 规则）。
  const entriesTbodyRef = useRef<HTMLTableSectionElement>(null);
  useTableRowRoving({ tbodyRef: entriesTbodyRef, rowCount: data.entries.length });

  if (data.entries.length === 0) {
    return <p className={styles.mutedText}>该目录/分享下没有可列出的条目。</p>;
  }
  return (
    <div className={styles.tableWrap} role="region" aria-label="浏览结果（可横向滚动）" tabIndex={0}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">名称</th>
            <th scope="col">类型</th>
            <th scope="col">大小</th>
            <th scope="col">路径</th>
          </tr>
        </thead>
        <tbody ref={entriesTbodyRef}>
          {data.entries.map((e, index) => (
            <tr key={`${e.cid}:${e.path}`} data-row-index={index}>
              <td className={styles.cellText}>{e.name}</td>
              <td className={styles.mutedText}>{e.isDir ? '目录' : '文件'}</td>
              <td className={styles.mutedText}>{e.isDir ? '—' : formatSize(e.size)}</td>
              <td className={styles.mono}>{e.path}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 匿名浏览 115 分享目录（POST /api/manage/pan115/share-items/browse）。
 * fail-closed：端口未装配/凭证异常后端返回 503/500，前端必须透传错误码，不吞空。
 */
export function ShareItemBrowseSection() {
  const browseMutation = useMutation({
    mutationFn: (req: Pan115ShareBrowseRequest) => pan115Api.browseShareItem(req),
  });

  const isError = browseMutation.isError;
  const error = browseMutation.error;

  return (
    <ManageSectionCard
      title="分享项浏览（匿名）"
      description="凭分享码（可选提取码）浏览 115 分享目录，无需本机 115 凭据。"
    >
      <form
        className={styles.inlineForm}
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const shareCode = (form.elements.namedItem('shareCode') as HTMLInputElement).value.trim();
          const receiveCode = (form.elements.namedItem('receiveCode') as HTMLInputElement).value.trim();
          if (!shareCode) return;
          browseMutation.mutate({ shareCode, receiveCode: receiveCode || undefined });
        }}
      >
        <input
          className={styles.input}
          name="shareCode"
          placeholder="分享码（必填）"
          aria-label="115 分享码"
          disabled={browseMutation.isPending}
        />
        <input
          className={styles.input}
          name="receiveCode"
          placeholder="提取码（可选）"
          aria-label="115 提取码"
          disabled={browseMutation.isPending}
        />
        <button
          type="submit"
          className={styles.primaryButton}
          disabled={browseMutation.isPending}
        >
          {browseMutation.isPending ? '浏览中…' : '浏览分享'}
        </button>
      </form>

      {isError ? (
        <InlineBanner
          variant="error"
          title="浏览失败"
          description={getErrorMessage(error)}
        />
      ) : null}

      {browseMutation.isSuccess ? (
        <BrowseResultTable data={browseMutation.data} />
      ) : null}
    </ManageSectionCard>
  );
}
