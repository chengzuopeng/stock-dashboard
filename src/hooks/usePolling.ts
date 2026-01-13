/**
 * 轮询 Hook
 * 支持页面可见性检测、自动暂停/恢复
 */

import { useEffect, useRef, useCallback, useState } from 'react';

interface UsePollingOptions {
  /** 轮询间隔（毫秒） */
  interval: number;
  /** 是否启用 */
  enabled?: boolean;
  /** 页面不可见时是否暂停 */
  pauseOnHidden?: boolean;
  /** 立即执行一次 */
  immediate?: boolean;
}

interface UsePollingReturn {
  /** 是否正在加载 */
  isLoading: boolean;
  /** 上次刷新时间 */
  lastRefresh: number | null;
  /** 手动刷新 */
  refresh: () => Promise<void>;
  /** 暂停轮询 */
  pause: () => void;
  /** 恢复轮询 */
  resume: () => void;
  /** 是否暂停中 */
  isPaused: boolean;
}

/**
 * 轮询 Hook
 * @param fetcher 数据获取函数
 * @param options 配置选项
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  options: UsePollingOptions
): UsePollingReturn {
  const {
    interval,
    enabled = true,
    pauseOnHidden = true,
    immediate = true,
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const timerRef = useRef<number | null>(null);
  const fetcherRef = useRef(fetcher);
  const isMountedRef = useRef(true);

  // 更新 fetcher 引用
  fetcherRef.current = fetcher;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!isMountedRef.current) return;
    setIsLoading(true);
    try {
      await fetcherRef.current();
      if (isMountedRef.current) {
        setLastRefresh(Date.now());
      }
    } catch (error) {
      console.error('[usePolling] Fetch error:', error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const scheduleNext = useCallback(() => {
    clearTimer();
    if (!isMountedRef.current || isPaused || !enabled) return;
    timerRef.current = window.setTimeout(async () => {
      await refresh();
      scheduleNext();
    }, interval);
  }, [clearTimer, interval, isPaused, enabled, refresh]);

  const pause = useCallback(() => {
    setIsPaused(true);
    clearTimer();
  }, [clearTimer]);

  const resume = useCallback(() => {
    setIsPaused(false);
  }, []);

  // 页面可见性变化处理
  useEffect(() => {
    if (!pauseOnHidden) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearTimer();
      } else if (!isPaused && enabled) {
        refresh().then(scheduleNext);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pauseOnHidden, isPaused, enabled, clearTimer, refresh, scheduleNext]);

  // 启动/停止轮询
  useEffect(() => {
    isMountedRef.current = true;

    if (enabled && !isPaused) {
      if (immediate) {
        refresh().then(scheduleNext);
      } else {
        scheduleNext();
      }
    }

    return () => {
      isMountedRef.current = false;
      clearTimer();
    };
  }, [enabled, isPaused, immediate, refresh, scheduleNext, clearTimer]);

  // isPaused 变化时重新调度
  useEffect(() => {
    if (!isPaused && enabled) {
      scheduleNext();
    }
  }, [isPaused, enabled, scheduleNext]);

  return {
    isLoading,
    lastRefresh,
    refresh,
    pause,
    resume,
    isPaused,
  };
}
