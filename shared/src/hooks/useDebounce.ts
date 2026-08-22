import { useEffect, useState } from 'react';

/**
 * 防抖 hook
 *
 * 值变化后延迟 `delay` 毫秒才更新返回值。
 * 适用于输入框联想、自动保存等场景。
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      window.clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
