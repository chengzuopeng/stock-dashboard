/**
 * 主题上下文 Provider - 管理浅色/深色主题切换
 */

import React, { useEffect, useState, useCallback } from 'react';
import { ThemeContext } from './themeContext';
import type { Theme } from './themeTypes';

const STORAGE_KEY = 'app.theme';

/**
 * 获取初始主题
 */
function getInitialTheme(): Theme {
  // 检查是否在浏览器环境
  if (typeof window === 'undefined') {
    return 'dark';
  }
  // 优先从 localStorage 读取
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch {
    // localStorage 不可用
  }
  return 'dark';
}

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  // 应用主题到 document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage 不可用
    }
  }, [theme]);

  // 监听系统主题变化
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        // 只有当用户没有手动设置过主题时，才跟随系统
        if (!stored) {
          setThemeState(e.matches ? 'dark' : 'light');
        }
      } catch {
        // localStorage 不可用
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
