import { ManagePageHeader } from '@/pages/manage/longtail-shared/components';
import { ManagePaidFeatureGuard } from '@/pages/manage/ManagePaidFeatureGuard';
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
 *
 * ★FE-LICENSE-GATED-MODULES：后端 license_gate 未激活时按路径 403——
 *   - `share-download-preview` ⇒ FEATURE_STORAGE_PAN115_SHARE（surface `pan115-share`）；
 *   - `share-items` / `previews` ⇒ FEATURE_STORAGE_PAN115_PROVIDER（surface `pan115`）；
 *   - **`sync/` 是 Exempt（未激活仍 200）⇒ SyncSection 不门控**（否则误伤免费的同步面）。
 *   付费区块用可复用 ManagePaidFeatureGuard 门控，未授权不请求、改显「需要授权」引导。
 */
export function Pan115SharePage() {
  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="115 分享下载与同步"
        description="浏览 115 分享目录、用预览凭据查看挂载网盘目录，并管理 115 挂载的同步任务。该面独立于图床工具（VITE_FEATURE_PAN115_IMGHOST）。"
      />

      {/* share-download-preview ⇒ pan115-share（PreviewCredentialSection） */}
      <ManagePaidFeatureGuard
        feature="pan115-share"
        title="115 分享下载预览需要授权"
        description="分享下载预览属于付费能力，当前实例许可未激活时不可用。激活后即可用预览凭据查看挂载网盘目录。"
      >
        <PreviewCredentialSection />
      </ManagePaidFeatureGuard>

      {/* share-items / previews ⇒ pan115（/manage/pan115/ 除 sync） */}
      <ManagePaidFeatureGuard
        feature="pan115"
        title="115 分享浏览需要授权"
        description="分享目录浏览与预览会话属于付费能力，当前实例许可未激活时不可用。激活后即可浏览分享目录。"
      >
        <ShareItemBrowseSection />
        <PreviewBrowseSection />
      </ManagePaidFeatureGuard>

      {/* SyncSection：/manage/pan115/sync/ 是 Exempt（未激活仍 200）⇒ 不门控。 */}
      <SyncSection />
    </div>
  );
}

export default Pan115SharePage;
