/**
 * 主题 Context 定义 - 与组件分离以支持 Fast Refresh
 */

import { createContext } from 'react';
import type { ThemeContextValue } from './themeTypes';

export const ThemeContext = createContext<ThemeContextValue | null>(null);
