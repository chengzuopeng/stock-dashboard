/**
 * 使用主题 Hook
 */

import { useContext } from 'react';
import { ThemeContext } from '@/contexts/themeContext';

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
