/**
 * 安装向导 ① 页：**数据库 + 缓存选择**（fmby-v2 #640 卡面）。
 *
 * 单列成组件的原因：`InstallPage.tsx` 受 400 行棘轮约束（见
 * `scripts/check-frontend-component-size.mjs`），编排页只留编排。
 * 判定本体一律走纯函数（`pgConnection.ts` / `passwordPolicy.ts`），本组件不重写规则。
 *
 * `ponytail:` 只做受控呈现，不持有状态、不发请求 ⇒ 无 jsdom 也无需浏览器测；
 * 接线由 `tests/install-pg-form.test.ts` 断言，判定由
 * `tests/install-pg-connection.test.ts` 真跑（11 例）。
 */

import { useState } from 'react';

import type { DatabaseProbeRequest, DatabaseProbeResponse } from '@fmby/v2-shared/contracts/auth';
import { PasswordToggle } from '../login/forms/fields';
import type { WizardValues } from './installWizard';
import {
  pgFieldsProblem,
  probeFailureText,
  probeSucceeded,
} from './pgConnection';
import styles from '../login/LoginPage.module.css';
export interface DatabaseCacheFieldsetProps {
  values: WizardValues;
  /** 局部更新（组件不持有状态，状态归编排页）。 */
  onPatch: (patch: Partial<WizardValues>) => void;
  /** 后端 status.can_probe；已安装实例为 false ⇒ 探活按钮须禁用。 */
  canProbe: boolean;
  dbProbe: { pending: boolean; data?: DatabaseProbeResponse; error: unknown };
  onProbeDatabase: (request: DatabaseProbeRequest) => void;
  redisProbe: { pending: boolean; data?: DatabaseProbeResponse; error: unknown };
  onProbeRedis: (url: string) => void;
}

/** 把 PG 拆分表单转成契约的探活请求（`DatabaseProbeRequest` 原生支持结构化字段）。 */
export function pgProbeRequest(values: WizardValues): DatabaseProbeRequest {
  const { pg } = values;
  const port = pg.port.trim();
  return {
    kind: 'postgresql',
    host: pg.host.trim(),
    ...(port.length > 0 ? { port: Number(port) } : {}),
    database: pg.database.trim(),
    username: pg.username.trim(),
    password: pg.password,
  };
}

