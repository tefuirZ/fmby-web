import type { RuntimeLogLevel } from '@fmby/v2-shared/contracts/manage';
import styles from '../longtail-shared/ManageShared.module.css';
import {
  LEVEL_OPTIONS,
  METHOD_OPTIONS,
  PAGE_SIZE_OPTIONS,
  type RuntimeLogPageSize,
} from './shared';
import { parseRuntimeLogPageSize } from './components';

interface RuntimeLogFilterPanelProps {
  search: string;
  setSearch: (value: string) => void;
  target: string;
  setTarget: (value: string) => void;
  level: 'all' | RuntimeLogLevel;
  setLevel: (value: 'all' | RuntimeLogLevel) => void;
  method: (typeof METHOD_OPTIONS)[number]['value'];
  setMethod: (value: (typeof METHOD_OPTIONS)[number]['value']) => void;
  pathFilter: string;
  setPathFilter: (value: string) => void;
  clientFilter: string;
  setClientFilter: (value: string) => void;
  ipFilter: string;
  setIpFilter: (value: string) => void;
  userFilter: string;
  setUserFilter: (value: string) => void;
  requestIdFilter: string;
  setRequestIdFilter: (value: string) => void;
  pageSize: RuntimeLogPageSize;
  setPageSize: (value: RuntimeLogPageSize) => void;
  categoryOptions: { value: string; label: string }[];
  onReset: () => void;
  matchedTotal: number;
  shownCount: number;
  isShowAll: boolean;
}

/** 「日志查询」卡的筛选面板：级别/条数/类别/方式 + 路径/客户端/IP/用户/请求ID/关键词 + 清空 + 计数。 */
export function RuntimeLogFilterPanel(props: RuntimeLogFilterPanelProps) {
  const {
    search,
    setSearch,
    target,
    setTarget,
    level,
    setLevel,
    method,
    setMethod,
    pathFilter,
    setPathFilter,
    clientFilter,
    setClientFilter,
    ipFilter,
    setIpFilter,
    userFilter,
    setUserFilter,
    requestIdFilter,
    setRequestIdFilter,
    pageSize,
    setPageSize,
    categoryOptions,
    onReset,
    matchedTotal,
    shownCount,
    isShowAll,
  } = props;
  return (
    <>
      <div className={styles.runtimeLogFilterGrid}>
        <label className={styles.label}>
          级别
          <select
            className={styles.select}
            value={level}
            onChange={(event) =>
              setLevel(event.target.value as 'all' | RuntimeLogLevel)
            }
          >
            {LEVEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.label}>
          展示条数
          <select
            className={styles.select}
            value={String(pageSize)}
            onChange={(event) => {
              setPageSize(parseRuntimeLogPageSize(event.target.value));
            }}
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option.value} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.label}>
          类别
          <select
            className={styles.select}
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          >
            <option value="">全部类别</option>
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.label}>
          请求方式
          <select
            className={styles.select}
            value={method}
            onChange={(event) =>
              setMethod(event.target.value as (typeof METHOD_OPTIONS)[number]['value'])
            }
          >
            {METHOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.label}>
          请求路径
          <input
            className={styles.searchInput}
            value={pathFilter}
            onChange={(event) => setPathFilter(event.target.value)}
            placeholder="/emby/Items / /api/manage/runtime-logs"
          />
        </label>
        <label className={styles.label}>
          客户端
          <input
            className={styles.searchInput}
            value={clientFilter}
            onChange={(event) => setClientFilter(event.target.value)}
            placeholder="Hills / Chrome / Infuse / Emby"
          />
        </label>
        <label className={styles.label}>
          IP 地址
          <input
            className={styles.searchInput}
            value={ipFilter}
            onChange={(event) => setIpFilter(event.target.value)}
            placeholder="127.0.0.1 / 192.168 / 10.0"
          />
        </label>
        <label className={styles.label}>
          用户
          <input
            className={styles.searchInput}
            value={userFilter}
            onChange={(event) => setUserFilter(event.target.value)}
            placeholder="显示名 / 用户名 / 用户 ID"
          />
        </label>
        <label className={styles.label}>
          请求 ID
          <input
            className={styles.searchInput}
            value={requestIdFilter}
            onChange={(event) => setRequestIdFilter(event.target.value)}
            placeholder="request_id / traceId"
          />
        </label>
        <label className={styles.label}>
          关键词
          <input
            className={styles.searchInput}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="错误文本 / 来源 ID / 任意关键字"
          />
        </label>
      </div>
      <div className={styles.runtimeLogFilterActions}>
        <div className={styles.rowActions}>
          <button
            className={styles.smallButton}
            type="button"
            onClick={onReset}
          >
            清空筛选
          </button>
        </div>
        <span className={styles.tableHint}>
          匹配 {matchedTotal} 条
          {isShowAll ? ' · 当前展示全部' : ` · 当前展示前 ${shownCount} 条`}
        </span>
      </div>
    </>
  );
}
