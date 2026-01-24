/**
 * Stock SDK 服务层
 * 封装 SDK 调用，提供缓存与错误处理
 */

import { StockSDK } from 'stock-sdk';
import type { CacheItem } from '@/types';

// SDK 单例
export const sdk = new StockSDK({
  timeout: 30000,
  retry: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  },
});

// 内存缓存
const cache = new Map<string, CacheItem<unknown>>();

// 默认 TTL 配置（毫秒）
// 优化：增加缓存时间以减少 API 请求频率
const DEFAULT_TTL = {
  boardList: 60000, // 板块列表 60s（从 30s 增加）
  constituents: 180000, // 成分股 3min（从 2min 增加）
  historyKline: 600000, // 历史 K 线 10min
  indicatorKline: 600000, // 指标 K 线 10min
  quotes: 5000, // 实时行情 5s（从 3s 增加）
  fundFlow: 30000, // 资金流 30s（从 10s 增加）
  timeline: 5000, // 分时 5s（从 3s 增加）
};

/**
 * 生成缓存键
 */
function getCacheKey(method: string, ...args: unknown[]): string {
  return `${method}:${JSON.stringify(args)}`;
}

/**
 * 从缓存获取数据
 */
function getFromCache<T>(key: string): T | null {
  const item = cache.get(key) as CacheItem<T> | undefined;
  if (!item) return null;

  const now = Date.now();
  if (now - item.timestamp > item.ttl) {
    cache.delete(key);
    return null;
  }

  return item.data;
}

/**
 * 设置缓存
 */
function setCache<T>(key: string, data: T, ttl: number): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl,
  });
}

/**
 * 带缓存的 SDK 调用包装器
 */
async function withCache<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = getFromCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  const data = await fetcher();
  setCache(key, data, ttl);
  return data;
}

/**
 * 清除所有缓存
 */
export function clearAllCache(): void {
  cache.clear();
}

/**
 * 清除指定前缀的缓存
 */
export function clearCacheByPrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

// ========== 实时行情 API ==========

/**
 * 获取完整行情（A股/指数）
 */
export async function getFullQuotes(codes: string[], useCache = true) {
  const key = getCacheKey('getFullQuotes', codes);
  if (useCache) {
    return withCache(key, DEFAULT_TTL.quotes, () => sdk.getFullQuotes(codes));
  }
  return sdk.getFullQuotes(codes);
}

/**
 * 批量获取行情
 */
export async function getAllQuotesByCodes(
  codes: string[],
  options?: {
    batchSize?: number;
    concurrency?: number;
    onProgress?: (completed: number, total: number) => void;
  }
) {
  return sdk.getAllQuotesByCodes(codes, options);
}

/**
 * 获取全部 A 股行情
 */
export async function getAllAShareQuotes(options?: {
  batchSize?: number;
  concurrency?: number;
  onProgress?: (completed: number, total: number) => void;
}) {
  return sdk.getAllAShareQuotes(options);
}

// ========== K 线数据 API ==========

/**
 * 获取历史 K 线
 */
export async function getHistoryKline(
  symbol: string,
  options?: {
    period?: 'daily' | 'weekly' | 'monthly';
    adjust?: '' | 'qfq' | 'hfq';
    startDate?: string;
    endDate?: string;
  }
) {
  const key = getCacheKey('getHistoryKline', symbol, options);
  return withCache(key, DEFAULT_TTL.historyKline, () =>
    sdk.getHistoryKline(symbol, options)
  );
}

/**
 * 获取带指标的 K 线
 */
export async function getKlineWithIndicators(
  symbol: string,
  options?: {
    market?: 'A' | 'HK' | 'US';
    period?: 'daily' | 'weekly' | 'monthly';
    adjust?: '' | 'qfq' | 'hfq';
    startDate?: string;
    endDate?: string;
    indicators?: {
      ma?: { periods?: number[] } | boolean;
      macd?: { short?: number; long?: number; signal?: number } | boolean;
      boll?: { period?: number; stdDev?: number } | boolean;
      kdj?: { period?: number; kPeriod?: number; dPeriod?: number } | boolean;
      rsi?: { periods?: number[] } | boolean;
      wr?: { periods?: number[] } | boolean;
      bias?: { periods?: number[] } | boolean;
      cci?: { period?: number } | boolean;
      atr?: { period?: number } | boolean;
    };
  }
) {
  const key = getCacheKey('getKlineWithIndicators', symbol, options);
  return withCache(key, DEFAULT_TTL.indicatorKline, () =>
    sdk.getKlineWithIndicators(symbol, options)
  );
}

