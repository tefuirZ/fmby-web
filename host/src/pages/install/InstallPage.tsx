import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Loader2 } from 'lucide-react';
import {
  authApi,
  INSTALL_COMPLETE_CONFIRM_ACTION,
  type InstallDatabaseKind,
  type InstallStatusResponse,
  type DatabaseProbeRequest,
} from '@fmby/v2-shared/contracts/auth';
import { queryKeys } from '@fmby/v2-shared/query';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { useSession } from '@/session/SessionProvider';
import { AdminFieldset } from './AdminFieldset';
import { InstallCompletionPanel } from './InstallCompletionPanel';
import { confirmPasswordProblem } from './passwordPolicy';
import styles from '../login/LoginPage.module.css';

/**
 * 安装向导（fe01 裁决 E）——对接 **V2 安装流**。
 *
 * 真源：`crates/fmby-v2-server/src/install_flow.rs`
 *   GET  /api/install/status            → 四态：needs_database / configured /
 *                                         needs_admin / completed
 *   POST /api/install/probe/database    → 只读探活（不写配置）
 *   POST /api/install/probe/redis       → 只读 TCP 可达性
 *   POST /api/install/apply             → **一次收全三组**：探测 → 只写非默认项
 *                                         （0600 原子）→ bootstrap → 建首管理员
 *                                         → 自动登录（后端发 cookie）
 *   POST /api/install/complete          → 校验 users>0 → 落锁 → restart_required
 *
 * ★与 V1 的形态差异：V1 是 4 步（initialize / config / setup / complete），
 *   V2 收敛为 **apply 一次收全** + **complete 落锁**。本页按 V2 实现，不发 V1 端点。
 *
 * ★路由只挂**安装模式进程**（main.rs install_mode_main）；已安装实例下除 status
 *   外一律 404 下线 ⇒ 本页按 status.state 决定是否展示向导步骤。
 */

type InstallState = 'needs_database' | 'configured' | 'needs_admin' | 'completed' | 'unknown';

function readInstallState(status: InstallStatusResponse | undefined): InstallState {
  const raw = status?.state;
  if (
    raw === 'needs_database' ||
    raw === 'configured' ||
    raw === 'needs_admin' ||
    raw === 'completed'
  ) {
    return raw;
  }
  // 主应用形态下 /install/status 走 http 层 DTO（三字段、无 state/completed）
  // ⇒ 按下位旗标保守推导，推导不出归 unknown。
  if (status?.completed) return 'completed';
  if (status?.database_configured) return 'configured';
  return 'unknown';
}

const STATE_HEADLINE: Record<InstallState, string> = {
  needs_database: '尚未配置数据库',
  configured: '数据库已配置，还缺管理员账号',
  needs_admin: '数据库已初始化，还缺一个管理员账号',
  completed: '安装已完成',
  unknown: '安装状态未知',
};

type DbKind = InstallDatabaseKind;
type CacheKind = 'builtin' | 'redis';

