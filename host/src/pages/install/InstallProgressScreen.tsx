/**
 * 安装向导的**安装中 Loading 过渡页**（SIMPLIFY-INSTALL-WIZARD：文案从简）。
 *
 * 语义：安装要几秒（写配置、建库、建管理员），期间界面无响应。整页过渡盖住这段，
 * 免得用户以为浏览器挂了去刷新 —— 刷新会丢掉刚写好的配置。
 *
 * `ponytail:` **不做百分比进度条**。后端 `POST /api/install/apply` 是一个请求、
 * 没有分步回执（`InstallApplyResponse` 只有 applied/auto_login/id/username），
 * 任何百分比都是编的。要做真进度，需后端先出 SSE / 轮询端点。
 */

import { Loader2 } from 'lucide-react';
import styles from '../login/LoginPage.module.css';

export interface InstallProgressScreenProps {
  /** 当前在飞的阶段：apply=写配置+建库+建管理员；complete=落安装锁。 */
  phase: 'applying' | 'completing';
}

const APPLY_LINES: readonly string[] = [
  '写入配置',
  '初始化数据库',
  '创建管理员账号',
];

const COMPLETE_LINES: readonly string[] = [
  '确认管理员账号',
  '完成安装',
];

export function InstallProgressScreen({ phase }: InstallProgressScreenProps) {
  const lines = phase === 'applying' ? APPLY_LINES : COMPLETE_LINES;
  return (
    <div className={styles.page}>
      <div className={styles.auroraLayer} aria-hidden="true" />
      <main className={styles.card} aria-live="polite" aria-busy="true">
        <h1 className={styles.brand}>FMBY</h1>
        <p className={styles.subtitle}>
          {phase === 'applying' ? '正在安装…' : '正在完成安装…'}
        </p>
        <div className={styles.loading}>
          <Loader2 className={styles.spinner} aria-hidden="true" />
        </div>
        {/* 只列「在做什么」，不列「做到第几步」—— 没有回执，列了就是假进度。 */}
        <ul className={styles.noticeList}>
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className={styles.noticeBanner}>
          这需要几秒，请稍候，<strong>不要刷新本页</strong>。刷新会丢掉刚写好的配置。
        </p>
      </main>
    </div>
  );
}
