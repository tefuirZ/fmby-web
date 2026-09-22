import { ManagePageHeader } from '@/pages/manage/longtail-shared/components';
import { ShareItemBrowseSection } from './components/ShareItemBrowseSection';
import { PreviewBrowseSection } from './components/PreviewBrowseSection';
import { SyncSection } from './components/SyncSection';
import { PreviewCredentialSection } from './components/PreviewCredentialSection';
import styles from '@/pages/manage/longtail-shared/ManageShared.module.css';

/**
 * 115 分享下载 / 同步管理页（FE-PARITY-PAN115-SHARE）。
 *
 * 消费此前前端零消费的 4 个端点：
 *  - POST /api/manage/pan115/previews/{id}/browse  预览凭据浏览网盘目录
 *  - POST /api/manage/pan115/share-items/browse     匿名浏览分享目录
 *  - GET  /api/manage/pan115/sync/mounts/{id}       同步概览
 *  - POST /api/manage/pan115/sync/mounts/{id}/enqueue 手动入队同步
 *
 * 鉴权：后端统一 `MANAGE_MOUNT` 能力门 + license provider 端口收口（仅登录态即可），
 * 端口未装配时 fail-closed（503/500）——所有区块均透传后端 error_code，不白屏、不吞空。
 */
export function Pan115SharePage() {
  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="115 分享下载与同步"
        description="浏览 115 分享目录、用预览凭据查看挂载网盘目录，并管理 115 挂载的同步任务。该面独立于图床工具（VITE_FEATURE_PAN115_IMGHOST）。"
      />

      <PreviewCredentialSection />
      <ShareItemBrowseSection />
      <PreviewBrowseSection />
      <SyncSection />
    </div>
  );
}

export default Pan115SharePage;
