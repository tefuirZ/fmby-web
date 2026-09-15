import { Link, useParams } from 'react-router';
import { FeedbackState } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { usePersonDetail } from '@fmby/v2-shared/viewmodels';
import styles from './styles/shared.module.css';
import detailStyles from './styles/detail.module.css';

/**
 * 人物合集页 `/people/:personId`（V1F-10）。
 *
 * V1 对位：`apps/web/src/pages/browse/PersonDetailPage.tsx`（人物信息 + 相关作品）。
 * 本实现沿用 WEB-B1 的「调 viewmodel + 渲染」模式，不直接 useQuery。
 *
 * ★ 已知边界：作品列表为**单页硬上限**（后端端口无 keyset 游标），故无
 * 「加载更多」交互——不伪造翻页能力（详见 viewmodel 注释与 handoff）。
 */
export function PersonDetailPage() {
  const { personId } = useParams();
  const { data: vm, state, error, actions } = usePersonDetail({ personId });
  const { person, items, total } = vm;

  if (!personId) {
    return (
      <FeedbackState
        variant="error"
        title="人物不存在"
        description="当前链接缺少人物标识。"
        action={
          <Link className={styles.primaryButton} to="/">
            返回首页
          </Link>
        }
      />
    );
  }

  if (state === 'loading') {
    return (
      <FeedbackState
        variant="loading"
        title="正在加载人物合集"
        description="正在整理人物资料和相关作品。"
      />
    );
  }

  if (state === 'error' || state === 'forbidden') {
    return (
      <FeedbackState
        variant="error"
        title={state === 'forbidden' ? '没有查看该人物的权限' : '人物合集加载失败'}
        description={getErrorMessage(error)}
        action={
          <button className={styles.primaryButton} type="button" onClick={actions.retry}>
            重试
          </button>
        }
      />
    );
  }

  if (!person) {
    return (
      <FeedbackState
        variant="empty"
        title="人物资料暂不可用"
        description="没有读取到人物资料，请从媒体详情页重新进入。"
        action={
          <Link className={styles.primaryButton} to="/">
            返回首页
          </Link>
        }
      />
    );
  }

  const initials = person.name.trim().slice(0, 1) || '人';

  return (
    <div className={styles.page}>
      <section className={detailStyles.detailInfoCard}>
        <div className={styles.pageHeader}>
          <div className={styles.pageTitle}>{person.name}</div>
        </div>
        <div className={detailStyles.peopleSectionBody}>
          <div className={detailStyles.personCard}>
            <div className={detailStyles.personAvatar}>
              {person.posterUrl ? (
                <img
                  className={detailStyles.personAvatarImage}
                  src={`/api/assets/${person.posterUrl}`}
                  alt={person.name}
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <div className={detailStyles.personText}>
              <strong className={detailStyles.personName}>{person.name}</strong>
              <span className={detailStyles.personRole}>{total} 个相关作品</span>
            </div>
          </div>
        </div>
      </section>

      {items.length === 0 ? (
        <FeedbackState
          variant="empty"
          title="还没有关联作品"
          description="这个人物暂时没有当前用户可见的关联作品。"
        />
      ) : (
        <section className={detailStyles.detailInfoCard}>
          <h2 className={styles.sectionTitle}>相关作品</h2>
          <div className={styles.emptyGrid}>
            {items.map((item) => (
              <Link
                key={item.id}
                className={styles.primaryButton}
                to={`/item/${item.id}`}
                aria-label={`查看 ${item.title}`}
              >
                {item.title}
                {item.year ? `（${item.year}）` : ''}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
