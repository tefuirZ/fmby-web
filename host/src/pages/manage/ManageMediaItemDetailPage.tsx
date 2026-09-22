import { Link, useParams } from 'react-router';
import { ArrowLeft, RefreshCw, ScanLine } from 'lucide-react';
import { FeedbackState, InlineBanner, useToast } from '@fmby/v2-shared/ui';
import { formatDateTime, formatRelativeTime } from '@fmby/v2-shared/time';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import sharedStyles from './ManagePages.module.css';
import { ManagePageHeader } from './components';
import {
  useManageMediaItemDetailQuery,
  useManageMediaItemMetadataMutations,
  useManageMediaItemPipelineQuery,
} from './media-items/hooks';
import styles from './media-item-detail/MediaItemDetail.module.css';
import {
  MediaItemArtworkSection,
  MediaItemDangerZoneSection,
  MediaItemIdentityGovernancePanel,
  MediaItemMetadataSection,
  MediaItemOverviewSection,
  MediaItemPipelineSection,
  MediaItemSourcesSection,
  MediaItemSubtitleSection,
} from './media-item-detail/components';

/** 资源列表页地址，详情页的所有回退入口都指向这里。 */
const MEDIA_ITEMS_PATH = '/manage/media/items';

function BackToListLink() {
  return (
    <div className={styles.backRow}>
      <Link className={styles.backLink} to={MEDIA_ITEMS_PATH}>
        <ArrowLeft size={14} />
        返回资源列表
      </Link>
    </div>
  );
}

/**
 * 管理端「媒体资源详情」。
 *
 * 一条资源在管理端的全部可操作面都收在这一页：基础信息与封面、元数据编辑、
 * 数据源与技术规格、图片资产、外挂字幕、元数据流水线、危险操作。
 *
 * 结构上刻意保持「容器只管数据、段落只管呈现」：
 *   - 详情与流水线各一个查询，流水线在有任务运行时由 hook 自行转成轮询；
 *   - 所有写操作共用同一份 `useManageMediaItemMetadataMutations`，
 *     缓存失效只在那一处定义，段落不自己拼请求也不自己失效缓存。
 */
export function ManageMediaItemDetailPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const { toast } = useToast();

  const detailQuery = useManageMediaItemDetailQuery(itemId);
  const pipelineQuery = useManageMediaItemPipelineQuery(itemId);
  const mutations = useManageMediaItemMetadataMutations(itemId);

  const detail = detailQuery.data;

  const handleScan = () => {
    mutations.scanMutation.mutate(undefined, {
      onSuccess: (result) => {
        toast.success({
          title: '已提交重新扫描',
          description:
            result.message?.trim() ||
            '服务端会重新读取源文件并刷新可用性与技术信息。',
        });
      },
      onError: (error) => {
        toast.error({
          title: '重新扫描提交失败',
          description: getErrorMessage(error),
        });
      },
    });
  };

  const handleReload = () => {
    void detailQuery.refetch();
    void pipelineQuery.refetch();
  };

  if (!itemId) {
    return (
      <div className={sharedStyles.page}>
        <BackToListLink />
        <FeedbackState
          action={
            <Link className={sharedStyles.primaryButton} to={MEDIA_ITEMS_PATH}>
              返回资源列表
            </Link>
          }
          description="当前地址里没有携带资源编号，请从资源列表重新进入。"
          title="缺少资源编号"
          variant="error"
        />
      </div>
    );
  }

  if (detailQuery.isPending && !detail) {
    return (
      <div className={sharedStyles.page}>
        <BackToListLink />
        <FeedbackState
          description="正在读取资源身份、元数据、数据源与图片字幕资产。"
          title="正在加载资源详情"
          variant="loading"
        />
      </div>
    );
  }

  if (detailQuery.isError && !detail) {
    return (
      <div className={sharedStyles.page}>
        <BackToListLink />
        <FeedbackState
          action={
            <div className={sharedStyles.buttonRow}>
              <button
                className={sharedStyles.primaryButton}
                type="button"
                onClick={() => detailQuery.refetch()}
              >
                重试
              </button>
              <Link className={sharedStyles.secondaryButton} to={MEDIA_ITEMS_PATH}>
                返回资源列表
              </Link>
            </div>
          }
          description={getErrorMessage(detailQuery.error)}
          title="资源详情加载失败"
          variant="error"
        />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className={sharedStyles.page}>
        <BackToListLink />
        <FeedbackState
          action={
            <Link className={sharedStyles.primaryButton} to={MEDIA_ITEMS_PATH}>
              返回资源列表
            </Link>
          }
          description="这条资源可能已经被移除，或者当前账号没有查看权限。"
          title="找不到这条资源"
          variant="empty"
        />
      </div>
    );
  }

  const { item } = detail;
  const headerMeta = [
    item.libraryName,
    item.typeLabel,
    item.year !== undefined ? `${item.year} 年` : undefined,
    item.seriesTitle,
    item.seasonTitle,
  ]
    .filter((entry): entry is string => Boolean(entry && entry.trim() !== ''))
    .join(' · ');

  return (
    <div className={sharedStyles.page}>
      <BackToListLink />

      <ManagePageHeader
        title={item.title}
        description={
          item.originalTitle?.trim()
            ? `原始标题：${item.originalTitle}`
            : '这条资源没有记录原始标题，可在下方元数据编辑中补充。'
        }
        meta={
          <>
            <span className={sharedStyles.metaText}>{headerMeta}</span>
            <span className={sharedStyles.metaText}>
              更新于 {formatRelativeTime(item.updatedAt)}
            </span>
            <span className={sharedStyles.metaText}>
              最近扫描 {formatDateTime(item.lastScanAt)}
            </span>
          </>
        }
        actions={
          <>
            <button
              className={sharedStyles.secondaryButton}
              disabled={mutations.scanMutation.isPending}
              type="button"
              onClick={handleScan}
            >
              <ScanLine size={16} />
              {mutations.scanMutation.isPending ? '提交中…' : '重新扫描'}
            </button>
            <button
              className={sharedStyles.secondaryButton}
              disabled={detailQuery.isFetching}
              type="button"
              onClick={handleReload}
            >
              <RefreshCw size={16} />
              {detailQuery.isFetching ? '刷新中…' : '刷新数据'}
            </button>
          </>
        }
      />

      {detailQuery.isError ? (
        <InlineBanner
          description={getErrorMessage(detailQuery.error)}
          title="刷新资源详情失败，当前显示的是上一次成功读取的数据"
          variant="warning"
        />
      ) : null}

      {item.metadataErrorMessage ? (
        <InlineBanner
          description={item.metadataErrorMessage}
          title="元数据存在异常"
          variant="error"
        />
      ) : null}

      <MediaItemOverviewSection detail={detail} />

      {/* key 绑定资源编号：在两条资源之间切换时强制重建表单，避免草稿串台 */}
      <MediaItemMetadataSection detail={detail} key={item.id} mutations={mutations} />

      <MediaItemSourcesSection mutations={mutations} sources={detail.sources} />

      <MediaItemArtworkSection detail={detail} mutations={mutations} />

      <MediaItemSubtitleSection
        mutations={mutations}
        subtitles={detail.subtitleOverrides}
      />

      <MediaItemPipelineSection mutations={mutations} pipelineQuery={pipelineQuery} />

      <MediaItemIdentityGovernancePanel detail={detail} mutations={mutations} />

      <MediaItemDangerZoneSection detail={detail} mutations={mutations} />
    </div>
  );
}

export default ManageMediaItemDetailPage;
