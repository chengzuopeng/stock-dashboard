import { describe, expect, it } from 'vitest';
import type { TodayTimelineResponse } from 'stock-sdk';
import { calculateTimelineStrength, getLimitPercent, isLimitDown, isLimitUp } from './analysis';

describe('getLimitPercent', () => {
  it('uses board-specific limits', () => {
    expect(getLimitPercent('sh600000', '样例')).toBe(10);
    expect(getLimitPercent('sz300750', '样例')).toBe(20);
    expect(getLimitPercent('sh688981', '样例')).toBe(20);
    expect(getLimitPercent('bj920002', '样例')).toBe(30);
    expect(getLimitPercent('bj430047', '样例')).toBe(30);
  });

  it('applies the ST limit on the main board only', () => {
    expect(getLimitPercent('sz000001', '*ST样例')).toBe(5);
    expect(getLimitPercent('sz300001', 'ST样例')).toBe(20);
  });
});

describe('isLimitUp / isLimitDown', () => {
  it('treats values within tolerance of the limit as limit moves', () => {
    expect(isLimitUp({ code: 'sh600000', name: '样例', changePercent: 9.95 })).toBe(true);
    expect(isLimitUp({ code: 'sh600000', name: '样例', changePercent: 9.5 })).toBe(false);
    expect(isLimitUp({ code: 'sz300001', name: '样例', changePercent: 10 })).toBe(false);
    expect(isLimitDown({ code: 'sz300001', name: '样例', changePercent: -19.9 })).toBe(true);
  });

  it('ignores missing change percent', () => {
    expect(isLimitUp({ code: 'sh600000', name: '样例', changePercent: null })).toBe(false);
    expect(isLimitDown({ code: 'sh600000', name: '样例', changePercent: null })).toBe(false);
  });
});

describe('calculateTimelineStrength', () => {
  it('returns a zero ratio for an empty timeline', () => {
    const timeline = { data: [] } as unknown as TodayTimelineResponse;
    expect(calculateTimelineStrength(timeline)).toEqual({ ratio: 0, points: [] });
  });

  it('computes the share of points at or above the average price', () => {
    const timeline = {
      data: [
        { time: '09:30', price: 10, avgPrice: 10 },
        { time: '09:31', price: 10.2, avgPrice: 10.1 },
        { time: '09:32', price: 9.9, avgPrice: 10.05 },
        { time: '09:33', price: 10.1, avgPrice: 10.05 },
      ],
    } as unknown as TodayTimelineResponse;

    const { ratio, points } = calculateTimelineStrength(timeline);
    expect(ratio).toBe(75);
    expect(points).toHaveLength(4);
  });
});
