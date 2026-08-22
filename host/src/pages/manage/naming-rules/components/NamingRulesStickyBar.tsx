import { RotateCcw, Save } from 'lucide-react';
import sharedStyles from '../../longtail-shared/ManageShared.module.css';
import styles from '../../ManageNamingRulesPage.module.css';

export function NamingRulesStickyBar({
  isSaving,
  onReset,
  onSave,
}: {
  isSaving: boolean;
  onReset: () => void;
  onSave: () => void;
}) {
  return (
    <div className={sharedStyles.stickyBar}>
      <div className={styles.stickySummary}>
        <strong>{isSaving ? '正在保存规则…' : '有未保存的规则修改'}</strong>
        <span>
          保存后版本会刷新；后续扫描和手动重排会带着这套规则进指纹，但不会自动全库回灌。
        </span>
      </div>
      <div className={sharedStyles.buttonRow}>
        <button className={sharedStyles.ghostButton} onClick={onReset} type="button">
          <RotateCcw size={16} />
          放弃修改
        </button>
        <button className={sharedStyles.primaryButton} onClick={onSave} type="button">
          <Save size={16} />
          保存并生效
        </button>
      </div>
    </div>
  );
}
