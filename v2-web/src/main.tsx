import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary, ToastProvider } from './shared/ui';

// 全局样式（顺序敏感：tokens → aurora 背景层 → base → utilities → responsive）
import './styles/tokens.css';
import './styles/aurora.css';
import './styles/base.css';
import './styles/utilities.css';
import './styles/responsive.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
);
