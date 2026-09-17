/** 元数据来源对照 + 原始文本（V1F 拆分：MediaItemMetadataSection → 子组件）。 */

import type { ManageMediaItemDetailRecord, ManageMediaItemMetadataRecord } from '@fmby/v2-shared/contracts/manage/media-items';
import { formatDateTime } from '@fmby/v2-shared/time';
import sharedStyles from '../../ManagePages.module.css';
import {
  EM_DASH,
  formatList,
  formatOperator,
  formatOptional,
  formatRating,
  getMetadataSourceTypeLabel,
} from '../formatters';
import styles from '../MediaItemDetail.module.css';

/** 元数据来源对照卡：把「文件里的」「刮削来的」「人工改的」三份摊开对比。 */
export function MetadataSourceCard({
  title,
  caption,
  metadata,
}: {
  title: string;
  caption: string;
  metadata?: ManageMediaItemMetadataRecord;
}) {
  return (
    <div className={sharedStyles.detailCard}>
      <span className={sharedStyles.detailCardLabel}>{title}</span>
      <span className={sharedStyles.detailCardValue}>
        {metadata ? formatOptional(metadata.title) : '未提供'}
      </span>
      <span className={sharedStyles.metaText}>{caption}</span>
      {metadata ? (
        <span className={sharedStyles.metaText}>
          {formatOptional(metadata.year)} · 评分 {formatRating(metadata.communityRating)} ·{' '}
          {formatList(metadata.genres)}
        </span>
      ) : null}
    </div>
  );
}

interface MetadataSourcePanelProps {
  detail: ManageMediaItemDetailRecord;
  showRawContent: boolean;
  onToggleRawContent: () => void;
}

export function MetadataSourcePanel({
  detail,
  showRawContent,
  onToggleRawContent,
}: MetadataSourcePanelProps) {
  const metadataState = detail.metadataStatus;
  const localOverride = detail.localMetadataOverride;
  return (
    <>
        <div className={sharedStyles.stackText}>
          <span className={styles.kicker}>元数据来源</span>
          <div className={sharedStyles.detailSummaryGrid}>
            <MetadataSourceCard
              caption="扫描时从文件与目录结构推导出的基础值"
              metadata={detail.baseMetadata}
              title="原始识别结果"
            />
            <MetadataSourceCard
              caption={
                detail.remoteMetadata
                  ? `${getMetadataSourceTypeLabel(detail.remoteMetadata.sourceType)} · 解析于 ${formatDateTime(detail.remoteMetadata.parsedAt)}`
                  : '当前没有随文件的外部元数据'
              }
              metadata={detail.remoteMetadata?.metadata}
              title="外部元数据"
            />
            <MetadataSourceCard
              caption={
                detail.scrapedMetadata
                  ? '来自刮削源的快照，仅在身份绑定生效时返回'
                  : '尚未产生刮削结果'
              }
              metadata={detail.scrapedMetadata}
              title="刮削结果"
            />
            <MetadataSourceCard
              caption={
                localOverride
                  ? `由 ${formatOperator(localOverride.updatedByDisplayName, localOverride.updatedByUsername, localOverride.updatedBy)} 于 ${formatDateTime(localOverride.updatedAt)} 保存`
                  : '尚未写入任何本地覆盖'
              }
              metadata={localOverride?.metadata}
              title="本地覆盖"
            />
          </div>
          <span className={styles.sectionNote}>
            解析时间 {formatDateTime(metadataState.parsedAt)}，状态更新于{' '}
            {formatDateTime(metadataState.updatedAt)}。外部元数据
            {metadataState.hasRemoteMetadata ? '存在' : '缺失'}，本地覆盖
            {metadataState.hasLocalOverride ? '已写入' : '未写入'}。
          </span>
        </div>
        {detail.latestMetadataRawContent ? (
          <div className={sharedStyles.stackText}>
            <div className={styles.rawToggleRow}>
              <span className={styles.kicker}>原始元数据文本</span>
              <button
                className={sharedStyles.smallButton}
                type="button"
                onClick={() => onToggleRawContent()}
              >
                {showRawContent ? '收起' : '展开查看'}
              </button>
              <span className={sharedStyles.metaText}>
                共 {detail.latestMetadataRawContent.length.toLocaleString('zh-CN')} 个字符
              </span>
            </div>
            {showRawContent ? (
              <pre className={sharedStyles.jsonBlock}>{detail.latestMetadataRawContent}</pre>
            ) : null}
          </div>
        ) : (
        <span className={styles.sectionNote}>
          服务端没有保留这条资源的原始元数据文本，可展示的内容为 {EM_DASH}。
        </span>
      )}
    </>
  );
}
