import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStorage } from '@/test/memoryStorage';

async function loadStore() {
  vi.resetModules();
  return import('./watchlistStore');
}

function storedCodes(): string[] {
  return JSON.parse(localStorage.getItem('watchlist.groups') ?? '[]')[0]?.codes ?? [];
}

beforeEach(() => {
  vi.stubGlobal('localStorage', createMemoryStorage());
  vi.stubGlobal('window', new EventTarget());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('watchlistStore', () => {
  it('keeps the snapshot stable until a mutation, then notifies subscribers', async () => {
    const { watchlistStore, watchlistActions } = await loadStore();
    const listener = vi.fn();
    const unsubscribe = watchlistStore.subscribe(listener);
    const before = watchlistStore.getSnapshot();

    expect(watchlistStore.getSnapshot()).toBe(before);

    watchlistActions.add('600519');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(watchlistStore.getSnapshot()).not.toBe(before);
    expect(watchlistStore.getSnapshot().groups[0].codes).toEqual(['sh600519']);
    unsubscribe();
  });

  it('moves a code without dropping codes written elsewhere', async () => {
    const { watchlistStore, watchlistActions } = await loadStore();
    watchlistActions.batchAdd(['sh600519', 'sz000001']);
    watchlistStore.getSnapshot();

    const storage = await import('./storage');
    storage.addToWatchlist('sz000858');

    watchlistActions.move('default', 'sz000001', 'sh600519');

    expect(storedCodes()).toEqual(['sz000001', 'sh600519', 'sz000858']);
  });

  it('reloads the snapshot when another tab writes watchlist data', async () => {
    const { watchlistStore } = await loadStore();
    const listener = vi.fn();
    const unsubscribe = watchlistStore.subscribe(listener);
    expect(watchlistStore.getSnapshot().groups[0].codes).toEqual([]);

    const now = Date.now();
    localStorage.setItem(
      'watchlist.groups',
      JSON.stringify([{ id: 'default', name: '默认分组', codes: ['sh600036'], createdAt: now, updatedAt: now }])
    );
    window.dispatchEvent(Object.assign(new Event('storage'), { key: 'watchlist.groups' }));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(watchlistStore.getSnapshot().groups[0].codes).toEqual(['sh600036']);
    unsubscribe();
  });
});
