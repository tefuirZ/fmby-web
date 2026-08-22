/**
 * 统一表单字段错误展示组件。
 *
 * 与 react-hook-form 配合：传入 `formState.errors[fieldName]?.message`，
 * 无错误时不渲染、有错误时输出符合无障碍语义的提示。
 */

import type { CSSProperties } from 'react';

interface FieldErrorProps {
  message?: string;
  hint?: string;
  className?: string;
  style?: CSSProperties;
}

const errorStyle: CSSProperties = {
  display: 'block',
  marginTop: 'var(--space-1, 4px)',
  fontSize: 'var(--text-caption, 12px)',
  color: 'var(--danger, #ef4444)',
};

const hintStyle: CSSProperties = {
  display: 'block',
  marginTop: 'var(--space-1, 4px)',
  fontSize: 'var(--text-caption, 12px)',
  color: 'var(--text-muted, #94a3b8)',
};

export function FieldError({ message, hint, className, style }: FieldErrorProps) {
  if (message) {
    return (
      <span
        role="alert"
        aria-live="polite"
        className={className}
        style={{ ...errorStyle, ...style }}
      >
        {message}
      </span>
    );
  }
  if (hint) {
    return (
      <span className={className} style={{ ...hintStyle, ...style }}>
        {hint}
      </span>
    );
  }
  return null;
}
