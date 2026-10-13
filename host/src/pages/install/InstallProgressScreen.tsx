/**
 * 安装向导的**动态配置 Loading 过渡页**（fmby-v2 #640 卡面）。
 *
 * 卡面语义：V2 的配置是后端**热加载**（不重启进程），但个别环节要重建连接
 * （建库、建池、装配缓存），期间界面会「卡住」。整页过渡就是为了盖住这段无响应，
 * 免得运维以为浏览器挂了去刷新 —— 刷新反而会丢掉刚写入的配置回执。
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
  '写入非默认配置项（原子落盘，权限 0600）',
  '初始化数据库结构并建立连接池',
  '装配缓存 / 队列并创建首个管理员',
];

const COMPLETE_LINES: readonly string[] = [
  '校验已有管理员账号',
  '落安装锁 fmby-install.lock',
  '切换由主应用接管',
];

export function InstallProgressScreen({ phase }: InstallProgressScreenProps) {
  const lines = phase === 'applying' ? APPLY_LINES : COMPLETE_LINES;
  return (
    <div className={styles.page}>
      <div className={styles.auroraLayer} aria-hidden="true" />
      <main className={styles.card} aria-live="polite" aria-busy="true">
        <h1 className={styles.brand}>FMBY</h1>
        <p className={styles.subtitle}>
          {phase === 'applying' ? '正在应用安装配置…' : '正在落安装锁…'}
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
          配置为<strong>热加载</strong>：应用安装这三步之间<strong>不需重启</strong>。
          耗时取决于数据库建库与网络，请稍候，<strong>不要刷新本页</strong>。
          （complete 落锁后须重启进主应用 —— 安装模式进程不挂主应用路由，见完成页。）
        </p>
      </main>
    </div>
  );
}
