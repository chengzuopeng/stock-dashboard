/**
 * 本地存储服务
 * 管理自选、告警、配置等持久化数据
 */

import type {
  WatchlistGroup,
  AlertRule,
  AppSettings,
  HeatmapConfig,
  IndicatorConfig,
  SearchHistoryItem,
  ColumnConfig,
} from '@/types';
import { normalizeStockCode } from '@/utils/format';

// 存储键
const STORAGE_KEYS = {
  WATCHLIST_GROUPS: 'watchlist.groups',
  ALERTS: 'watchlist.alerts',
  SETTINGS: 'app.settings',
  TABLE_COLUMNS: 'ui.tableColumns',
  HEATMAP_CONFIG: 'ui.heatmapConfig',
  INDICATOR_CONFIG: 'ui.indicatorConfig',
  SEARCH_HISTORY: 'search.recent',
} as const;

// 默认设置
const DEFAULT_SETTINGS: AppSettings = {
  refreshInterval: {
    list: 0, // 0 表示使用默认值
    detail: 5000,
    heatmap: 10000,
  },
  colorMode: 'red-rise',
  heatmapConfig: {
    dimension: 'industry',
    colorField: 'changePercent',
    sizeField: 'totalMarketCap',
    colorMode: 'red-rise',
    topK: 200,
  },
  indicatorConfig: {
    ma: [5, 10, 20, 60],
    macd: { short: 12, long: 26, signal: 9 },
    boll: { period: 20, stdDev: 2 },
    kdj: { period: 9, kPeriod: 3, dPeriod: 3 },
    rsi: [6, 12, 24],
  },
};

