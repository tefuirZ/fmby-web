/**
 * ★FE-ASYNC-FEEDBACK：用户发起的后台任务反馈层。
 *
 * 解决「点下去没反馈 / 卡死转圈 / 后台干了什么看不见」：
 * - 提交即反馈：submit() 同步入队 + toast「已提交，正在后台执行（任务 #id）」，
 *   按钮/抽屉不被锁（调用方提交后立即继续，不等待完成）；
 * - 幂等：相同 key 的任务仍在 running 时重复提交 ⇒ toast「已在执行」并拒绝
 *   （返回 null），不产生重复请求；
 * - 结果可见：成功/失败 toast + 任务中心「后台任务」区可查（任务名/发起人/
 *   状态/开始时间/耗时/失败原因），失败可重试；
 * - 高负载（429/503）：toast「系统繁忙，已转后台执行，完成后通知你」+
 *   本层自动退避重试一次，仍失败转 failed。
 *
 * 实现口径：jobs 以 ref 为真值源（jobsRef），setState 只做镜像渲染——
 * 读写都在事件回调里完成，绝不在 state updater 内做副作用（StrictMode
 * 双调用会让 toast 双发）。
 *
 * ★契约边界（待对齐）：服务端 202+job_id 异步契约（E1）未落地——当前
 * `job.id` 为**本会话本地序号**（`job_<n>`），状态由前端 promise 生命周期推导，
 * 「后台任务」区只聚合本会话发起的任务。E1 落地后：id/状态/进度改读服务端
 * 响应与 jobs 列表端点，本 Provider 的 submit/retry 语义保持不变。
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useToast } from './useToast';
import { getErrorMessage } from '@fmby/v2-shared/errors';

export type AsyncJobStatus = 'running' | 'succeeded' | 'failed';

export interface AsyncJob {
  /** 本会话本地序号（`job_<n>`）；E1 契约对齐后替换为服务端 job_id。 */
  id: string;
  /** 幂等键：同一操作维度的唯一标识（如 `user-update:<id>`）。 */
  key: string;
  /** 任务名（人读，如「更新用户「alice」」）。 */
  name: string;
  /** 发起人（当前会话用户显示名）。 */
  initiator: string;
  status: AsyncJobStatus;
  /** 开始时间（epoch ms）。 */
  startedAt: number;
  /** 结束时间（epoch ms；running 时无）。 */
  finishedAt?: number;
  /** 失败原因（仅 failed）。 */
  error?: string;
  /** 高负载提示（429/503 转后台重试期间展示）。 */
  busyNote?: string;
  /** 执行次数（含重试；高负载退避时 +1）。 */
  attempts: number;
  /** 进度 0-100（服务端契约对齐前恒 undefined ⇒ 展示面「有则显示」）。 */
  progress?: number;
}

export interface AsyncJobSubmitInput {
  /** 幂等键。 */
  key: string;
  /** 任务名。 */
  name: string;
}

export interface AsyncJobsApi {
  jobs: AsyncJob[];
  /**
   * 提交后台任务。返回任务 id；若同 key 任务仍在执行 ⇒ 幂等拒绝，返回 null
   * （调用方不应关闭面板/清空表单）。
   */
  submit(input: AsyncJobSubmitInput, run: () => Promise<unknown>): string | null;
  /** 重试失败任务（仅 failed 可重试）。 */
  retry(id: string): void;
  /** 移除一条已结束（succeeded/failed）的任务记录。 */
  clear(id: string): void;
}

const AsyncJobsContext = createContext<AsyncJobsApi | null>(null);

/** 高负载判定：429（限流）/ 503（过载）＝「已受理但忙」语义（错误对象带 http status）。 */
function isBusyError(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  return status === 429 || status === 503;
}

const BUSY_RETRY_DELAY_MS = 3_000;
const BUSY_MAX_ATTEMPTS = 2;

interface AsyncJobsProviderProps {
  children: ReactNode;
  /** 发起人显示名（当前会话用户；由挂载点从 session 注入）。 */
  initiator: string;
}

