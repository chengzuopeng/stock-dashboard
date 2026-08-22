import type { AlertRule, WatchlistGroup } from '@/types';
import {
  WATCHLIST_STORAGE_KEYS,
  addAlertRule,
  addToWatchlist,
  batchAddToWatchlist,
  batchRemoveFromWatchlist,
  createWatchlistGroup,
  deleteAlertRule,
  deleteWatchlistGroup,
  getAlertRules,
  getWatchlistGroups,
  moveWatchlistCode,
  removeFromWatchlist,
  renameWatchlistGroup,
  updateAlertRule,
} from './storage';

export interface WatchlistState {
  groups: WatchlistGroup[];
  alerts: AlertRule[];
}

let state: WatchlistState | null = null;
const listeners = new Set<() => void>();

function readState(): WatchlistState {
  return { groups: getWatchlistGroups(), alerts: getAlertRules() };
}

function reload(): void {
  state = readState();
  listeners.forEach((listener) => listener());
}

function handleStorage(event: StorageEvent): void {
  if (event.key === null || WATCHLIST_STORAGE_KEYS.includes(event.key)) {
    reload();
  }
}

function mutate<T>(action: () => T): T {
  const result = action();
  reload();
  return result;
}

export const watchlistStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    if (listeners.size === 1) {
      state = readState();
      window.addEventListener('storage', handleStorage);
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        window.removeEventListener('storage', handleStorage);
      }
    };
  },
  getSnapshot(): WatchlistState {
    state ??= readState();
    return state;
  },
};

export function selectAllCodes(snapshot: WatchlistState): string[] {
  return Array.from(new Set(snapshot.groups.flatMap((group) => group.codes)));
}

export const watchlistActions = {
  add: (code: string, groupId?: string) => mutate(() => addToWatchlist(code, groupId)),
  remove: (code: string, groupId?: string) => mutate(() => removeFromWatchlist(code, groupId)),
  batchAdd: (codes: string[], groupId?: string) => mutate(() => batchAddToWatchlist(codes, groupId)),
  batchRemove: (codes: string[], groupId: string) =>
    mutate(() => batchRemoveFromWatchlist(codes, groupId)),
  move: (groupId: string, code: string, beforeCode: string | null) =>
    mutate(() => moveWatchlistCode(groupId, code, beforeCode)),
  createGroup: (name: string) => mutate(() => createWatchlistGroup(name)),
  deleteGroup: (groupId: string) => mutate(() => deleteWatchlistGroup(groupId)),
  renameGroup: (groupId: string, name: string) => mutate(() => renameWatchlistGroup(groupId, name)),
  addAlert: (rule: Omit<AlertRule, 'id' | 'createdAt'>) => mutate(() => addAlertRule(rule)),
  deleteAlert: (ruleId: string) => mutate(() => deleteAlertRule(ruleId)),
  updateAlert: (ruleId: string, updates: Partial<AlertRule>) =>
    mutate(() => updateAlertRule(ruleId, updates)),
};
