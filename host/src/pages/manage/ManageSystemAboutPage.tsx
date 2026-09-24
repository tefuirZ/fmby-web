import { useQuery } from '@tanstack/react-query';
import {
  isSystemAboutUnwiredError,
  systemAboutApi,
  systemDependencyStatusLabel,
  type SystemAboutResponse,
} from '@fmby/v2-shared/contracts/manage/system-about';
import { queryKeys } from '@fmby/v2-shared/query';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from './longtail-shared/ManageShared.module.css';
import { ManagePageHeader, ManageSectionCard } from './longtail-shared/components';

function formatGeneratedAt(rfc3339: string): string {
  const t = new Date(rfc3339);
  return Number.isNaN(t.getTime()) ? rfc3339 : t.toLocaleString('zh-CN', { hour12: false });
}

function DependencyRow({ dep }: { dep: SystemAboutResponse['dependencies'][number] }) {
  return (
    <tr>
      <td>{dep.name}</td>
      <td>{systemDependencyStatusLabel(dep.status)}</td>
      <td>{dep.required ? '必需' : '可选'}</td>
      <td>{dep.version ?? '—'}</td>
      <td>{dep.message ?? '—'}</td>
    </tr>
  );
}

export function ManageSystemAboutPage() {
  const aboutQuery = useQuery({
    queryKey: queryKeys.manage.systemAbout.about(),
    queryFn: () => systemAboutApi.about(),
  });

  if (aboutQuery.isPending) {
    return (
      <div className={styles.page}>
        <ManagePageHeader title="系统关于" description="版本、构建与运行依赖状态。" />
        <ManageSectionCard title="加载中" description="正在探测版本与运行依赖。" children={undefined} />
      </div>
    );
  }

  if (aboutQuery.isError || !aboutQuery.data) {
    return (
      <div className={styles.page}>
        <ManagePageHeader title="系统关于" description="版本、构建与运行依赖状态。" />
        <ManageSectionCard
          title={isSystemAboutUnwiredError(aboutQuery.error) ? '后端未提供' : '加载失败'}
          description={
            isSystemAboutUnwiredError(aboutQuery.error)
              ? 'GET /api/manage/system/about 当前不可用。'
              : getErrorMessage(aboutQuery.error)
          }
        >
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => void aboutQuery.refetch()}
          >
            重试
          </button>
        </ManageSectionCard>
      </div>
    );
  }

  const data = aboutQuery.data;

  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="系统关于"
        description="版本、构建与运行依赖状态。"
        meta={<span className={styles.metaText}>刷新于 {formatGeneratedAt(data.generatedAt)}</span>}
      />

      {data.warnings.length > 0 && (
        <div className={styles.emptyInlineState}>{data.warnings.join('；')}</div>
      )}

      <ManageSectionCard title="应用" description="版本与构建元信息。">
        <div className={styles.metricsGrid}>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>版本</span>
            <div className={styles.metricValue}>{data.app.version}</div>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>提交</span>
            <div className={styles.metricValue}>{data.app.commitSha ?? '—'}</div>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>构建时间</span>
            <div className={styles.metricValue}>{data.app.buildTime ?? '—'}</div>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>构建通道</span>
            <div className={styles.metricValue}>{data.app.buildChannel ?? '—'}</div>
          </div>
        </div>
      </ManageSectionCard>

      <ManageSectionCard title="运行时" description="编译目标与启用的能力面。">
        <div className={`${styles.tableWrap} ${styles.desktopOnly}`}>
          <table className={styles.table}>
            <tbody>
              <tr>
                <td>包版本</td>
                <td>{data.runtime.rustPackageVersion}</td>
              </tr>
              <tr>
                <td>目标系统</td>
                <td>{data.runtime.targetOs}</td>
              </tr>
              <tr>
                <td>目标架构</td>
                <td>{data.runtime.targetArch}</td>
              </tr>
              <tr>
                <td>能力面</td>
                <td>{data.runtime.features.join('、')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </ManageSectionCard>

      <ManageSectionCard title="运行依赖" description="PATH 探测（-version 首行）。">
        <div className={`${styles.tableWrap} ${styles.desktopOnly}`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>依赖</th>
                <th>状态</th>
                <th>级别</th>
                <th>版本</th>
                <th>消息</th>
              </tr>
            </thead>
            <tbody>
              {data.dependencies.map((dep) => (
                <DependencyRow key={dep.id} dep={dep} />
              ))}
            </tbody>
          </table>
        </div>
      </ManageSectionCard>

      <ManageSectionCard title="链接" description="源码与分发入口。">
        <div className={`${styles.tableWrap} ${styles.desktopOnly}`}>
          <table className={styles.table}>
            <tbody>
              <tr>
                <td>源码仓库</td>
                <td>{data.links.sourceRepo}</td>
              </tr>
              <tr>
                <td>分发仓库</td>
                <td>{data.links.distributionRepo}</td>
              </tr>
              <tr>
                <td>更新日志</td>
                <td>{data.links.changelog}</td>
              </tr>
              <tr>
                <td>Docker Hub</td>
                <td>{data.links.dockerhubRepo}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </ManageSectionCard>
    </div>
  );
}

export default ManageSystemAboutPage;
