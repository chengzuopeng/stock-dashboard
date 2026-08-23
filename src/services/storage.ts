/**
 * 本地存储服务
 * 管理自选、告警、配置等持久化数据
 */

import type {
  WatchlistGroup,
  AlertRule,
  AppSettings,
  SearchHistoryItem,
  ColumnConfig,
} from '@/types';
import { normalizeStockCode } from '@/utils/format';

// 存储键（eod 三个 key 沿用旧字面量，保证既有用户数据不丢）
const STORAGE_KEYS = {
  WATCHLIST_GROUPS: 'watchlist.groups',
  ALERTS: 'watchlist.alerts',
  SETTINGS: 'app.settings',
  TABLE_COLUMNS: 'ui.tableColumns',
  HEATMAP_CONFIG: 'ui.heatmapConfig',
  INDICATOR_CONFIG: 'ui.indicatorConfig',
  SEARCH_HISTORY: 'search.recent',
  EOD_FILTERS: 'end-of-day-picker-settings',
  EOD_SCHEMES: 'end-of-day-picker-schemes',
  EOD_RECENT: 'end-of-day-picker-recent',
} as const;

export const WATCHLIST_STORAGE_KEYS: readonly string[] = [
  STORAGE_KEYS.WATCHLIST_GROUPS,
  STORAGE_KEYS.ALERTS,
];

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
    topK: 200,
  },
  indicatorConfig: {
    ma: [5, 10, 20, 60],
    macd: { short: 12, long: 26, signal: 9 },
    boll: { period: 20, stdDev: 2 },
    kdj: { period: 9, kPeriod: 3, dPeriod: 3 },
    rsi: [6, 12, 24],
    dmi: { period: 14, adxPeriod: 14 },
    sar: { afStart: 0.02, afIncrement: 0.02, afMax: 0.2 },
    kc: { emaPeriod: 20, atrPeriod: 10, multiplier: 2 },
  },
};

