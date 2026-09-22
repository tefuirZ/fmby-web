import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { pan115Api } from '@fmby/v2-shared/contracts/manage/pan115';
import type {
  Pan115PreviewBrowseRequest,
  Pan115ShareBrowseResponse,
} from '@fmby/v2-shared/contracts/manage/pan115';
import { ManageSectionCard } from '@/pages/manage/longtail-shared/components';
import { InlineBanner } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from '@/pages/manage/longtail-shared/ManageShared.module.css';

function formatSize(size: number | null): string {
  if (size == null) return '—';
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

/**
 * 用预览凭据浏览该账号自己的网盘目录（POST /api/manage/pan115/previews/{id}/browse）。
 * 支持按 cid / path 下钻；fail-closed：端口未装配后端 503，前端透传错误码。
 */
export function PreviewBrowseSection() {
  const [previewId, setPreviewId] = useState('');
  const [path, setPath] = useState('/');

  const browseMutation = useMutation({
    mutationFn: (req: Pan115PreviewBrowseRequest & { previewId: string }) =>
      pan115Api.browsePreview(req.previewId, { path: req.path }),
  });

  const data: Pan115ShareBrowseResponse | undefined = browseMutation.data;
  const isError = browseMutation.isError;
  const error = browseMutation.error;

  return (
    <ManageSectionCard
      title="预览凭据浏览（网盘目录）"
      description="使用分享下载预览凭据浏览该 115 账号挂载的网盘目录，支持按 cid / path 下钻。"
    >
      <form
        className={styles.inlineForm}
        onSubmit={(e) => {
          e.preventDefault();
          const pid = previewId.trim();
          if (!pid) return;
          browseMutation.mutate({ previewId: pid, path: path.trim() || '/' });
        }}
      >
        <input
          className={styles.input}
          value={previewId}
          onChange={(e) => setPreviewId(e.target.value)}
          placeholder="预览凭据 ID（preview_id）"
          aria-label="预览凭据 ID"
          disabled={browseMutation.isPending}
        />
        <input
          className={styles.input}
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="目录路径或 cid，缺省 /"
          aria-label="目录路径或 cid"
          disabled={browseMutation.isPending}
        />
        <button
          type="submit"
          className={styles.primaryButton}
          disabled={browseMutation.isPending || !previewId.trim()}
        >
          {browseMutation.isPending ? '浏览中…' : '浏览目录'}
        </button>
      </form>

      {isError ? (
        <InlineBanner
          variant="error"
          title="浏览失败"
          description={getErrorMessage(error)}
        />
      ) : null}

      {browseMutation.isSuccess && data ? (
        data.entries.length === 0 ? (
          <p className={styles.mutedText}>该目录下没有可列出的条目。</p>
        ) : (
          <div className={styles.tableWrap} role="region" aria-label="网盘目录浏览结果（可横向滚动）" tabIndex={0}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">名称</th>
                  <th scope="col">类型</th>
                  <th scope="col">大小</th>
                  <th scope="col">cid</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((e) => (
                  <tr key={`${e.cid}:${e.path}`}>
                    <td className={styles.cellText}>{e.name}</td>
                    <td className={styles.mutedText}>{e.isDir ? '目录' : '文件'}</td>
                    <td className={styles.mutedText}>{e.isDir ? '—' : formatSize(e.size)}</td>
                    <td className={styles.mono}>{e.cid}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </ManageSectionCard>
  );
}
