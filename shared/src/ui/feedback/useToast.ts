import { useContext } from 'react';
import { ToastContext, type ToastApi } from './ToastProvider';

interface UseToastResult {
  toast: ToastApi;
}

export function useToast(): UseToastResult {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error(
      'useToast 必须在 <ToastProvider> 内部使用，请先在应用根节点挂载 ToastProvider。',
    );
  }
  return { toast: ctx };
}