export function DatabaseCacheFieldset({
  values,
  onPatch,
  canProbe,
  dbProbe,
  onProbeDatabase,
  redisProbe,
  onProbeRedis,
}: DatabaseCacheFieldsetProps) {
  const [pgPasswordVisible, setPgPasswordVisible] = useState(false);
  const isPg = values.dbKind === 'postgresql';
  const pgProblem = isPg ? pgFieldsProblem(values.pg) : null;
  const dbFailure = dbProbe.pending
    ? null
    : probeFailureText(dbProbe.data, dbProbe.error instanceof Error ? dbProbe.error.message : undefined);
  const redisFailure = redisProbe.pending
    ? null
    : probeFailureText(
        redisProbe.data,
        redisProbe.error instanceof Error ? redisProbe.error.message : undefined,
      );

  return (
    <>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>数据库</legend>
        <div className={styles.modeSwitch} role="radiogroup" aria-label="数据库类型">
          {(['sqlite', 'postgresql'] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={values.dbKind === option}
              className={`${styles.modeButton} ${values.dbKind === option ? styles.modeButtonActive : ''}`}
              onClick={() => onPatch({ dbKind: option })}
            >
              {option === 'sqlite' ? 'SQLite（推荐）' : 'PostgreSQL'}
            </button>
          ))}
        </div>

        {isPg ? (
          <>
            {/* 卡面要求「主机/端口/账号/密码」拆分表单：不让运维手写整串 URL 是刻意的
                —— 手写串里密码含 @ : / 时错误极难自查（见 pgConnection ⑤ 用例）。 */}
            <label className={styles.fieldGroup}>
              主机
              <input
                className={styles.input}
                value={values.pg.host}
                onChange={(e) => onPatch({ pg: { ...values.pg, host: e.target.value } })}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label className={styles.fieldGroup}>
              端口（留空用默认 5432）
              <input
                className={styles.input}
                value={values.pg.port}
                onChange={(e) => onPatch({ pg: { ...values.pg, port: e.target.value } })}
                inputMode="numeric"
                autoComplete="off"
              />
            </label>
            <label className={styles.fieldGroup}>
              数据库名
              <input
                className={styles.input}
                value={values.pg.database}
                onChange={(e) => onPatch({ pg: { ...values.pg, database: e.target.value } })}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label className={styles.fieldGroup}>
              账号
              <input
                className={styles.input}
                value={values.pg.username}
                onChange={(e) => onPatch({ pg: { ...values.pg, username: e.target.value } })}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <div className={styles.fieldGroup}>
              <span className={styles.label}>密码</span>
              <div className={styles.inputWrapper}>
                <input
                  className={`${styles.input} ${styles.inputHasToggle}`}
                  type={pgPasswordVisible ? 'text' : 'password'}
                  value={values.pg.password}
                  onChange={(e) => onPatch({ pg: { ...values.pg, password: e.target.value } })}
                  autoComplete="off"
                />
                <PasswordToggle
                  visible={pgPasswordVisible}
                  onToggle={() => setPgPasswordVisible((v) => !v)}
                />
              </div>
            </div>
            {pgProblem ? (
              <span className={styles.fieldError} role="alert">
                {pgProblem}
              </span>
            ) : null}
          </>
        ) : (
          <label className={styles.fieldGroup}>
            数据库文件路径（留空用内置默认，零输入零写盘）
            <input
              className={styles.input}
              value={values.sqlitePath}
              onChange={(e) => onPatch({ sqlitePath: e.target.value })}
            />
          </label>
        )}

        <button
          className={styles.secondaryButton}
          type="button"
          disabled={!canProbe || dbProbe.pending || (isPg && pgProblem !== null)}
          onClick={() =>
            onProbeDatabase(
              isPg
                ? pgProbeRequest(values)
                : { kind: 'sqlite', path: values.sqlitePath.trim() || undefined },
            )
          }
        >
          {dbProbe.pending ? '连接测试中…' : '连接测试（只探活，不写配置）'}
        </button>

        {probeSucceeded(dbProbe.data) ? (
          <p className={styles.noticeBanner} role="status">
            数据库可用（仅表示地址可达，<strong>尚未写入任何配置</strong>）。
          </p>
        ) : null}
        {dbFailure ? (
          <p className={styles.errorBanner} role="alert">
            连接测试失败：{dbFailure}
          </p>
        ) : null}
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>缓存 / 队列</legend>
        <div className={styles.modeSwitch} role="radiogroup" aria-label="缓存类型">
          {(['builtin', 'redis'] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={values.cacheKind === option}
              className={`${styles.modeButton} ${values.cacheKind === option ? styles.modeButtonActive : ''}`}
              onClick={() => onPatch({ cacheKind: option })}
            >
              {option === 'builtin' ? '内置（内存 + 文件，推荐）' : 'Redis'}
            </button>
          ))}
        </div>

        {values.cacheKind === 'redis' ? (
          <>
            <label className={styles.fieldGroup}>
              Redis 连接串
              <input
                className={styles.input}
                value={values.redisUrl}
                onChange={(e) => onPatch({ redisUrl: e.target.value })}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={redisProbe.pending || values.redisUrl.trim().length === 0}
              onClick={() => onProbeRedis(values.redisUrl.trim())}
            >
              {redisProbe.pending ? '连接测试中…' : '连接测试（只探活）'}
            </button>
            {probeSucceeded(redisProbe.data) ? (
              <p className={styles.noticeBanner} role="status">Redis 可达（尚未写入任何配置）。</p>
            ) : null}
            {redisFailure ? (
              <p className={styles.errorBanner} role="alert">连接测试失败：{redisFailure}</p>
            ) : null}
            <p className={styles.fieldHint}>
              Redis 连不上时保存安装仍会失败；若先用内置，后端在缓存不可用时
              <strong>自动回落内存 + 文件</strong>。
            </p>
          </>
        ) : (
          <p className={styles.noticeBanner}>
            使用内置缓存 / 队列（内存 + 文件），无需配置；未填 Redis 即由后端走这条回落路径。
          </p>
        )}
      </fieldset>
    </>
  );
}
