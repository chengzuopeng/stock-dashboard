/**
 * 应用根组件
 */

import { AppRouter } from './router';
import { ToastProvider } from './components/common';
import { ThemeProvider, BoardDataProvider } from './contexts';

export function App() {
  return (
    <ThemeProvider>
      <BoardDataProvider>
        <ToastProvider>
          <AppRouter />
        </ToastProvider>
      </BoardDataProvider>
    </ThemeProvider>
  );
}
