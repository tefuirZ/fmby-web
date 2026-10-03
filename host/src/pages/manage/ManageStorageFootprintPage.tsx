import { useQuery } from '@tanstack/react-query';
import {
  isStorageFootprintUnwiredError,
  storageFootprintApi,
  storageRelationKindLabel,
  type StorageFootprintResponse,
} from '@fmby/v2-shared/contracts/manage/storage-footprint';
import { queryKeys } from '@fmby/v2-shared/query';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from './longtail-shared/ManageShared.module.css';
import { ManagePageHeader, ManageSectionCard } from './longtail-shared/components';

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let v = bytes;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u += 1;
  }
  return `${v.toFixed(v >= 100 || u === 0 ? 0 : 1)} ${units[u]}`;
}

function formatGeneratedAt(epochMs: number): string {
  const t = new Date(epochMs);
  return Number.isNaN(t.getTime()) ? String(epochMs) : t.toLocaleString('zh-CN', { hour12: false });
}

function RelationRow({ rel }: { rel: StorageFootprintResponse['postgres'] extends null ? never : NonNullable<StorageFootprintResponse['postgres']>['largestRelations'][number] }) {
  return (
    <tr>
      <td>{rel.relationName}</td>
      <td>{storageRelationKindLabel(rel.relationKind)}</td>
      <td>{formatBytes(rel.totalSizeBytes)}</td>
      <td>{formatBytes(rel.tableSizeBytes)}</td>
      <td>{formatBytes(rel.indexSizeBytes)}</td>
      <td>{rel.liveTuples.toLocaleString('zh-CN')}</td>
      <td>{rel.deadTuples.toLocaleString('zh-CN')}</td>
    </tr>
  );
}

export function ManageStorageFootprintPage() {
  const fpQuery = useQuery({
    queryKey: queryKeys.manage.storageFootprint.footprint(),
    queryFn: () => storageFootprintApi.footprint(),
  });

  if (fpQuery.isPending) {
    return (
      <div className={styles.page}>
        <ManagePageHeader title="存储占用" description="数据库与索引子系统的空间占用概况。" />
        <ManageSectionCard title="加载中" description="正在采集存储占用。">
          <span />
        </ManageSectionCard>
      </div>
    );
  }

  if (fpQuery.isError || !fpQuery.data) {
    return (
      <div className={styles.page}>
        <ManagePageHeader title="存储占用" description="数据库与索引子系统的空间占用概况。" />
        <ManageSectionCard
          title={isStorageFootprintUnwiredError(fpQuery.error) ? '后端未提供' : '加载失败'}
          description={
            isStorageFootprintUnwiredError(fpQuery.error)
              ? 'GET /api/manage/system/storage-footprint 当前不可用。'
              : getErrorMessage(fpQuery.error)
          }
        >
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => void fpQuery.refetch()}
          >
            重试
          </button>
        </ManageSectionCard>
      </div>
    );
  }

  const data = fpQuery.data;

  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="存储占用"
        description="数据库与索引子系统的空间占用概况。"
        meta={
          <span className={styles.metaText}>
            {data.backend} · 刷新于 {formatGeneratedAt(data.generatedAt)}
          </span>
        }
      />
      {!data.supported && (
        <ManageSectionCard
          title="当前后端不提供存储占用明细"
          description={data.reason ?? '该后端不支持此探测。'}
        >
          <span />
        </ManageSectionCard>
      )}
      {data.postgres && (
        <>
          <ManageSectionCard title="数据库总大小" description={formatBytes(data.postgres.databaseSizeBytes)}>
            <span />
          </ManageSectionCard>
          <ManageSectionCard title="最大关系" description="按总占用排序的表与索引。">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>关系</th>
                  <th>种类</th>
                  <th>总计</th>
                  <th>表</th>
                  <th>索引</th>
                  <th>活元组</th>
                  <th>死元组</th>
                </tr>
              </thead>
              <tbody>
                {data.postgres.largestRelations.map((rel) => (
                  <RelationRow key={rel.relationName} rel={rel} />
                ))}
              </tbody>
            </table>
          </ManageSectionCard>
          <ManageSectionCard title="关键设置" description="与存储相关的 PostgreSQL 设置。">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>名称</th>
                  <th>值</th>
                  <th>来源</th>
                </tr>
              </thead>
              <tbody>
                {data.postgres.settings.map((s) => (
                  <tr key={s.name}>
                    <td>{s.name}</td>
                    <td>{s.setting}</td>
                    <td>{s.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ManageSectionCard>
        </>
      )}
    </div>
  );
}
