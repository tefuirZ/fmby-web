/**
 * 139 云盘凭据管理页（FE-PARITY-YUN139）。
 *
 * 消费此前零消费的 6 个端点：
 *  - POST   /api/manage/yun139/qr-login
 *  - GET    /api/manage/yun139/qr-status?session_id=
 *  - GET    /api/manage/yun139/credential-profiles
 *  - POST   /api/manage/yun139/credential-profiles
 *  - POST   /api/manage/yun139/credential-profiles/{id}/reauthorize
 *  - DELETE /api/manage/yun139/credential-profiles/{id}
 *
 * 三态：loading / empty / error 均显式呈现，不白屏、不吐原始错误对象。
 */

import { ManagePageHeader } from '@/pages/manage/longtail-shared/components';
import styles from '@/pages/manage/longtail-shared/ManageShared.module.css';
import { Yun139ProfilesSection } from './Yun139ProfilesSection';
import { Yun139QrLoginSection } from './Yun139QrLoginSection';

export function ManageYun139Page() {
  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="139 云盘凭据"
        description="扫码绑定 139 账号并维护凭据档案；凭据过期可就地重新授权。账号池与分享挂载不在本页。"
        meta={<span className={styles.metaText}>凭据仅用于请求体提交，不在前端持久化</span>}
      />

      <Yun139QrLoginSection />
      <Yun139ProfilesSection />
    </div>
  );
}

export default ManageYun139Page;
