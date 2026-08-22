/**
 * 格式化工具函数
 */

/**
 * 格式化数字（千分位）
 */
export function formatNumber(
  value: number | null | undefined,
  decimals = 2
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '--';
  }
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * 格式化价格
 */
export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '--';
  }
  return value.toFixed(2);
}

/**
 * 格式化涨跌幅
 */
export function formatPercent(
  value: number | null | undefined,
  showSign = true
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '--';
  }
  // (-0.004).toFixed(2) === '-0.00'，微跌会显示成带负号的零
  const fixed = value.toFixed(2) === '-0.00' ? '0.00' : value.toFixed(2);
  const sign = showSign && value > 0 && fixed !== '0.00' ? '+' : '';
  return `${sign}${fixed}%`;
}

/**
 * 格式化涨跌额
 */
export function formatChange(
  value: number | null | undefined,
  showSign = true
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '--';
  }
  const fixed = value.toFixed(2) === '-0.00' ? '0.00' : value.toFixed(2);
  const sign = showSign && value > 0 && fixed !== '0.00' ? '+' : '';
  return `${sign}${fixed}`;
}

/**
 * 格式化成交量（手）
 */
export function formatVolume(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '--';
  }
  if (value >= 100000000) {
    return `${(value / 100000000).toFixed(2)}亿`;
  }
  if (value >= 10000) {
    return `${(value / 10000).toFixed(2)}万`;
  }
  return value.toFixed(0);
}

/**
 * 格式化成交额（万元）
 */
export function formatAmount(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '--';
  }
  if (value >= 10000) {
    return `${(value / 10000).toFixed(2)}亿`;
  }
  if (value >= 1) {
    return `${value.toFixed(2)}万`;
  }
  return `${(value * 10000).toFixed(0)}元`;
}

/**
 * 格式化金额（元）
 */
export function formatYuanAmount(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '--';
  }

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1000000000000) {
    return `${sign}${(absValue / 1000000000000).toFixed(2)}万亿`;
  }
  if (absValue >= 100000000) {
    return `${sign}${(absValue / 100000000).toFixed(2)}亿`;
  }
  if (absValue >= 10000) {
    return `${sign}${(absValue / 10000).toFixed(2)}万`;
  }

  return `${sign}${absValue.toFixed(0)}元`;
}

/**
 * 格式化通用大数（非金额）
 */
export function formatCompactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '--';
  }

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 100000000) {
    return `${sign}${(absValue / 100000000).toFixed(2)}亿`;
  }
  if (absValue >= 10000) {
    return `${sign}${(absValue / 10000).toFixed(2)}万`;
  }

  return `${sign}${absValue.toFixed(0)}`;
}

/**
 * 格式化市值（亿）
 */
export function formatMarketCap(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '--';
  }
  if (value >= 10000) {
    return `${(value / 10000).toFixed(2)}万亿`;
  }
  return `${value.toFixed(2)}亿`;
}

/**
 * 格式化换手率
 */
export function formatTurnover(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '--';
  }
  return `${value.toFixed(2)}%`;
}

/**
 * 格式化量比
 */
export function formatVolumeRatio(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '--';
  }
  return value.toFixed(2);
}

/**
 * 格式化 PE/PB
 */
export function formatRatio(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '--';
  }
  if (value < 0) {
    return '亏损';
  }
  return value.toFixed(2);
}

/**
 * 获取涨跌颜色类名
 */
export function getChangeColorClass(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value) || value === 0) {
    return 'text-flat';
  }
  return value > 0 ? 'text-rise' : 'text-fall';
}

/**
 * 解析股票代码，返回市场和代码
 */
export function parseStockCode(code: string): { market: string; symbol: string } {
  const trimmed = code.trim();
  if (!trimmed) return { market: '', symbol: '' };

  const prefixMatch = trimmed.match(/^(sh|sz|bj)\.?(\d{6})$/i);
  if (prefixMatch) {
    return {
      market: prefixMatch[1].toLowerCase(),
      symbol: prefixMatch[2],
    };
  }

  const suffixMatch = trimmed.match(/^(\d{6})\.(sh|sz|bj)$/i);
  if (suffixMatch) {
    return {
      market: suffixMatch[2].toLowerCase(),
      symbol: suffixMatch[1],
    };
  }

  const numericMatch = trimmed.match(/^\d{6}$/);
  if (numericMatch) {
    // 根据代码推断市场（仅 6 位 A 股）
    if (trimmed.startsWith('6')) {
      return { market: 'sh', symbol: trimmed };
    }
    if (trimmed.startsWith('0') || trimmed.startsWith('3')) {
      return { market: 'sz', symbol: trimmed };
    }
    if (
      trimmed.startsWith('4') ||
      trimmed.startsWith('8') ||
      trimmed.startsWith('92')
    ) {
      return { market: 'bj', symbol: trimmed };
    }
  }

  return { market: '', symbol: trimmed };
}

/**
 * 标准化股票代码（带市场前缀）
 */
export function normalizeStockCode(code: string): string {
  const trimmed = code.trim();
  if (!trimmed) return '';
  const { market, symbol } = parseStockCode(trimmed);
  if (market) {
    return `${market}${symbol}`;
  }
  return trimmed;
}

export function toYmd(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}${month}${day}`;
}
