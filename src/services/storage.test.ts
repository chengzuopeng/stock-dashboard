import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addToWatchlist,
  getAlertRules,
  getAllWatchlistCodes,
  getSettings,
  getWatchlistGroups,
  markAlertRulesTriggered,
} from './storage';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => Array.from(store.keys())[index] ?? null,
    removeItem: (key) => {
      store.delete(key);
    },
    setItem: (key, value) => {
      store.set(key, String(value));
    },
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', createMemoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getWatchlistGroups', () => {
  it('falls back to a fresh default group when stored data is malformed', () => {
    localStorage.setItem('watchlist.groups', '{}');
    const first = getWatchlistGroups();
    expect(first.map((group) => group.id)).toEqual(['default']);

    first[0].codes.push('sh600519');
    localStorage.setItem('watchlist.groups', 'null');
    expect(getWatchlistGroups()[0].codes).toEqual([]);
  });

  it('normalizes and dedupes stored codes, then persists the result', () => {
    localStorage.setItem(
      'watchlist.groups',
      JSON.stringify([
        { id: 'default', name: '默认分组', codes: ['600519', 'SH600519', 'sz000001', ''], createdAt: 0, updatedAt: 0 },
      ])
    );

    expect(getWatchlistGroups()[0].codes).toEqual(['sh600519', 'sz000001']);
    expect(JSON.parse(localStorage.getItem('watchlist.groups') ?? '[]')[0].codes).toEqual([
      'sh600519',
      'sz000001',
    ]);
  });
});

describe('addToWatchlist', () => {
  it('adds a normalized code only once', () => {
    addToWatchlist('600519');
    addToWatchlist('sh600519');
    expect(getAllWatchlistCodes()).toEqual(['sh600519']);
  });
});

describe('getAlertRules', () => {
  it('returns an empty list for non-array data', () => {
    localStorage.setItem('watchlist.alerts', '{"id":1}');
    expect(getAlertRules()).toEqual([]);
  });
});

describe('markAlertRulesTriggered', () => {
  it('stamps only the given rules in a single write', () => {
    localStorage.setItem(
      'watchlist.alerts',
      JSON.stringify([
        { id: 'a', lastTriggeredAt: 0 },
        { id: 'b', lastTriggeredAt: 0 },
        { id: 'c', lastTriggeredAt: 0 },
      ])
    );
    const setItem = vi.spyOn(localStorage, 'setItem');

    markAlertRulesTriggered(['a', 'c'], 123);

    expect(setItem).toHaveBeenCalledTimes(1);
    expect(getAlertRules().map((rule) => [rule.id, rule.lastTriggeredAt])).toEqual([
      ['a', 123],
      ['b', 0],
      ['c', 123],
    ]);
  });
});

describe('getSettings', () => {
  it('merges partial stored settings over defaults', () => {
    localStorage.setItem(
      'app.settings',
      JSON.stringify({ colorMode: 'green-rise', indicatorConfig: { macd: { short: 5 } } })
    );

    const settings = getSettings();
    expect(settings.colorMode).toBe('green-rise');
    expect(settings.indicatorConfig.macd).toEqual({ short: 5, long: 26, signal: 9 });
    expect(settings.indicatorConfig.boll).toEqual({ period: 20, stdDev: 2 });
  });
});