export function AsyncJobsProvider({ children, initiator }: AsyncJobsProviderProps) {
  const { toast } = useToast();
  // ref = 真值源；state = 渲染镜像。
  const jobsRef = useRef<AsyncJob[]>([]);
  const [jobs, setJobs] = useState<AsyncJob[]>([]);
  const seqRef = useRef(0);
  // run 函数不进 state（非渲染数据）；重试时按 id 取回。
  const runsRef = useRef(new Map<string, () => Promise<unknown>>());

  const commit = useCallback((next: AsyncJob[]) => {
    jobsRef.current = next;
    setJobs(next);
  }, []);

  const patch = useCallback(
    (id: string, changes: Partial<AsyncJob>) => {
      commit(jobsRef.current.map((job) => (job.id === id ? { ...job, ...changes } : job)));
    },
    [commit],
  );

  const execute = useCallback(
    (id: string) => {
      const run = runsRef.current.get(id);
      if (!run) return;
      void run().then(
        () => {
          const job = jobsRef.current.find((item) => item.id === id);
          patch(id, { status: 'succeeded', finishedAt: Date.now(), busyNote: undefined });
          if (job) {
            toast.success({ title: `任务 #${id} 已完成`, description: job.name });
          }
        },
        (error: unknown) => {
          const job = jobsRef.current.find((item) => item.id === id);
          if (!job) return;
          if (isBusyError(error) && job.attempts < BUSY_MAX_ATTEMPTS) {
            // ④ 高负载：受理语义成立（服务端忙，不是失败）——本层退避重试，
            // 完成后经成功 toast 通知（「完成后通知你」由此兑现）。
            patch(id, {
              attempts: job.attempts + 1,
              busyNote: '系统繁忙，正在自动重试',
            });
            toast.warning({
              title: '系统繁忙，已转后台执行，完成后通知你',
              description: `任务 #${id} · ${job.name}`,
            });
            window.setTimeout(() => execute(id), BUSY_RETRY_DELAY_MS);
            return;
          }
          patch(id, {
            status: 'failed',
            finishedAt: Date.now(),
            error: getErrorMessage(error),
            busyNote: undefined,
          });
          toast.error({
            title: `任务 #${id} 失败`,
            description: `${job.name}：${getErrorMessage(error)}。可在任务中心「后台任务」重试。`,
            durationMs: 8_000,
          });
        },
      );
    },
    [patch, toast],
  );

  const submit = useCallback(
    (input: AsyncJobSubmitInput, run: () => Promise<unknown>): string | null => {
      // 幂等：同 key 且仍在 running ⇒ 拒绝重复提交。
      const existing = jobsRef.current.find((job) => job.key === input.key && job.status === 'running');
      if (existing) {
        toast.warning({
          title: `该操作已在执行中（任务 #${existing.id}）`,
          description: '请勿重复提交；可在任务中心「后台任务」查看进度。',
        });
        return null;
      }
      seqRef.current += 1;
      const id = `job_${seqRef.current}`;
      runsRef.current.set(id, run);
      commit([
        ...jobsRef.current,
        {
          id,
          key: input.key,
          name: input.name,
          initiator,
          status: 'running',
          startedAt: Date.now(),
          attempts: 1,
        },
      ]);
      // ① 提交即反馈（toast 同步出队；调用方随后自行解锁 UI）。
      toast.info({ title: `已提交，正在后台执行（任务 #${id}）`, description: input.name });
      execute(id);
      return id;
    },
    [commit, execute, initiator, toast],
  );

  const retry = useCallback(
    (id: string) => {
      const job = jobsRef.current.find((item) => item.id === id);
      if (!job || job.status !== 'failed') return;
      patch(id, {
        status: 'running',
        startedAt: Date.now(),
        finishedAt: undefined,
        error: undefined,
      });
      execute(id);
    },
    [execute, patch],
  );

  const clear = useCallback(
    (id: string) => {
      runsRef.current.delete(id);
      commit(jobsRef.current.filter((job) => job.id !== id || job.status === 'running'));
    },
    [commit],
  );

  const api = useMemo<AsyncJobsApi>(
    () => ({ jobs, submit, retry, clear }),
    [jobs, submit, retry, clear],
  );

  return <AsyncJobsContext.Provider value={api}>{children}</AsyncJobsContext.Provider>;
}

export function useAsyncJobs(): AsyncJobsApi {
  const ctx = useContext(AsyncJobsContext);
  if (!ctx) {
    throw new Error(
      'useAsyncJobs 必须在 <AsyncJobsProvider> 内部使用（AppShell 已挂载；独立入口需自行包一层）。',
    );
  }
  return ctx;
}