export function InstallPage() {
  const navigate = useNavigate();
  const { retryRestore } = useSession();

  const [dbKind, setDbKind] = useState<DbKind>('sqlite');
  const [sqlitePath, setSqlitePath] = useState('');
  const [pgUrl, setPgUrl] = useState('');

  const [cacheKind, setCacheKind] = useState<CacheKind>('builtin');
  const [redisUrl, setRedisUrl] = useState('');

  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminDisplayName, setAdminDisplayName] = useState('');
  // #640 裁定 ②：二次确认口令与强度判定。判定本体在 passwordPolicy.ts（纯函数、可实测），
  // 这里只持有确认串并做提交前 fail-closed —— 不重复实现规则。
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');
  const [completeConfirm, setCompleteConfirm] = useState('');
  const [adminSubmitError, setAdminSubmitError] = useState<string | null>(null);

  const status = useQuery({
    queryKey: queryKeys.install.status(),
    queryFn: () => authApi.getInstallStatus(),
  });
  const state = readInstallState(status.data);
  const canProbe = status.data?.can_probe !== false && state !== 'completed';

  /**
   * 管理员输入是否可提交。null = 可提交。
   * 提交前拦下（而不是提交后报错），因为 apply 一旦成功就建了管理员，
   * 弱口令会直接变成可登录凭据、且服务端只存哈希、**无法回收**。
   */
  const adminProblem: string | null =
    adminPassword.length === 0
      ? '请先设置管理员密码'
      : adminPassword.trim().length === 0
        ? '密码不能只有空白字符'
        : confirmPasswordProblem(adminPassword, adminPasswordConfirm);

  const probeDb = useMutation({
    mutationFn: (data: DatabaseProbeRequest) => authApi.probeDatabase(data),
  });
  const probeRedis = useMutation({
    mutationFn: (url: string) => authApi.probeRedis({ url }),
  });
  const apply = useMutation({
    mutationFn: () =>
      authApi.applyInstall({
        database:
          dbKind === 'sqlite'
            ? { kind: 'sqlite', ...(sqlitePath.trim() ? { path: sqlitePath.trim() } : {}) }
            : { kind: 'postgres', url: pgUrl.trim() },
        cache: cacheKind === 'builtin' ? { kind: 'builtin' } : { kind: 'redis', url: redisUrl.trim() },
        admin: {
          username: adminUsername.trim(),
          password: adminPassword,
          ...(adminDisplayName.trim() ? { display_name: adminDisplayName.trim() } : {}),
        },
      }),
    onSuccess: () => {
      // 后端已建管理员并自动登录（发 fmby_session / fmby_csrf）。cookie 由浏览器
      // 按同源策略落地，前端让 SessionProvider 重拉 /auth/me。
      // ★安装模式进程**不挂主应用路由**（只有 /api/install/* + /health），故
      //   /auth/me 在此必然 404 —— 这是预期，不是失败。真实登录态在重启进主应用
      //   后才可用；此处调用只为「一旦已切换形态就能立刻拿到会话」。
      retryRestore();
      // 状态会从 needs_database → configured/needs_admin → completed，必须重拉，
      // 否则页面还停在旧 state（实测：apply 后仍显示 needs_database）。
      void status.refetch();
    },
  });
  const complete = useMutation({
    mutationFn: () => authApi.completeInstall({ confirm_action: INSTALL_COMPLETE_CONFIRM_ACTION }),
    onSuccess: () => {
      // 落锁后 state 翻 completed，重拉以切到「已完成」视图（不再展示表单）。
      void status.refetch();
    },
  });

  const anyPending =
    probeDb.isPending || probeRedis.isPending || apply.isPending || complete.isPending;
  const anyError =
    probeDb.error ?? probeRedis.error ?? apply.error ?? complete.error ?? status.error;

  if (status.isLoading) {
    return (
      <div className={styles.page}>
        <Loader2 className={styles.spinner} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.auroraLayer} aria-hidden="true" />
      <main className={styles.card}>
        <h1 className={styles.brand}>FMBY</h1>
        <p className={styles.subtitle}>
          安装向导 · 数据库 / 缓存 / 管理员
          <br />
          当前状态：{STATE_HEADLINE[state]}
        </p>

        {anyError ? (
          <div className={styles.errorBanner} role="alert">
            {getErrorMessage(anyError)}
          </div>
        ) : null}

        {apply.isSuccess ? (
          <div className={styles.successBanner} role="status">
            安装已应用：数据库已初始化，管理员已创建并自动登录。
          </div>
        ) : null}

        {complete.isSuccess ? (
          <div className={styles.successBanner} role="status">
            安装已标记完成（restart_required={String(complete.data?.restart_required ?? true)}）。
            重启服务后由主应用接管。
          </div>
        ) : null}

        {state === 'completed' || complete.isSuccess ? (
          <>
            <div className={styles.noticeBanner} role="status">
              <strong className={styles.noticeTitle}>安装已完成</strong>
              请重启服务后从首页登录。
            </div>
            <button
              className={styles.submitButton}
              type="button"
              onClick={() => void navigate('/')}
            >
              前往首页
            </button>
          </>
        ) : (
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              // ★fail-closed：强度/二次确认不过就不发请求（后端当前不校强度，
              //   在前端拿这道门拦住，比等一个哈希了的弱口令留下更便宜）。
              if (adminProblem) {
                setAdminSubmitError(adminProblem);
                return;
              }
              setAdminSubmitError(null);
              apply.mutate();
            }}
          >
            {/* ── ① 数据库 ───────────────────────────────────────────── */}
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>① 数据库</legend>
              <div className={styles.modeSwitch} role="radiogroup" aria-label="数据库类型">
                {(['sqlite', 'postgresql'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={dbKind === option}
                    className={`${styles.modeButton} ${dbKind === option ? styles.modeButtonActive : ''}`}
                    onClick={() => {
                      setDbKind(option);
                      probeDb.reset();
                    }}
                  >
                    {option === 'sqlite' ? 'SQLite（推荐）' : 'PostgreSQL'}
                  </button>
                ))}
              </div>
              {dbKind === 'sqlite' ? (
                <label className={styles.fieldGroup}>
                  数据库文件路径（留空用内置默认，零输入零写盘）
                  <input
                    className={styles.input}
                    value={sqlitePath}
                    onChange={(e) => setSqlitePath(e.target.value)}
                    placeholder="例如 ./data/fmby.db"
                  />
                </label>
              ) : (
                <label className={styles.fieldGroup}>
                  PostgreSQL 连接串（必填）
                  <input
                    className={styles.input}
                    required
                    value={pgUrl}
                    onChange={(e) => setPgUrl(e.target.value)}
                    placeholder="postgresql://user:pass@host:5432/db"
                  />
                </label>
              )}
              <button
                className={styles.secondaryButton}
                type="button"
                disabled={!canProbe || probeDb.isPending}
                onClick={() =>
                  probeDb.mutate(
                    dbKind === 'sqlite'
                      ? { kind: 'sqlite', path: sqlitePath.trim() || undefined }
                      : { kind: 'postgresql', url: pgUrl.trim() },
                  )
                }
              >
                {probeDb.isPending ? '检查中…' : '检查数据库（只探活，不写配置）'}
              </button>
              {probeDb.data?.ok || probeDb.data?.reachable ? (
                <p className={styles.noticeBanner} role="status">
                  数据库可用（仅表示地址可达，<strong>尚未写入任何配置</strong>）。
                </p>
              ) : null}
            </fieldset>

            {/* ── ② 缓存 / 队列 ──────────────────────────────────────── */}
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>② 缓存 / 队列（可选）</legend>
              <div className={styles.modeSwitch} role="radiogroup" aria-label="缓存类型">
                {(['builtin', 'redis'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={cacheKind === option}
                    className={`${styles.modeButton} ${cacheKind === option ? styles.modeButtonActive : ''}`}
                    onClick={() => {
                      setCacheKind(option);
                      probeRedis.reset();
                    }}
                  >
                    {option === 'builtin' ? '内置（推荐）' : 'Redis'}
                  </button>
                ))}
              </div>
              {cacheKind === 'redis' ? (
                <>
                  <label className={styles.fieldGroup}>
                    Redis 连接串（必填）
                    <input
                      className={styles.input}
                      required
                      value={redisUrl}
                      onChange={(e) => setRedisUrl(e.target.value)}
                      placeholder="redis://127.0.0.1:6379"
                    />
                  </label>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    disabled={probeRedis.isPending || !redisUrl.trim()}
                    onClick={() => probeRedis.mutate(redisUrl.trim())}
                  >
                    {probeRedis.isPending ? '检查中…' : '检查 Redis（只探活）'}
                  </button>
                  {probeRedis.data?.ok || probeRedis.data?.reachable ? (
                    <p className={styles.noticeBanner} role="status">
                      Redis 可达。
                    </p>
                  ) : null}
                </>
              ) : (
                <p className={styles.noticeBanner}>使用内置缓存/队列，无需配置。</p>
              )}
            </fieldset>

            {/* ── ③ 管理员（#640 ②③④：强度/二次确认/一键生成/显隐在组件内）── */}
            <AdminFieldset
              username={adminUsername}
              password={adminPassword}
              confirm={adminPasswordConfirm}
              displayName={adminDisplayName}
              onUsernameChange={setAdminUsername}
              onPasswordChange={setAdminPassword}
              onConfirmChange={setAdminPasswordConfirm}
              onDisplayNameChange={setAdminDisplayName}
            />
            {adminSubmitError ? (
              <p className={styles.errorBanner} role="alert">
                {adminSubmitError}
              </p>
            ) : null}

            <button
              className={styles.submitButton}
              type="submit"
              disabled={anyPending || adminProblem !== null}
            >
              {apply.isPending ? '安装中…' : '应用安装并创建管理员'}
            </button>

            {/* ④ 完成（落锁 + 凭据回显：#640 裁定「完成页展示账号与密码」）*/}
            {apply.isSuccess ? (
              <InstallCompletionPanel
                username={adminUsername.trim()}
                password={adminPassword}
                confirmAction={INSTALL_COMPLETE_CONFIRM_ACTION}
                confirmValue={completeConfirm}
                onConfirmChange={setCompleteConfirm}
                completing={complete.isPending}
                onComplete={() => complete.mutate()}
              />
            ) : null}
          </form>
        )}

        {status.data?.can_probe === false && state !== 'completed' ? (
          <p className={styles.noticeBanner} role="status">
            当前实例已安装，安装面端点已下线（后端对已安装实例只保留状态查询）。
          </p>
        ) : null}
      </main>
    </div>
  );
}
