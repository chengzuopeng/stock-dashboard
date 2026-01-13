/**
 * 应用根组件
 */

import { AppRouter } from './router';
import { ToastProvider } from './components/common';
import { ThemeProvider } from './contexts';

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppRouter />
      </ToastProvider>
    </ThemeProvider>
  );
}
