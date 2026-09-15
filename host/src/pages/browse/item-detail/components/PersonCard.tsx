import { Link } from 'react-router';
import type { ItemDetailResponse } from '@fmby/v2-shared/contracts/browse/item';
import styles from '../../styles/detail.module.css';

interface PersonCardProps {
  person: ItemDetailResponse['actors'][number];
}

/**
 * 人物卡（V1F-10）。
 *
 * V1 对位：`ItemDetailPeopleSection` 内有 id 的人物渲染为 `<Link to="/people/{id}">`
 * （V1 行为）。V2 此前该卡为**惰性 div**——条目详情点不了人物，正是本卡要通的链路。
 *
 * 无 id 的人物（V2 未写入 `catalog_person` 的裸记录）退化为不可点 div：
 * **不拼 `/people/undefined`**（不产生坏链接）。
 */
export function PersonCard({ person }: PersonCardProps) {
  const initials = person.name.trim().slice(0, 1) || '人';
  const content = (
    <div className={styles.personCard}>
      <div className={styles.personAvatar}>
        {person.thumbUrl ? (
          <img className={styles.personAvatarImage} src={person.thumbUrl} alt={person.name} />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      <div className={styles.personText}>
        <strong className={styles.personName}>{person.name}</strong>
        <span className={styles.personRole}>{person.role || '主创成员'}</span>
      </div>
    </div>
  );

  if (!person.id) {
    return content;
  }

  return (
    <Link
      to={`/people/${person.id}`}
      aria-label={`查看 ${person.name} 的相关作品`}
      className={styles.personCardLink}
    >
      {content}
    </Link>
  );
}
