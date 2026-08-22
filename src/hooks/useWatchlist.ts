import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { selectAllCodes, watchlistStore, type WatchlistState } from '@/services/watchlistStore';
import type { AlertRule } from '@/types';
import { normalizeStockCode } from '@/utils/format';

export function useWatchlistState(): WatchlistState {
  return useSyncExternalStore(watchlistStore.subscribe, watchlistStore.getSnapshot);
}

export function useAllWatchlistCodes(): string[] {
  const snapshot = useWatchlistState();
  return useMemo(() => selectAllCodes(snapshot), [snapshot]);
}

export function useIsInWatchlist(): (code: string) => boolean {
  const codes = useAllWatchlistCodes();
  const codeSet = useMemo(() => new Set(codes), [codes]);
  return useCallback((code: string) => codeSet.has(normalizeStockCode(code)), [codeSet]);
}

export function useAlertRules(code?: string): AlertRule[] {
  const { alerts } = useWatchlistState();
  return useMemo(() => {
    if (!code) return alerts;
    const normalizedCode = normalizeStockCode(code);
    return alerts.filter((rule) => normalizeStockCode(rule.code) === normalizedCode);
  }, [alerts, code]);
}