// 每次调用返回全新对象：fallback 若共享引用，调用方的原地 mutation 会污染后续 fallback
function createDefaultWatchlistGroups(): WatchlistGroup[] {
  const now = Date.now();
  return [
    {
      id: 'default',
      name: '默认分组',
      codes: [],
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWatchlistGroupArray(value: unknown): value is WatchlistGroup[] {
  return (
    Array.isArray(value) &&
    value.every(
      (g) =>
        isPlainObject(g) &&
        typeof g.id === 'string' &&
        Array.isArray(g.codes) &&
        (g.codes as unknown[]).every((c) => typeof c === 'string')
    )
  );
}

/**
 * 安全读取 JSON；validator 校验形状，不通过一律回退 fallback（防旧版本/手改脏数据打崩渲染）
 */
function safeJsonParse<T>(
  value: string | null,
  fallback: T,
  isValid?: (parsed: unknown) => boolean
): T {
  if (!value) return fallback;
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed === null || parsed === undefined) return fallback;
    if (isValid && !isValid(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

function safeSetItem(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`localStorage write failed: ${key}`, error);
    return false;
  }
}

// ========== 自选分组 ==========

/**
 * 获取所有自选分组
 */
export function getWatchlistGroups(): WatchlistGroup[] {
  const data = localStorage.getItem(STORAGE_KEYS.WATCHLIST_GROUPS);
  const groups = safeJsonParse(data, createDefaultWatchlistGroups(), isWatchlistGroupArray);
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
  safeSetItem(STORAGE_KEYS.WATCHLIST_GROUPS, groups);
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

/**
 * 批量从自选移除股票
 */
export function batchRemoveFromWatchlist(codes: string[], groupId: string): void {
  const normalizedCodes = codes.map(normalizeStockCode).filter(Boolean) as string[];
  if (normalizedCodes.length === 0) return;
  
  const groups = getWatchlistGroups();
  const group = groups.find((g) => g.id === groupId);
  if (group) {
    group.codes = group.codes.filter((c) => !normalizedCodes.includes(c));
    group.updatedAt = Date.now();
    saveWatchlistGroups(groups);
  }
}

/**
 * 批量添加股票到自选
 */
export function batchAddToWatchlist(codes: string[], groupId = 'default'): number {
  const groups = getWatchlistGroups();
  const group = groups.find((g) => g.id === groupId);
  if (!group) return 0;
  
  let addedCount = 0;
  codes.forEach((code) => {
    const normalizedCode = normalizeStockCode(code);
    if (normalizedCode && !group.codes.includes(normalizedCode)) {
      group.codes.push(normalizedCode);
      addedCount++;
    }
  });
  
  if (addedCount > 0) {
    group.updatedAt = Date.now();
    saveWatchlistGroups(groups);
  }
  
  return addedCount;
}

/**
 * 更新分组内股票顺序
 */
export function moveWatchlistCode(groupId: string, code: string, beforeCode: string | null): void {
  const normalizedCode = normalizeStockCode(code);
  const normalizedBefore = beforeCode ? normalizeStockCode(beforeCode) : null;
  if (normalizedCode === normalizedBefore) return;
  const groups = getWatchlistGroups();
  const group = groups.find((g) => g.id === groupId);
  if (!group || !group.codes.includes(normalizedCode)) return;
  const codes = group.codes.filter((c) => c !== normalizedCode);
  const targetIndex = normalizedBefore ? codes.indexOf(normalizedBefore) : -1;
  codes.splice(targetIndex === -1 ? codes.length : targetIndex, 0, normalizedCode);
  group.codes = codes;
  group.updatedAt = Date.now();
  saveWatchlistGroups(groups);
}

// ========== 告警规则 ==========

/**
 * 获取所有告警规则
 */
export function getAlertRules(): AlertRule[] {
  const data = localStorage.getItem(STORAGE_KEYS.ALERTS);
  return safeJsonParse<AlertRule[]>(data, [], Array.isArray);
}

/**
 * 保存告警规则
 */
export function saveAlertRules(rules: AlertRule[]): void {
  safeSetItem(STORAGE_KEYS.ALERTS, rules);
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
export function markAlertRulesTriggered(ruleIds: string[], triggeredAt: number): void {
  const ids = new Set(ruleIds);
  const rules = getAlertRules();
  rules.forEach((rule) => {
    if (ids.has(rule.id)) rule.lastTriggeredAt = triggeredAt;
  });
  saveAlertRules(rules);
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
  const legacyHeatmapConfig = safeJsonParse(
    localStorage.getItem(STORAGE_KEYS.HEATMAP_CONFIG),
    DEFAULT_SETTINGS.heatmapConfig,
    isPlainObject
  );
  const legacyIndicatorConfig = safeJsonParse(
    localStorage.getItem(STORAGE_KEYS.INDICATOR_CONFIG),
    DEFAULT_SETTINGS.indicatorConfig,
    isPlainObject
  );
  const parsed = safeJsonParse<Partial<AppSettings>>(data, {}, isPlainObject);

  return {
    ...DEFAULT_SETTINGS,
    ...parsed,
    refreshInterval: {
      ...DEFAULT_SETTINGS.refreshInterval,
      ...parsed.refreshInterval,
    },
    heatmapConfig: {
      ...DEFAULT_SETTINGS.heatmapConfig,
      ...legacyHeatmapConfig,
      ...parsed.heatmapConfig,
    },
    indicatorConfig: {
      ...DEFAULT_SETTINGS.indicatorConfig,
      ...legacyIndicatorConfig,
      ...parsed.indicatorConfig,
      macd: {
        ...DEFAULT_SETTINGS.indicatorConfig.macd,
        ...legacyIndicatorConfig.macd,
        ...parsed.indicatorConfig?.macd,
      },
      boll: {
        ...DEFAULT_SETTINGS.indicatorConfig.boll,
        ...legacyIndicatorConfig.boll,
        ...parsed.indicatorConfig?.boll,
      },
      kdj: {
        ...DEFAULT_SETTINGS.indicatorConfig.kdj,
        ...legacyIndicatorConfig.kdj,
        ...parsed.indicatorConfig?.kdj,
      },
      dmi: {
        ...DEFAULT_SETTINGS.indicatorConfig.dmi,
        ...legacyIndicatorConfig.dmi,
        ...parsed.indicatorConfig?.dmi,
      },
      sar: {
        ...DEFAULT_SETTINGS.indicatorConfig.sar,
        ...legacyIndicatorConfig.sar,
        ...parsed.indicatorConfig?.sar,
      },
      kc: {
        ...DEFAULT_SETTINGS.indicatorConfig.kc,
        ...legacyIndicatorConfig.kc,
        ...parsed.indicatorConfig?.kc,
      },
    },
  };
}

/**
 * 保存应用设置
 */
export function saveSettings(settings: AppSettings): void {
  safeSetItem(STORAGE_KEYS.SETTINGS, settings);
  safeSetItem(STORAGE_KEYS.HEATMAP_CONFIG, settings.heatmapConfig);
  safeSetItem(STORAGE_KEYS.INDICATOR_CONFIG, settings.indicatorConfig);
}

/**
 * 更新部分设置
 */
export function updateSettings(updates: Partial<AppSettings>): void {
  const settings = getSettings();
  Object.assign(settings, updates);
  saveSettings(settings);
}

// ========== 表格列配置 ==========

/**
 * 获取表格列配置
 */
export function getTableColumns(pageKey: string): ColumnConfig[] | null {
  const data = localStorage.getItem(STORAGE_KEYS.TABLE_COLUMNS);
  const allConfigs = safeJsonParse<Record<string, ColumnConfig[]>>(data, {}, isPlainObject);
  const columns = allConfigs[pageKey];
  return Array.isArray(columns) ? columns : null;
}

/**
 * 保存表格列配置
 */
export function saveTableColumns(pageKey: string, columns: ColumnConfig[]): void {
  const data = localStorage.getItem(STORAGE_KEYS.TABLE_COLUMNS);
  const allConfigs = safeJsonParse<Record<string, ColumnConfig[]>>(data, {}, isPlainObject);
  allConfigs[pageKey] = columns;
  safeSetItem(STORAGE_KEYS.TABLE_COLUMNS, allConfigs);
}

// ========== 尾盘选股页面状态 ==========

const EOD_KEY_MAP = {
  filters: STORAGE_KEYS.EOD_FILTERS,
  schemes: STORAGE_KEYS.EOD_SCHEMES,
  recent: STORAGE_KEYS.EOD_RECENT,
} as const;

export function getEodPickerState<T>(kind: keyof typeof EOD_KEY_MAP, fallback: T): T {
  const data = localStorage.getItem(EOD_KEY_MAP[kind]);
  const isValid = kind === 'filters' ? isPlainObject : Array.isArray;
  return safeJsonParse(data, fallback, isValid);
}

export function saveEodPickerState(kind: keyof typeof EOD_KEY_MAP, value: unknown): boolean {
  return safeSetItem(EOD_KEY_MAP[kind], value);
}

// ========== 搜索历史 ==========

const MAX_SEARCH_HISTORY = 20;

/**
 * 获取搜索历史
 */
export function getSearchHistory(): SearchHistoryItem[] {
  const data = localStorage.getItem(STORAGE_KEYS.SEARCH_HISTORY);
  return safeJsonParse<SearchHistoryItem[]>(data, [], Array.isArray);
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
  safeSetItem(STORAGE_KEYS.SEARCH_HISTORY, history);
}

/**
 * 清除搜索历史
 */
export function clearSearchHistory(): void {
  localStorage.removeItem(STORAGE_KEYS.SEARCH_HISTORY);
}
