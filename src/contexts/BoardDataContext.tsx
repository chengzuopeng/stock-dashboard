/**
 * 板块数据全局共享 Context
 * 避免多个页面重复请求相同的板块列表数据
 */

import { useState, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { getIndustryList, getConceptList } from '@/services/sdk';
import type { IndustryBoard, ConceptBoard } from 'stock-sdk';
import { BoardDataContext } from './boardDataValueContext';
import { useAppSettings } from './useAppSettings';
import { usePolling } from '@/hooks';

// 最小刷新间隔（防止频繁刷新）
const MIN_REFRESH_INTERVAL = 10000;

interface BoardDataProviderProps {
  children: ReactNode;
}

export function BoardDataProvider({ children }: BoardDataProviderProps) {
  const { getRefreshInterval } = useAppSettings();
  const [industryList, setIndustryList] = useState<IndustryBoard[]>([]);
  const [conceptList, setConceptList] = useState<ConceptBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [subscriberCount, setSubscriberCount] = useState(0);

  const isFetchingRef = useRef(false);
  // 节流基准走 ref：进 useCallback 依赖会让每次成功拉取都重建回调、重触发轮询 effect
  const lastUpdatedRef = useRef<number | null>(null);
  const isInitialLoadRef = useRef(true);
  const refreshInterval = Math.max(getRefreshInterval('list'), 30000);

  const fetchData = useCallback(async (force = false) => {
    if (isFetchingRef.current) return;
    if (
      !force &&
      lastUpdatedRef.current &&
      Date.now() - lastUpdatedRef.current < MIN_REFRESH_INTERVAL
    ) {
      return;
    }

    isFetchingRef.current = true;
    try {
      const [industry, concept] = await Promise.all([
        getIndustryList(),
        getConceptList(),
      ]);

      setIndustryList(industry);
      setConceptList(concept);
      lastUpdatedRef.current = Date.now();
      setLastUpdated(lastUpdatedRef.current);
    } catch (error) {
      console.error('[BoardDataContext] Fetch error:', error);
    } finally {
      if (isInitialLoadRef.current) {
        setLoading(false);
        isInitialLoadRef.current = false;
      }
      isFetchingRef.current = false;
    }
  }, []);

  const subscribe = useCallback(() => {
    setSubscriberCount((count) => count + 1);
    return () => setSubscriberCount((count) => count - 1);
  }, []);

  usePolling(fetchData, {
    interval: refreshInterval,
    enabled: subscriberCount > 0,
    pauseOnHidden: true,
    immediate: true,
  });

  const refresh = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  const value = useMemo(
    () => ({
      industryList,
      conceptList,
      loading,
      lastUpdated,
      refresh,
      subscribe,
    }),
    [industryList, conceptList, loading, lastUpdated, refresh, subscribe]
  );

  return (
    <BoardDataContext.Provider value={value}>
      {children}
    </BoardDataContext.Provider>
  );
}
