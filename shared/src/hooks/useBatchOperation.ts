import { useCallback, useMemo, useRef, useState } from 'react';
import {
  clearVisible as clearVisiblePure,
  headerCheckState,
  invertVisible as invertVisiblePure,
  pruneSelection,
  runBatch,
  selectAll as selectAllPure,
  summarize,
  toggleOne,
  toggleRange,
  type BatchItemState,
} from '@fmby/v2-shared/batch';

export interface UseBatchSelectionOptions {
  /** 当前页可选项 id（顺序 = 视觉顺序，范围选依赖）。 */
  visibleIds: readonly string[];
}

export interface UseBatchSelectionResult {
  selected: string[];
  selectedSet: ReadonlySet<string>;
  headerState: 'checked' | 'indeterminate' | 'unchecked';
  /** 单点勾选（shift 时为范围选：传 anchorId）。 */
  toggle: (id: string, checked: boolean, opts?: { shiftKey?: boolean }) => void;
  selectAll: () => void;
  clear: () => void;
  clearVisible: () => void;
  invertVisible: () => void;
  /** 用最新已知 id 清理失效选择（列表刷新后调用）。 */
  prune: (knownIds: readonly string[]) => void;
  isSelected: (id: string) => boolean;
}

/**
 * 多选 hook（FE-OPT-04）：全选 / 反选 / 范围选（shift 锚点）。
 *
 * 选择语义为"跨页保留"：全选只并入当前可见项，清空只移除当前可见项，
 * 不可见页已选项不受影响——避免分页切换丢失选择。
 */
export function useBatchSelection({
  visibleIds,
}: UseBatchSelectionOptions): UseBatchSelectionResult {
  const [selected, setSelected] = useState<string[]>([]);
  const anchorRef = useRef<string | null>(null);

  const toggle = useCallback(
    (id: string, checked: boolean, opts?: { shiftKey?: boolean }) => {
      setSelected((prev) => {
        const next =
          opts?.shiftKey && anchorRef.current
            ? toggleRange({
                selected: prev,
                visibleIds,
                id,
                anchorId: anchorRef.current,
                checked,
              })
            : toggleOne(prev, id, checked);
        return next;
      });
      anchorRef.current = id;
    },
    [visibleIds],
  );

  const selectAll = useCallback(() => {
    setSelected((prev) => selectAllPure(prev, visibleIds));
  }, [visibleIds]);

  const clear = useCallback(() => {
    setSelected([]);
    anchorRef.current = null;
  }, []);

  const clearVisible = useCallback(() => {
    setSelected((prev) => clearVisiblePure(prev, visibleIds));
  }, [visibleIds]);

  const invertVisible = useCallback(() => {
    setSelected((prev) => invertVisiblePure(prev, visibleIds));
  }, [visibleIds]);

  const prune = useCallback((knownIds: readonly string[]) => {
    setSelected((prev) => {
      const next = pruneSelection(prev, knownIds);
      return next.length === prev.length ? prev : next;
    });
  }, []);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const headerState = useMemo(
    () => headerCheckState(selected, visibleIds),
    [selected, visibleIds],
  );

  return {
    selected,
    selectedSet,
    headerState,
    toggle,
    selectAll,
    clear,
    clearVisible,
    invertVisible,
    prune,
    isSelected: (id: string) => selectedSet.has(id),
  };
}

export interface UseBatchRunnerResult {
  items: BatchItemState[];
  running: boolean;
  /** 运行一批（覆盖当前面板状态）。 */
  run: (
    targets: readonly Pick<BatchItemState, 'id' | 'label'>[],
    runOne: (id: string) => Promise<void>,
  ) => Promise<void>;
  /** 仅重试失败项（保留成功项状态）。 */
  retryFailed: (runOne: (id: string) => Promise<void>) => Promise<void>;
  retryOne: (id: string, runOne: (id: string) => Promise<void>) => Promise<void>;
  dismiss: () => void;
  summary: ReturnType<typeof summarize>;
}

/**
 * 批量运行 hook（FE-OPT-04）：逐条调用 + 状态增量 + 失败可重试。
 *
 * 编排在纯内核 `runBatch` 上；本 hook 只负责把状态搬进 React state。
 */
export function useBatchRunner(): UseBatchRunnerResult {
  const [items, setItems] = useState<BatchItemState[]>([]);
  const [running, setRunning] = useState(false);

  const run = useCallback(
    async (
      targets: readonly Pick<BatchItemState, 'id' | 'label'>[],
      runOne: (id: string) => Promise<void>,
    ) => {
      setRunning(true);
      const initial: BatchItemState[] = targets.map((t) => ({
        id: t.id,
        label: t.label,
        status: 'pending',
      }));
      setItems(initial);
      const index = new Map(initial.map((item) => [item.id, item]));
      try {
        const final = await runBatch(targets, runOne, {
          concurrency: 1,
          onUpdate: (state) => {
            const prev = index.get(state.id);
            if (prev) Object.assign(prev, state);
            setItems([...index.values()]);
          },
        });
        setItems(final);
      } finally {
        setRunning(false);
      }
    },
    [],
  );

  // 失败项集合经 ref 读取，避免在 setState updater 内做副作用（React 反模式）。
  const itemsRef = useRef<BatchItemState[]>([]);
  itemsRef.current = items;

  const retryFailed = useCallback(async (runOne: (id: string) => Promise<void>) => {
    const failures = itemsRef.current.filter((item) => item.status === 'fail');
    if (failures.length === 0) return;
    setRunning(true);
    try {
      await runBatch(
        failures.map((f) => ({ id: f.id, label: f.label })),
        runOne,
        {
          concurrency: 1,
          onUpdate: (state) => {
            setItems((current) =>
              current.map((item) => (item.id === state.id ? { ...item, ...state } : item)),
            );
          },
        },
      );
    } finally {
      setRunning(false);
    }
  }, []);

  const retryOne = useCallback(async (id: string, runOne: (id: string) => Promise<void>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'running', error: undefined } : item)),
    );
    setRunning(true);
    try {
      await runOne(id);
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: 'ok', error: undefined } : item)),
      );
    } catch (error) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status: 'fail',
                error: error instanceof Error ? error.message : String(error),
              }
            : item,
        ),
      );
    } finally {
      setRunning(false);
    }
  }, []);

  const dismiss = useCallback(() => setItems([]), []);

  const summary = useMemo(() => summarize(items), [items]);

  return { items, running, run, retryFailed, retryOne, dismiss, summary };
}
