import { Link } from 'react-router';
import type { ItemDetailResponse } from '@fmby/v2-shared/contracts/browse/item';
import detailStyles from '../../styles/detail.module.css';
import sharedStyles from '../../styles/shared.module.css';

interface ItemDetailAdminShortcutsProps {
  item: ItemDetailResponse;
}

export function ItemDetailAdminShortcuts({ item }: ItemDetailAdminShortcutsProps) {
  if (item.adminShortcuts.length === 0) {
    return null;
  }

  return (
    <section className={detailStyles.detailInfoCard}>
      <h2 className={sharedStyles.sectionTitle}>管理员快捷入口</h2>
      <div className={detailStyles.detailShortcuts}>
        {item.adminShortcuts.map((shortcut) => (
          <Link key={`${shortcut.label}-${shortcut.to}`} className={sharedStyles.secondaryButton} to={shortcut.to}>
            {shortcut.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
