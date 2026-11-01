import { Link } from 'react-router';
import { safeInAppPath } from '@fmby/v2-shared/utils/safe-url';
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
        {/* ★安全兜底（2026-11-01 评审 F1）：映射层已白名单，这里再校验一次 ——
            sink 自身不依赖上游是否正确（`to` 非法 ⇒ 不渲染该条，而不是渲染死链）。 */}
        {item.adminShortcuts.map((shortcut) => {
          const to = safeInAppPath(shortcut.to);
          if (!to) return null;
          return (
            <Link key={`${shortcut.label}-${to}`} className={sharedStyles.secondaryButton} to={to}>
              {shortcut.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