// 默认自选分组
const DEFAULT_WATCHLIST_GROUPS: WatchlistGroup[] = [
  {
    id: 'default',
    name: '默认分组',
    codes: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

/**
 * 安全读取 JSON
 */
function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// ========== 自选分组 ==========

/**
 * 获取所有自选分组
 */
export function getWatchlistGroups(): WatchlistGroup[] {
  const data = localStorage.getItem(STORAGE_KEYS.WATCHLIST_GROUPS);
  const groups = safeJsonParse(data, DEFAULT_WATCHLIST_GROUPS);
  let changed = false;

  const normalizedGroups = groups.map((group) => {
    let groupChanged = false;
    const seen = new Set<string>();
    const normalizedCodes = group.codes
      .map((code) => {
        const normalized = normalizeStockCode(code);
        if (normalized !== code) groupChanged = true;
        return normalized;
      })
      .filter((code) => {
        if (!code) {
          groupChanged = true;
          return false;
        }
        if (seen.has(code)) {
          groupChanged = true;
          return false;
        }
        seen.add(code);
        return true;
      });

    if (groupChanged || normalizedCodes.length !== group.codes.length) {
      changed = true;
      return { ...group, codes: normalizedCodes };
    }

    return group;
  });

  if (changed) {
    saveWatchlistGroups(normalizedGroups);
  }

  return normalizedGroups;
}

/**
 * 保存自选分组
 */
export function saveWatchlistGroups(groups: WatchlistGroup[]): void {
  localStorage.setItem(STORAGE_KEYS.WATCHLIST_GROUPS, JSON.stringify(groups));
}

/**
 * 添加股票到自选
 */
export function addToWatchlist(code: string, groupId = 'default'): void {
  const normalizedCode = normalizeStockCode(code);
  if (!normalizedCode) return;
  const groups = getWatchlistGroups();
  const group = groups.find((g) => g.id === groupId);
  if (group && !group.codes.includes(normalizedCode)) {
    group.codes.push(normalizedCode);
    group.updatedAt = Date.now();
    saveWatchlistGroups(groups);
  }
}

/**
 * 从自选移除股票
 */
export function removeFromWatchlist(code: string, groupId?: string): void {
  const normalizedCode = normalizeStockCode(code);
  if (!normalizedCode) return;
  const groups = getWatchlistGroups();
  if (groupId) {
    const group = groups.find((g) => g.id === groupId);
    if (group) {
      group.codes = group.codes.filter((c) => c !== normalizedCode);
      group.updatedAt = Date.now();
    }
  } else {
    // 从所有分组移除
    groups.forEach((group) => {
      group.codes = group.codes.filter((c) => c !== normalizedCode);
      group.updatedAt = Date.now();
    });
  }
  saveWatchlistGroups(groups);
}

/**
 * 检查是否在自选中
 */
export function isInWatchlist(code: string): boolean {
  const normalizedCode = normalizeStockCode(code);
  if (!normalizedCode) return false;
  const groups = getWatchlistGroups();
  return groups.some((g) => g.codes.includes(normalizedCode));
}

/**
 * 获取所有自选代码
 */
export function getAllWatchlistCodes(): string[] {
  const groups = getWatchlistGroups();
  const codes = new Set<string>();
  groups.forEach((g) => g.codes.forEach((c) => codes.add(c)));
  return Array.from(codes);
}

/**
 * 创建分组
 */
export function createWatchlistGroup(name: string): WatchlistGroup {
  const groups = getWatchlistGroups();
  const newGroup: WatchlistGroup = {
    id: `group_${Date.now()}`,
    name,
    codes: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  groups.push(newGroup);
  saveWatchlistGroups(groups);
  return newGroup;
}

/**
 * 删除分组
 */
export function deleteWatchlistGroup(groupId: string): void {
  if (groupId === 'default') return; // 默认分组不可删除
  const groups = getWatchlistGroups().filter((g) => g.id !== groupId);
  saveWatchlistGroups(groups);
}

/**
 * 重命名分组
 */
export function renameWatchlistGroup(groupId: string, name: string): void {
  const groups = getWatchlistGroups();
  const group = groups.find((g) => g.id === groupId);
  if (group) {
    group.name = name;
    group.updatedAt = Date.now();
    saveWatchlistGroups(groups);
  }
}

// ========== 告警规则 ==========

/**
 * 获取所有告警规则
 */
export function getAlertRules(): AlertRule[] {
  const data = localStorage.getItem(STORAGE_KEYS.ALERTS);
  return safeJsonParse(data, []);
}

/**
 * 保存告警规则
 */
export function saveAlertRules(rules: AlertRule[]): void {
  localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(rules));
}

/**
 * 添加告警规则
 */
export function addAlertRule(rule: Omit<AlertRule, 'id' | 'createdAt'>): AlertRule {
  const rules = getAlertRules();
  const newRule: AlertRule = {
    ...rule,
    id: `alert_${Date.now()}`,
    createdAt: Date.now(),
  };
  rules.push(newRule);
  saveAlertRules(rules);
  return newRule;
}

/**
 * 删除告警规则
 */
export function deleteAlertRule(ruleId: string): void {
  const rules = getAlertRules().filter((r) => r.id !== ruleId);
  saveAlertRules(rules);
}

/**
 * 更新告警规则
 */
export function updateAlertRule(ruleId: string, updates: Partial<AlertRule>): void {
  const rules = getAlertRules();
  const rule = rules.find((r) => r.id === ruleId);
  if (rule) {
    Object.assign(rule, updates);
    saveAlertRules(rules);
  }
}

/**
 * 获取某股票的告警规则
 */
export function getAlertsByCode(code: string): AlertRule[] {
  return getAlertRules().filter((r) => r.code === code);
}

// ========== 应用设置 ==========

/**
 * 获取应用设置
 */
export function getSettings(): AppSettings {
  const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
  return safeJsonParse(data, DEFAULT_SETTINGS);
}

/**
 * 保存应用设置
 */
export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

/**
 * 更新部分设置
 */
export function updateSettings(updates: Partial<AppSettings>): void {
  const settings = getSettings();
  Object.assign(settings, updates);
  saveSettings(settings);
}

// ========== 热力图配置 ==========

/**
 * 获取热力图配置
 */
export function getHeatmapConfig(): HeatmapConfig {
  const data = localStorage.getItem(STORAGE_KEYS.HEATMAP_CONFIG);
  return safeJsonParse(data, DEFAULT_SETTINGS.heatmapConfig);
}

/**
 * 保存热力图配置
 */
export function saveHeatmapConfig(config: HeatmapConfig): void {
  localStorage.setItem(STORAGE_KEYS.HEATMAP_CONFIG, JSON.stringify(config));
}

// ========== 指标配置 ==========

/**
 * 获取指标配置
 */
export function getIndicatorConfig(): IndicatorConfig {
  const data = localStorage.getItem(STORAGE_KEYS.INDICATOR_CONFIG);
  return safeJsonParse(data, DEFAULT_SETTINGS.indicatorConfig);
}

/**
 * 保存指标配置
 */
export function saveIndicatorConfig(config: IndicatorConfig): void {
  localStorage.setItem(STORAGE_KEYS.INDICATOR_CONFIG, JSON.stringify(config));
}

// ========== 表格列配置 ==========

/**
 * 获取表格列配置
 */
export function getTableColumns(pageKey: string): ColumnConfig[] | null {
  const data = localStorage.getItem(STORAGE_KEYS.TABLE_COLUMNS);
  const allConfigs = safeJsonParse<Record<string, ColumnConfig[]>>(data, {});
  return allConfigs[pageKey] || null;
}

/**
 * 保存表格列配置
 */
export function saveTableColumns(pageKey: string, columns: ColumnConfig[]): void {
  const data = localStorage.getItem(STORAGE_KEYS.TABLE_COLUMNS);
  const allConfigs = safeJsonParse<Record<string, ColumnConfig[]>>(data, {});
  allConfigs[pageKey] = columns;
  localStorage.setItem(STORAGE_KEYS.TABLE_COLUMNS, JSON.stringify(allConfigs));
}

// ========== 搜索历史 ==========

const MAX_SEARCH_HISTORY = 20;

/**
 * 获取搜索历史
 */
export function getSearchHistory(): SearchHistoryItem[] {
  const data = localStorage.getItem(STORAGE_KEYS.SEARCH_HISTORY);
  return safeJsonParse(data, []);
}

/**
 * 添加搜索历史
 */
export function addSearchHistory(item: Omit<SearchHistoryItem, 'timestamp'>): void {
  let history = getSearchHistory();
  // 移除重复项
  history = history.filter((h) => h.code !== item.code);
  // 添加到开头
  history.unshift({ ...item, timestamp: Date.now() });
  // 限制数量
  if (history.length > MAX_SEARCH_HISTORY) {
    history = history.slice(0, MAX_SEARCH_HISTORY);
  }
  localStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(history));
}

/**
 * 清除搜索历史
 */
export function clearSearchHistory(): void {
  localStorage.removeItem(STORAGE_KEYS.SEARCH_HISTORY);
}
