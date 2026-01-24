/**
 * 板块数据全局共享 Context
 * 避免多个页面重复请求相同的板块列表数据
 */

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { getIndustryList, getConceptList } from '@/services/sdk';
import type { IndustryBoard, ConceptBoard } from 'stock-sdk';

interface BoardDataContextValue {
  /** 行业板块列表 */
  industryList: IndustryBoard[];
  /** 概念板块列表 */
  conceptList: ConceptBoard[];
  /** 是否正在加载 */
  loading: boolean;
  /** 上次更新时间 */
  lastUpdated: number | null;
  /** 手动刷新数据 */
  refresh: () => Promise<void>;
}

const BoardDataContext = createContext<BoardDataContextValue | null>(null);

// 全局刷新间隔（30秒）
const REFRESH_INTERVAL = 30000;
// 最小刷新间隔（防止频繁刷新）
const MIN_REFRESH_INTERVAL = 10000;

interface BoardDataProviderProps {
  children: ReactNode;
}

export function BoardDataProvider({ children }: BoardDataProviderProps) {
  const [industryList, setIndustryList] = useState<IndustryBoard[]>([]);
  const [conceptList, setConceptList] = useState<ConceptBoard[]>([]);
  // 初始加载状态为 true，首次加载完成后变为 false
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  
  const isFetchingRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const isInitialLoadRef = useRef(true);

  // 获取板块数据
  const fetchData = useCallback(async (force = false) => {
    // 防止重复请求
    if (isFetchingRef.current) return;
    
    // 检查最小刷新间隔
    if (!force && lastUpdated && Date.now() - lastUpdated < MIN_REFRESH_INTERVAL) {
      return;
    }

    isFetchingRef.current = true;
    // 只在初始加载时显示 loading 状态，后续刷新不影响 loading
    // (loading 初始值已经是 true)

    try {
      const [industry, concept] = await Promise.all([
        getIndustryList(),
        getConceptList(),
      ]);
      
      setIndustryList(industry);
      setConceptList(concept);
      setLastUpdated(Date.now());
    } catch (error) {
      console.error('[BoardDataContext] Fetch error:', error);
    } finally {
      // 无论成功或失败，初始加载完成后都设置 loading 为 false
      if (isInitialLoadRef.current) {
        setLoading(false);
        isInitialLoadRef.current = false;
      }
      isFetchingRef.current = false;
    }
  }, [lastUpdated]);

  // 手动刷新
  const refresh = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  // 初始加载 + 定时刷新
  useEffect(() => {
    // 初始加载
    fetchData(true);

    // 设置定时刷新
    const startTimer = () => {
      timerRef.current = window.setInterval(() => {
        // 只在页面可见时刷新
        if (!document.hidden) {
          fetchData();
        }
      }, REFRESH_INTERVAL);
    };

    startTimer();

    // 页面可见性变化处理
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // 页面隐藏时停止定时器
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } else {
        // 页面显示时，如果数据过期则刷新
        if (lastUpdated && Date.now() - lastUpdated > REFRESH_INTERVAL) {
          fetchData();
        }
        // 重新启动定时器
        if (!timerRef.current) {
          startTimer();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchData, lastUpdated]);

  return (
    <BoardDataContext.Provider
      value={{
        industryList,
        conceptList,
        loading,
        lastUpdated,
        refresh,
      }}
    >
      {children}
    </BoardDataContext.Provider>
  );
}

/**
 * 使用板块数据 Hook
 */
export function useBoardData() {
  const context = useContext(BoardDataContext);
  if (!context) {
    throw new Error('useBoardData must be used within BoardDataProvider');
  }
  return context;
}
