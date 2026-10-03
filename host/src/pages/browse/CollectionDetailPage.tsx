import { Link, useParams } from 'react-router';
import { FeedbackState } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { useCollectionDetail } from '@fmby/v2-shared/viewmodels';
import styles from './styles/shared.module.css';

/**
 * 用户面合集详情页（FE-USER-COLLECTIONS-BROWSE）。
 *
 * 数据面：`GET /api/collections/{id}`（session + BROWSE；Active 可见性闸）。
 * Hidden 合集后端返回 404 ⇒ 本页**诚实**按「不存在或不可见」呈现，不伪造数据、
 * 不回落占位图；成员为空给诚实空态。
 */
export function CollectionDetailPage() {
  const { collectionId } = useParams<{ collectionId: string }>();
  const { data, state, error, actions } = useCollectionDetail({ collectionId });
  const { collection, members, totalMembers } = data;

  if (state === 'loading') {
    return (
      <FeedbackState
        variant="loading"
        title="正在加载合集"
        description="正在读取这个合集的条目。"
      />
    );
  }

  if (state === 'forbidden') {
    return (
      <FeedbackState
        variant="error"
        title="没有访问该合集的权限"
        description={getErrorMessage(error)}
      />
    );
  }

  if (state === 'error' || !collection) {
    return (
      <FeedbackState
        variant="error"
        title="合集不存在或不可见"
        description={getErrorMessage(error)}
        action={
          <button className={styles.primaryButton} type="button" onClick={actions.refresh}>
            重试
          </button>
        }
      />
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <div className={styles.eyebrow}>Collection</div>
          <h1 className={styles.pageTitle}>{collection.title}</h1>
          {collection.overview ? (
            <p className={styles.pageDescription}>{collection.overview}</p>
          ) : null}
        </div>
        <div className={styles.headerActions}>
          <Link className={styles.secondaryButton} to="/collections">
            返回合集列表
          </Link>
          <button className={styles.secondaryButton} type="button" onClick={actions.refresh}>
            刷新
          </button>
        </div>
      </header>

      <div className={styles.activeFilterRow}>
        <span className={styles.filterChip}>条目 {totalMembers}</span>
      </div>

      {members.length === 0 ? (
        <FeedbackState
          variant="empty"
          title="这个合集还没有条目"
          description="合集尚未加入任何条目，等它充实起来再来看。"
        />
      ) : (
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>合集条目</h2>
            <p className={styles.sectionDescription}>共 {totalMembers} 个条目</p>
          </div>
          <ul className={styles.mediaRail}>
            {members.map((member) => (
              <li key={member.id} className={styles.posterRailItem}>
                <strong>{member.titleSnapshot}</strong>
                {member.yearSnapshot ? (
                  <span className={styles.metaText}>{member.yearSnapshot}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}