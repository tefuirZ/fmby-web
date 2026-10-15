import { useRef } from 'react';
import type { ManageMediaItemDetailRecord } from '@fmby/v2-shared/contracts/manage/media-items';
import { StatusBadge } from '@fmby/v2-shared/ui';
import { formatDateTime } from '@fmby/v2-shared/time';
import sharedStyles from '../../ManagePages.module.css';
import { formatOptional } from '../formatters';
import styles from '../MediaItemDetail.module.css';
import { useTableRowRoving } from '../../../../features/a11y/useTableRowRoving';

interface RemoteAssetsTableProps {
  remoteAssets: ManageMediaItemDetailRecord['remoteAssets'];
}

/** 「随文件资源」表：跟着媒体文件一起躺在挂载点上的图，只读。 */
export function RemoteAssetsTable({ remoteAssets }: RemoteAssetsTableProps) {
  // FE-LIST-KEYNAV-10：「随文件资源」表。行内有「打开」链接（原生 Tab 可达）
  // ⇒ 不传 onActivate，不凭空给行加 Enter 语义。
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  useTableRowRoving({ tbodyRef, rowCount: remoteAssets.length });
  return (
    <div className={sharedStyles.stackText}>
      <span className={styles.kicker}>随文件资源</span>
      {remoteAssets.length === 0 ? (
        <div className={sharedStyles.emptyInlineState}>
          挂载点上没有发现与这条资源同名的图片或附属文件。
        </div>
      ) : (
        <div className={sharedStyles.tableWrap} role="region" aria-label="随文件资源（可横向滚动）">
          <table className={sharedStyles.table}>
            <thead>
              <tr>
                <th>资源类型</th>
                <th>所在挂载</th>
                <th>文件路径</th>
                <th>缓存状态</th>
                <th>接入时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody ref={tbodyRef}>
              {remoteAssets.map((asset, index) => (
                <tr key={asset.id} data-row-index={index}>
                  <td>
                    <div className={sharedStyles.stackText}>
                      <span className={sharedStyles.primaryText}>
                        {asset.assetTypeLabel}
                      </span>
                      <span className={sharedStyles.mutedText}>
                        语言 {formatOptional(asset.language)}
                      </span>
                    </div>
                  </td>
                  <td>{formatOptional(asset.mountName)}</td>
                  <td>
                    <span className={sharedStyles.mono}>{asset.filePath}</span>
                  </td>
                  <td>
                    <StatusBadge
                      label={asset.isCached ? '已缓存' : '未缓存'}
                      variant={asset.isCached ? 'success' : 'neutral'}
                    />
                    {asset.cachePath ? (
                      <div className={sharedStyles.mutedText}>{asset.cachePath}</div>
                    ) : null}
                  </td>
                  <td>{formatDateTime(asset.createdAt)}</td>
                  <td>
                    <a
                      className={sharedStyles.smallButton}
                      href={asset.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      打开
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
