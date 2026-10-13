import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Loader2 } from 'lucide-react';
import {
  authApi,
  INSTALL_COMPLETE_CONFIRM_ACTION,
  type InstallStatusResponse,
  type DatabaseProbeRequest,
} from '@fmby/v2-shared/contracts/auth';
import { queryKeys } from '@fmby/v2-shared/query';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { useSession } from '@/session/SessionProvider';
import { AdminFieldset } from './AdminFieldset';
import { DatabaseCacheFieldset } from './DatabaseCacheFieldset';
import { InstallCompletionPanel } from './InstallCompletionPanel';
import { ServerConfigSummary } from './ServerConfigSummary';
import { buildPgUrl } from './pgConnection';
import {
  nextWizardStep,
  prevWizardStep,
  stepDone,
  stepProblem,
  WIZARD_STEPS,
  type WizardStepId,
  type WizardValues,
} from './installWizard';
import styles from '../login/LoginPage.module.css';

/**
 * 安装向导（fmby-v2 #640 · fe01 裁决 E 的 V2 安装流 + 卡面三页编排）。
 *
 * 真源：`crates/fmby-v2-server/src/install_flow.rs`
 *   GET  /api/install/status            → needs_database / configured / needs_admin / completed
 *   POST /api/install/probe/database    → 只读探活（不写配置）
 *   POST /api/install/probe/redis       → 只读 TCP 可达性
 *   POST /api/install/apply             → 一次收全三组 ⇒ 落配置 → bootstrap → 建首管理员 → 自动登录
 *   POST /api/install/complete          → 校验 users>0 → 落锁 → restart_required
 *
 * ★页面结构 = 卡面三页：① 数据库 / 缓存 ② 服务器配置 ③ 管理员配置。
 *   三页只是**呈现顺序**，提交仍是 apply 一次收全（V2 后端没有分步端点）。
 *   门控在 `installWizard.ts`（纯函数、可实测），本页不写规则。
 *
 * ★路由只挂**安装模式进程**（`main.rs` 的 `install_mode_main`）。该形态 Router 只有
 *   `install_flow::router` + `/health`，不挂 web_static ⇒ 安装模式下浏览器请求
 *   `/install` 拿不到本页（无 SPA 回落）。已安装实例同样不挂 `install_flow::router`
 *   ⇒ `/api/install/*` 除 status 外一律 404。status 请求失败必须显式报错，
 *   **不得**当成「已安装」静默跳走。
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

const INITIAL_VALUES: WizardValues = {
  dbKind: 'sqlite',
  sqlitePath: '',
  cacheKind: 'builtin',
  redisUrl: '',
  pg: { host: '', port: '', database: '', username: '', password: '' },
  adminUsername: '',
  adminPassword: '',
  adminConfirm: '',
  adminDisplayName: '',
};

export function InstallPage() {
  const navigate = useNavigate();
  const { retryRestore } = useSession();

  const [step, setStep] = useState<WizardStepId>('database');
  const [values, setValues] = useState<WizardValues>(INITIAL_VALUES);
  const [completeConfirm, setCompleteConfirm] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const patch = (changes: Partial<WizardValues>) =>
    setValues((current) => ({ ...current, ...changes }));

  const status = useQuery({
    queryKey: queryKeys.install.status(),
    queryFn: () => authApi.getInstallStatus(),
  });
  const state = readInstallState(status.data);
  const canProbe = status.data?.can_probe !== false && state !== 'completed';

  /** 本页填齐与否 —— 判定全在纯函数里，这里只取结果。 */
  const pageProblem = stepProblem(step, values);
  const canAdvance = pageProblem === null;
  const allDone = useMemo(
    () => WIZARD_STEPS.every((meta) => stepDone(meta.id, values)),
    [values],
  );

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
          values.dbKind === 'sqlite'
            ? {
                kind: 'sqlite',
                ...(values.sqlitePath.trim() ? { path: values.sqlitePath.trim() } : {}),
              }
            : { kind: 'postgres', url: buildPgUrl(values.pg) },
        cache:
          values.cacheKind === 'builtin'
            ? { kind: 'builtin' }
            : { kind: 'redis', url: values.redisUrl.trim() },
        admin: {
          username: values.adminUsername.trim(),
          password: values.adminPassword,
          ...(values.adminDisplayName.trim() ? { display_name: values.adminDisplayName.trim() } : {}),
        },
      }),
    onSuccess: () => {
      // 后端已建管理员并自动登录（发 fmby_session / fmby_csrf）。cookie 由浏览器按
      // 同源策略落地，前端让 SessionProvider 重拉 /auth/me。
      // ★安装模式进程不挂主应用路由，故 /auth/me 在此必然 404 —— 预期而非失败。
      retryRestore();
      // 状态会从 needs_database → configured/needs_admin → completed，必须重拉。
      void status.refetch();
    },
  });
  const complete = useMutation({
    mutationFn: () => authApi.completeInstall({ confirm_action: INSTALL_COMPLETE_CONFIRM_ACTION }),
    onSuccess: () => {
      void status.refetch();
    },
  });

  const anyPending =
    probeDb.isPending || probeRedis.isPending || apply.isPending || complete.isPending;

  if (status.isLoading) {
    return (
      <div className={styles.page}>
        <Loader2 className={styles.spinner} />
      </div>
    );
  }

  const installError =
    apply.error || complete.error || status.error
      ? getErrorMessage(apply.error ?? complete.error ?? status.error)
      : null;

  return (
    <div className={styles.page}>
      <div className={styles.auroraLayer} aria-hidden="true" />
      <main className={styles.card}>
        <h1 className={styles.brand}>FMBY</h1>
        <p className={styles.subtitle}>
          安装向导 · 三步
          <br />
          当前状态：{STATE_HEADLINE[state]}
        </p>

        {status.error && state !== 'completed' ? (
          <div className={styles.errorBanner} role="alert">
            读取安装状态失败：{getErrorMessage(status.error)}
            <br />
            安装面可能已下线（实例已安装时后端只保留状态查询）。
          </div>
        ) : null}
        {installError && !status.error ? (
          <div className={styles.errorBanner} role="alert">
            {installError}
          </div>
        ) : null}

        {apply.isSuccess ? (
          <div className={styles.successBanner} role="status">
            安装已应用：数据库已初始化，管理员已创建并自动登录。
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
              // ★fail-closed：任一页未达标就不发请求。apply 一旦成功就建了管理员，
              //   弱口令会直接变成可登录凭据、且服务端只存哈希、无法回收。
              if (!allDone) {
                setSubmitError(
                  WIZARD_STEPS.map((meta) => stepProblem(meta.id, values)).find((p) => p !== null) ??
                    '请完成前面的步骤',
                );
                return;
              }
              setSubmitError(null);
              apply.mutate();
            }}
          >
            {/* `ponytail:` 不做可点的步骤页签（要跳页就得判「哪些页能跳」，那是一堆
                分支逻辑）；向导只给 上一步 / 下一步 + 末步提交，与卡片「三页」等价且更小。 */}
            <p className={styles.subtitle} role="status">
              第 {WIZARD_STEPS.find((meta) => meta.id === step)?.index} / {WIZARD_STEPS.length} 步 ·
              {WIZARD_STEPS.find((meta) => meta.id === step)?.title}
            </p>

            {step === 'database' ? (
              <DatabaseCacheFieldset
                values={values}
                onPatch={patch}
                canProbe={canProbe}
                dbProbe={{
                  pending: probeDb.isPending,
                  data: probeDb.data,
                  error: probeDb.error,
                }}
                onProbeDatabase={(request) => {
                  probeDb.reset();
                  probeDb.mutate(request);
                }}
                redisProbe={{
                  pending: probeRedis.isPending,
                  data: probeRedis.data,
                  error: probeRedis.error,
                }}
                onProbeRedis={(url) => {
                  probeRedis.reset();
                  probeRedis.mutate(url);
                }}
              />
            ) : null}

            {step === 'server' ? <ServerConfigSummary values={values} /> : null}

            {step === 'admin' ? (
              <AdminFieldset
                username={values.adminUsername}
                password={values.adminPassword}
                confirm={values.adminConfirm}
                displayName={values.adminDisplayName}
                onUsernameChange={(v) => patch({ adminUsername: v })}
                onPasswordChange={(v) => patch({ adminPassword: v })}
                onConfirmChange={(v) => patch({ adminConfirm: v })}
                onDisplayNameChange={(v) => patch({ adminDisplayName: v })}
              />
            ) : null}

            {pageProblem && step !== 'admin' ? (
              <p className={styles.fieldError} role="alert">
                {pageProblem}
              </p>
            ) : null}
            {submitError ? (
              <p className={styles.errorBanner} role="alert">
                {submitError}
              </p>
            ) : null}

            <div className={styles.buttonRow}>
              {prevWizardStep(step) ? (
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => setStep(prevWizardStep(step) as WizardStepId)}
                >
                  上一步
                </button>
              ) : null}
              {nextWizardStep(step) ? (
                <button
                  className={styles.secondaryButton}
                  type="button"
                  disabled={!canAdvance}
                  onClick={() => setStep(nextWizardStep(step) as WizardStepId)}
                >
                  下一步
                </button>
              ) : (
                <button
                  className={styles.submitButton}
                  type="submit"
                  disabled={anyPending || !allDone}
                >
                  {apply.isPending ? '安装中…' : '应用安装并创建管理员'}
                </button>
              )}
            </div>

            {apply.isSuccess ? (
              <InstallCompletionPanel
                username={values.adminUsername.trim()}
                password={values.adminPassword}
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
