import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { authApi, type InstallDatabaseKind, type DatabaseProbeRequest } from '@fmby/v2-shared/contracts/auth';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from '../login/LoginPage.module.css';

export function InstallPage() {
  const [kind, setKind] = useState<InstallDatabaseKind>('sqlite');
  const [values, setValues] = useState<DatabaseProbeRequest>({ kind: 'sqlite', path: '' });
  const status = useQuery({ queryKey: ['install', 'status'], queryFn: () => authApi.getInstallStatus() });
  const probe = useMutation({ mutationFn: (data: DatabaseProbeRequest) => authApi.probeDatabase(data) });

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
        <p className={styles.subtitle}>首次安装 · 配置数据库</p>
        {status.isError ? <div className={styles.errorBanner} role="alert">{getErrorMessage(status.error)}</div> : null}
        {probe.error ? <div className={styles.errorBanner} role="alert">{getErrorMessage(probe.error)}</div> : null}
        {probe.data && (probe.data.ok || probe.data.reachable) ? <div className={styles.successBanner} role="status">数据库连接检查通过</div> : null}
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
          <button className={styles.submitButton} disabled={probe.isPending || status.isError}>{probe.isPending ? '检查中…' : '检查数据库连接'}</button>
        </form>
      </main>
    </div>
  );
}
