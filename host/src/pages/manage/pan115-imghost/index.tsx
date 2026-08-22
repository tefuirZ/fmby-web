import { useCallback, useState } from 'react';
import type { Pan115ImghostUploadResponse } from '@/domains/manage/pan115Imghost';
import { ManagePageHeader } from '@/pages/manage/longtail-shared/components';
import { CredentialsCard } from './components/CredentialsCard';
import { UploadZone } from './components/UploadZone';
import { AssetList } from './components/AssetList';
import styles from '@/pages/manage/longtail-shared/ManageShared.module.css';

/**
 * Pan115 图床工具页
 *
 * 仅在 VITE_FEATURE_PAN115_IMGHOST=1 时通过 Feature Flag 启用。
 * 路由：/manage/tools/pan115-imghost
 *
 * 布局：
 *   ┌─ 页头（标题 + 说明）
 *   ├─ 凭据卡片（扫码绑定 / 状态 / 解绑）
 *   ├─ 上传区（拖拽 / 点选）
 *   └─ 资产列表（分页 + 实时轮询）
 */
export function Pan115ImghostPage() {
  const [pendingUpload, setPendingUpload] = useState<Pan115ImghostUploadResponse | null>(null);

  const handleUploaded = useCallback((asset: Pan115ImghostUploadResponse) => {
    setPendingUpload(asset);
  }, []);

  const handlePendingConsumed = useCallback(() => {
    setPendingUpload(null);
  }, []);

  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="图床（115）"
        description="上传图片到 115 网盘并获取永久直链，同时在本地保留副本作为兜底。图床凭据独立于挂载凭据管理。"
      />

      <CredentialsCard />

      <UploadZone onUploaded={handleUploaded} />

      <AssetList
        pendingUpload={pendingUpload}
        onPendingConsumed={handlePendingConsumed}
      />
    </div>
  );
}

export default Pan115ImghostPage;
