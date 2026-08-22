import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary, ToastProvider } from '@fmby/v2-shared/ui';

// host 结构样式（顺序敏感：默认形象 tokens → base → utilities → responsive）。
// 主题的 tokens.css / aurora.css 不在此 import —— 由 ThemeProvider 在启动后
// 异步注入（docs/09 §6：零主题阻塞，首屏不等待主题产物，未就绪用默认形象）。
import './styles/defaults.css';
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
