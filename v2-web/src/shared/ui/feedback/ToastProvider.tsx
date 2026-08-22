import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Toast, type ToastItem, type ToastVariant } from './Toast';
import styles from './Toast.module.css';

export interface ToastInput {
  title: string;
  description?: string;
  durationMs?: number;
}

export interface ToastApi {
  success: (input: ToastInput) => string;
  error: (input: ToastInput) => string;
  warning: (input: ToastInput) => string;
  info: (input: ToastInput) => string;
  dismiss: (id?: string) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

const MAX_TOASTS = 5;
const DEFAULT_DURATION = 4000;
const ERROR_DURATION = 6000;

function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id?: string) => {
    if (id == null) {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
      setToasts([]);
      return;
    }
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const enqueue = useCallback(
    (variant: ToastVariant, input: ToastInput): string => {
      const id = genId();
      const durationMs =
        input.durationMs ??
        (variant === 'error' ? ERROR_DURATION : DEFAULT_DURATION);
      const item: ToastItem = {
        id,
        variant,
        title: input.title,
        description: input.description,
        durationMs,
      };
      setToasts((prev) => {
        const next = [...prev, item];
        // 队列上限：丢弃最旧
        if (next.length > MAX_TOASTS) {
          const dropped = next.slice(0, next.length - MAX_TOASTS);
          dropped.forEach((d) => {
            const t = timersRef.current.get(d.id);
            if (t) {
              clearTimeout(t);
              timersRef.current.delete(d.id);
            }
          });
          return next.slice(-MAX_TOASTS);
        }
        return next;
      });
      if (durationMs > 0) {
        const timer = setTimeout(() => {
          timersRef.current.delete(id);
          setToasts((prev) => prev.filter((it) => it.id !== id));
        }, durationMs);
        timersRef.current.set(id, timer);
      }
      return id;
    },
    [],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (input) => enqueue('success', input),
      error: (input) => enqueue('error', input),
      warning: (input) => enqueue('warning', input),
      info: (input) => enqueue('info', input),
      dismiss,
    }),
    [enqueue, dismiss],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toasts.length > 0 ? (
        <div className={styles.viewport} aria-label="通知">
          {toasts.map((item) => (
            <Toast key={item.id} toast={item} onDismiss={dismiss} />
          ))}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}
