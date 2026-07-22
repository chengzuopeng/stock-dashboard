import { describe, expect, it } from 'vitest';
import {
  formatAmount,
  formatChange,
  formatMarketCap,
  formatPercent,
  formatPrice,
  formatRatio,
  formatYuanAmount,
  getChangeColorClass,
  normalizeStockCode,
  parseStockCode,
} from './format';

describe('parseStockCode', () => {
  it('parses prefixed and suffixed codes', () => {
    expect(parseStockCode('SH600519')).toEqual({ market: 'sh', symbol: '600519' });
    expect(parseStockCode('sz.000001')).toEqual({ market: 'sz', symbol: '000001' });
    expect(parseStockCode('300750.SZ')).toEqual({ market: 'sz', symbol: '300750' });
  });

  it('infers market from bare six-digit codes', () => {
    expect(parseStockCode('600519').market).toBe('sh');
    expect(parseStockCode('000001').market).toBe('sz');
    expect(parseStockCode('300750').market).toBe('sz');
    expect(parseStockCode('430047').market).toBe('bj');
    expect(parseStockCode('830799').market).toBe('bj');
    expect(parseStockCode('920002').market).toBe('bj');
  });

  it('leaves the market empty for unrecognized input', () => {
    expect(parseStockCode('')).toEqual({ market: '', symbol: '' });
    expect(parseStockCode('AAPL')).toEqual({ market: '', symbol: 'AAPL' });
  });
});

describe('normalizeStockCode', () => {
  it('normalizes to a lowercase market prefix', () => {
    expect(normalizeStockCode(' 600519 ')).toBe('sh600519');
    expect(normalizeStockCode('SZ000001')).toBe('sz000001');
  });

  it('keeps unrecognized input trimmed', () => {
    expect(normalizeStockCode(' AAPL ')).toBe('AAPL');
    expect(normalizeStockCode('   ')).toBe('');
  });
});

describe('percent and change formatting', () => {
  it('adds a plus sign only for visible positive values', () => {
    expect(formatPercent(1.234)).toBe('+1.23%');
    expect(formatPercent(0.004)).toBe('0.00%');
    expect(formatPercent(2, false)).toBe('2.00%');
  });

  it('never renders a negative zero', () => {
    expect(formatPercent(-0.004)).toBe('0.00%');
    expect(formatChange(-0.001)).toBe('0.00');
    expect(formatChange(-1.5)).toBe('-1.50');
  });

  it('renders placeholders for missing values', () => {
    expect(formatPercent(null)).toBe('--');
    expect(formatPrice(Number.NaN)).toBe('--');
    expect(formatAmount(undefined)).toBe('--');
  });
});

describe('unit formatting', () => {
  it('formats amounts given in ten-thousand yuan', () => {
    expect(formatAmount(12345)).toBe('1.23亿');
    expect(formatAmount(12.5)).toBe('12.50万');
    expect(formatAmount(0.5)).toBe('5000元');
  });

  it('formats amounts given in yuan with sign', () => {
    expect(formatYuanAmount(-123456789)).toBe('-1.23亿');
    expect(formatYuanAmount(1.5e12)).toBe('1.50万亿');
    expect(formatYuanAmount(500)).toBe('500元');
  });

  it('formats market caps given in hundred-million yuan', () => {
    expect(formatMarketCap(15700)).toBe('1.57万亿');
    expect(formatMarketCap(88.8)).toBe('88.80亿');
  });

  it('marks negative ratios as loss', () => {
    expect(formatRatio(-3)).toBe('亏损');
    expect(formatRatio(12.3)).toBe('12.30');
  });
});

describe('getChangeColorClass', () => {
  it('maps sign to color class', () => {
    expect(getChangeColorClass(1)).toBe('text-rise');
    expect(getChangeColorClass(-1)).toBe('text-fall');
    expect(getChangeColorClass(0)).toBe('text-flat');
    expect(getChangeColorClass(null)).toBe('text-flat');
  });
});
