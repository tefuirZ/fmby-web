import { Component, type ErrorInfo, type ReactNode } from 'react';
import { FeedbackState } from './FeedbackState';
import styles from './ErrorBoundary.module.css';

type FallbackRender = (error: Error, reset: () => void) => ReactNode;

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | FallbackRender;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * 通用 React 渲染错误边界。
 *
 * 用法：
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 *
 * 自定义 fallback：
 *   <ErrorBoundary fallback={(err, reset) => <MyError onRetry={reset} />}>
 *     ...
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 兜底打印，方便排错
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] render error:', error, info);
    this.props.onError?.(error, info);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    const { fallback } = this.props;
    if (typeof fallback === 'function') {
      return (fallback as FallbackRender)(error, this.reset);
    }
    if (fallback !== undefined) {
      return fallback;
    }

    return (
      <FeedbackState
        variant="error"
        title="页面渲染出错"
        description={error.message || '发生了未知错误，请尝试重试或刷新页面。'}
        action={
          <button type="button" className={styles.retryButton} onClick={this.reset}>
            重试
          </button>
        }
      />
    );
  }
}
