import type { ManageMountDetailRecord } from '@/domains/manage';
import { InlineBanner } from '@/shared/ui';
import { isStructuredRemoteProvider, hasHiddenMountReferences } from '../../../formUtils';

interface MountViewWarningBannersProps {
  currentDetail: ManageMountDetailRecord;
}

export function MountViewWarningBanners({ currentDetail }: MountViewWarningBannersProps) {
  return (
    <>
      {(currentDetail.mount.healthStatus === 'attention' || currentDetail.mount.healthStatus === 'critical') ? (
        <InlineBanner
          variant={currentDetail.mount.healthStatus === 'critical' ? 'error' : 'warning'}
          title={currentDetail.mount.healthStatus === 'critical' ? '来源当前不可达或已失联' : '来源状态需要关注'}
          description={
            currentDetail.mount.statusMessage
              ? currentDetail.mount.statusMessage
              : currentDetail.mount.description
              ? currentDetail.mount.description
              : isStructuredRemoteProvider(currentDetail.providerType)
              ? currentDetail.mount.healthStatus === 'critical'
                ? '请检查 AList / OpenList 服务是否正常运行，以及配置中的服务地址与认证信息是否仍然有效。'
                : '建议执行"校验来源"或"刷新访问"操作，以确认上游服务状态和凭据有效性。'
              : currentDetail.mount.healthStatus === 'critical'
              ? '请检查挂载路径是否存在，以及后端进程是否有对应的读取权限。'
              : '建议执行"校验来源"操作，确认当前来源的访问状态。'
          }
        />
      ) : null}
      {hasHiddenMountReferences(currentDetail) ? (
        <InlineBanner
          variant="warning"
          title="当前存在隐藏引用"
          description="这个数据源当前没有媒体库绑定，但底层媒体源或旁路资源还在引用它，所以删除会被后端拦住。"
        />
      ) : null}
    </>
  );
}
