import type { Theme } from '@/contexts/themeTypes';

export interface ChartColors {
  rise: string;
  fall: string;
  flat: string;
  borderPrimary: string;
  borderSecondary: string;
  textTertiary: string;
  bgElevated: string;
  textPrimary: string;
  accent: string;
  bgCard: string;
}

// 色值与 index.css 的主题变量保持同步。图表 option 在渲染期构建，而 data-theme /
// data-color-mode 属性在 effect 阶段才写入 DOM，渲染期读 CSS 变量会拿到切换前的旧值，
// 故这里用显式色板按 (theme, colorMode) 推导
const DARK_CHROME = {
  borderPrimary: '#27272a',
  borderSecondary: '#18181b',
  textTertiary: '#a1a1aa',
  bgElevated: '#27272a',
  textPrimary: '#fafafa',
  accent: '#3b82f6',
  bgCard: '#18181b',
};

const LIGHT_CHROME = {
  borderPrimary: '#e4e4e7',
  borderSecondary: '#f4f4f5',
  textTertiary: '#71717a',
  bgElevated: '#e4e4e7',
  textPrimary: '#09090b',
  accent: '#2563eb',
  bgCard: '#ffffff',
};

export function withAlpha(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

export function getChartColors(
  theme: Theme,
  colorMode: 'red-rise' | 'green-rise'
): ChartColors {
  const chrome = theme === 'light' ? LIGHT_CHROME : DARK_CHROME;
  const rise = colorMode === 'green-rise' ? '#10b981' : '#ef4444';
  const fall = colorMode === 'green-rise' ? '#ef4444' : '#10b981';
  return { ...chrome, rise, fall, flat: '#71717a' };
}