/**
 * 获取分钟 K 线
 */
export async function getMinuteKline(
  symbol: string,
  options?: {
    period?: '1' | '5' | '15' | '30' | '60';
    adjust?: '' | 'qfq' | 'hfq';
    startDate?: string;
    endDate?: string;
  }
) {
  return sdk.getMinuteKline(symbol, options);
}

/**
 * 获取当日分时
 */
export async function getTodayTimeline(code: string) {
  return sdk.getTodayTimeline(code);
}

// ========== 板块 API ==========

/**
 * 获取行业板块列表
 */
export async function getIndustryList() {
  const key = getCacheKey('getIndustryList');
  return withCache(key, DEFAULT_TTL.boardList, () => sdk.getIndustryList());
}

/**
 * 获取概念板块列表
 */
export async function getConceptList() {
  const key = getCacheKey('getConceptList');
  return withCache(key, DEFAULT_TTL.boardList, () => sdk.getConceptList());
}

/**
 * 获取行业成分股
 */
export async function getIndustryConstituents(symbol: string) {
  const key = getCacheKey('getIndustryConstituents', symbol);
  return withCache(key, DEFAULT_TTL.constituents, () =>
    sdk.getIndustryConstituents(symbol)
  );
}

/**
 * 获取概念成分股
 */
export async function getConceptConstituents(symbol: string) {
  const key = getCacheKey('getConceptConstituents', symbol);
  return withCache(key, DEFAULT_TTL.constituents, () =>
    sdk.getConceptConstituents(symbol)
  );
}

/**
 * 获取行业 K 线
 */
export async function getIndustryKline(
  symbol: string,
  options?: {
    period?: 'daily' | 'weekly' | 'monthly';
    adjust?: '' | 'qfq' | 'hfq';
    startDate?: string;
    endDate?: string;
  }
) {
  const key = getCacheKey('getIndustryKline', symbol, options);
  return withCache(key, DEFAULT_TTL.historyKline, () =>
    sdk.getIndustryKline(symbol, options)
  );
}

/**
 * 获取概念 K 线
 */
export async function getConceptKline(
  symbol: string,
  options?: {
    period?: 'daily' | 'weekly' | 'monthly';
    adjust?: '' | 'qfq' | 'hfq';
    startDate?: string;
    endDate?: string;
  }
) {
  const key = getCacheKey('getConceptKline', symbol, options);
  return withCache(key, DEFAULT_TTL.historyKline, () =>
    sdk.getConceptKline(symbol, options)
  );
}

/**
 * 获取行业分钟 K 线
 */
export async function getIndustryMinuteKline(
  symbol: string,
  options?: { period?: '1' | '5' | '15' | '30' | '60' }
) {
  return sdk.getIndustryMinuteKline(symbol, options);
}

/**
 * 获取概念分钟 K 线
 */
export async function getConceptMinuteKline(
  symbol: string,
  options?: { period?: '1' | '5' | '15' | '30' | '60' }
) {
  return sdk.getConceptMinuteKline(symbol, options);
}

/**
 * 获取行业 Spot 指标
 */
export async function getIndustrySpot(symbol: string) {
  return sdk.getIndustrySpot(symbol);
}

/**
 * 获取概念 Spot 指标
 */
export async function getConceptSpot(symbol: string) {
  return sdk.getConceptSpot(symbol);
}

// ========== 资金与大单 API ==========

/**
 * 获取资金流向
 */
export async function getFundFlow(codes: string[]) {
  const key = getCacheKey('getFundFlow', codes);
  return withCache(key, DEFAULT_TTL.fundFlow, () => sdk.getFundFlow(codes));
}

/**
 * 获取盘口大单
 */
export async function getPanelLargeOrder(codes: string[]) {
  const key = getCacheKey('getPanelLargeOrder', codes);
  return withCache(key, DEFAULT_TTL.fundFlow, () =>
    sdk.getPanelLargeOrder(codes)
  );
}

// ========== 搜索 API ==========

/**
 * 搜索股票/板块
 * @param keyword - 搜索关键词
 * @returns 搜索结果列表
 */
export async function search(keyword: string) {
  return sdk.search(keyword);
}

// ========== 其他 API ==========

/**
 * 获取交易日历
 */
export async function getTradingCalendar() {
  const key = getCacheKey('getTradingCalendar');
  return withCache(key, 3600000, () => sdk.getTradingCalendar()); // 1 小时缓存
}
