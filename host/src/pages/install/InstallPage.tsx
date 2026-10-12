import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import {
  authApi,
  type InstallDatabaseKind,
  type InstallStatusResponse,
  type DatabaseProbeRequest,
} from '@fmby/v2-shared/contracts/auth';
import { queryKeys } from '@fmby/v2-shared/query';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from '../login/LoginPage.module.css';

/**
 * 后端 install status 的四态（V2 `crates/fmby-v2-server/src/install_flow.rs:176-189`）：
 *   needs_database → configured → needs_admin → completed
 * 本页**只消费 status + probe 两条端点**（`authApi.getInstallStatus` /
 * `authApi.probeDatabase`），即只能「看状态 + 探活数据库」，**不能完成安装**。
 * 文案必须如实反映这一点（fe01 裁决 D）。
 */
type InstallState = 'needs_database' | 'configured' | 'needs_admin' | 'completed' | 'unknown';

function readInstallState(status: InstallStatusResponse | undefined): InstallState {
  const raw = status?.state;
  if (raw === 'needs_database' || raw === 'configured' || raw === 'needs_admin' || raw === 'completed') {
    return raw;
  }
  // 后端未给 state（旧版本/未装配）时按下位旗标保守推导，推导不出就归 unknown。
  if (status?.completed) return 'completed';
  if (status?.database_configured) return 'configured';
  return 'unknown';
}

const STATE_HEADLINE: Record<InstallState, string> = {
  needs_database: '尚未配置数据库',
  configured: '数据库已配置，但还没有管理员账号',
  needs_admin: '数据库已初始化，还缺一个管理员账号',
  completed: '安装已完成',
  unknown: '安装状态未知',
};

/** 本页**做不到**的事（诚实标注，避免用户以为走完这页就装好了）。 */
const NOT_PROVIDED = [
  '写入数据库配置并完成初始化（bootstrap / 迁移）',
  '创建首个管理员账号并自动登录',
  '配置缓存与队列（Redis）',
  '标记安装完成并进入主应用',
];

export function InstallPage() {
  const [kind, setKind] = useState<InstallDatabaseKind>('sqlite');
  const [values, setValues] = useState<DatabaseProbeRequest>({ kind: 'sqlite', path: '' });
  const status = useQuery({ queryKey: queryKeys.install.status(), queryFn: () => authApi.getInstallStatus() });
  const probe = useMutation({ mutationFn: (data: DatabaseProbeRequest) => authApi.probeDatabase(data) });
  const state = readInstallState(status.data);
  const canProbe = status.data?.can_probe !== false && state !== 'completed';
  // 后端「已安装实例」会返回 can_probe=false（除 status 外的安装路由一律 404 下线，
  // `routes/install.rs` 头部注释）。按钮 disabled 时必须说明原因，否则用户只会看到
  // 一个点不动的按钮而不知道为什么（实测：已安装实例下按钮恒 disabled）。
  const probeBlockedReason = state === 'completed'
    ? '安装已完成，无需再探活。'
    : status.data?.can_probe === false
      ? '当前实例已安装，探活端点已下线（后端对已安装实例只保留状态查询）。'
      : null;

  function update(kind: InstallDatabaseKind) {
    setKind(kind);
    setValues(kind === 'sqlite' ? { kind, path: '' } : { kind, url: 'postgresql://', host: '', port: 5432, database: '', username: '', password: '' });
    probe.reset();
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const request = kind === 'sqlite'
      ? values
      : { kind: 'postgresql' as const, url: `postgresql://${encodeURIComponent(String(values.username ?? ''))}:${encodeURIComponent(String(values.password ?? ''))}@${String(values.host ?? '')}:${Number(values.port ?? 5432)}/${encodeURIComponent(String(values.database ?? ''))}` };
    probe.mutate(request);
  }

  if (status.isLoading) return <div className={styles.page}><Loader2 className={styles.spinner} /></div>;
  return (
    <div className={styles.page}>
      <div className={styles.auroraLayer} aria-hidden="true" />
      <main className={styles.card}>
        <h1 className={styles.brand}>FMBY</h1>
        {/* fe01（诚实化）：原标题「首次安装 · 配置数据库」暗示走完本页即可完成安装，
            而本页只接了 status + probe 两条端点 —— 只能看状态与探活。改标题与副文案。 */}
        <p className={styles.subtitle}>
          安装状态检查 · 数据库连接探活
          <br />
          当前状态：{STATE_HEADLINE[state]}
        </p>
        {status.isError ? <div className={styles.errorBanner} role="alert">{getErrorMessage(status.error)}</div> : null}
        {probe.error ? <div className={styles.errorBanner} role="alert">{getErrorMessage(probe.error)}</div> : null}
        {probe.data && (probe.data.ok || probe.data.reachable) ? (
          <div className={styles.successBanner} role="status">
            数据库连接检查通过（仅表示这个地址可用，<strong>不会写入任何配置</strong>）。
          </div>
        ) : null}
        <div className={styles.noticeBanner}>
          <strong className={styles.noticeTitle}>这一页只能做到这里</strong>
          可以：读取安装状态、检查数据库地址是否可用。
          <br />
          还不可以：
          <ul className={styles.noticeList}>
            {NOT_PROVIDED.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {state === 'completed' ? (
            <>安装已完成，请重启服务后从首页登录。</>
          ) : (
            <>完成安装需要在服务端执行安装流程（安装模式进程），请查阅部署文档。</>
          )}
        </div>
        <div className={styles.modeSwitch} role="radiogroup" aria-label="数据库类型">
          {(['sqlite', 'postgresql'] as const).map((option) => (
            <button key={option} type="button" role="radio" aria-checked={kind === option} className={`${styles.modeButton} ${kind === option ? styles.modeButtonActive : ''}`} onClick={() => update(option)}>
              {option === 'sqlite' ? 'SQLite' : 'PostgreSQL'}
            </button>
          ))}
        </div>
        <form className={styles.form} onSubmit={submit}>
          {kind === 'sqlite' ? (
            <label className={styles.fieldGroup}>数据库文件路径<input className={styles.input} required value={values.path ?? ''} onChange={(e) => setValues({ kind, path: e.target.value })} placeholder="例如 ./data/fmby.db" /></label>
          ) : (
            <>
              {(['host', 'port', 'database', 'username', 'password'] as const).map((field) => (
                <label className={styles.fieldGroup} key={field}>{field === 'port' ? '端口' : field === 'database' ? '数据库名' : field === 'username' ? '用户名' : field === 'password' ? '密码' : '主机'}
                  <input className={styles.input} required type={field === 'password' ? 'password' : 'text'} value={String(values[field] ?? '')} onChange={(e) => setValues({ ...values, kind, [field]: field === 'port' ? Number(e.target.value) : e.target.value })} />
                </label>
              ))}
            </>
          )}
          {probeBlockedReason ? (
            <p className={styles.noticeBanner} role="status">
              {probeBlockedReason}
            </p>
          ) : null}
          <button
            className={styles.submitButton}
            disabled={probe.isPending || status.isError || !canProbe}
          >
            {probe.isPending
              ? '检查中…'
              : state === 'completed'
                ? '安装已完成，无需再探活'
                : '检查数据库连接（只探活，不写配置）'}
          </button>
        </form>
      </main>
    </div>
  );
}
