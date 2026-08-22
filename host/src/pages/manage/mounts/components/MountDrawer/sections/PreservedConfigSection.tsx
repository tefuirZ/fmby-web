import { ManageSectionCard } from '../../../../components';
import styles from '../../../../ManagePages.module.css';

interface PreservedConfigSectionProps {
  preservedConfig: Record<string, unknown>;
  title: string;
  description: string;
}

export function PreservedConfigSection({
  preservedConfig,
  title,
  description,
}: PreservedConfigSectionProps) {
  if (Object.keys(preservedConfig).length === 0) {
    return null;
  }

  return (
    <ManageSectionCard title={title} description={description}>
      <pre className={styles.jsonBlock}>
        {JSON.stringify(preservedConfig, null, 2)}
      </pre>
    </ManageSectionCard>
  );
}
