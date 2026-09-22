/**
 * 开放 API 端点目录页（FE-PARITY-DEVELOPER-ENDPOINTS）。
 *
 * 消费此前零消费的 1 个端点：GET /api/manage/developer/endpoints
 *
 * 三态：loading / empty / error 均显式呈现，不白屏、不吐原始错误对象。
 */

import { ManagePageHeader } from '@/pages/manage/longtail-shared/components';
import styles from '@/pages/manage/longtail-shared/ManageShared.module.css';
import { DeveloperEndpointsSection } from './DeveloperEndpointsSection';

export function ManageDeveloperApiPage() {
  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="开放 API 端点目录"
        description="列出可签发令牌访问的开放 API 端点（支持方法/作用域筛选与分页）。令牌签发与吊销在「API 令牌」面。"
        meta={<span className={styles.metaText}>需要 manage:access 能力</span>}
      />

      <DeveloperEndpointsSection />
    </div>
  );
}

export default ManageDeveloperApiPage;
