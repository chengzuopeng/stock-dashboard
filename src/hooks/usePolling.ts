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
  refreshKey?: string;
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
    refreshKey,
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const timerRef = useRef<number | null>(null);
  const fetcherRef = useRef(fetcher);
  const isMountedRef = useRef(true);
  // 请求在途时 pause/切后台，完成回调里的闭包是过期的——一律经 ref 读最新状态再决定是否续排
  const stateRef = useRef({ enabled, isPaused, pauseOnHidden, interval });

  fetcherRef.current = fetcher;
  stateRef.current = { enabled, isPaused, pauseOnHidden, interval };

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const canRun = useCallback(() => {
    const state = stateRef.current;
    if (!isMountedRef.current || !state.enabled || state.isPaused) return false;
    if (state.pauseOnHidden && document.hidden) return false;
    return true;
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
    if (!canRun()) return;
    timerRef.current = window.setTimeout(async () => {
      timerRef.current = null;
      if (!canRun()) return;
      await refresh();
      scheduleNext();
    }, stateRef.current.interval);
  }, [clearTimer, canRun, refresh]);

  const pause = useCallback(() => {
    setIsPaused(true);
    stateRef.current.isPaused = true;
    clearTimer();
  }, [clearTimer]);

  const resume = useCallback(() => {
    setIsPaused(false);
    stateRef.current.isPaused = false;
  }, []);

  // 页面可见性变化处理
  useEffect(() => {
    if (!pauseOnHidden) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearTimer();
      } else if (canRun()) {
        refresh().then(scheduleNext);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pauseOnHidden, canRun, clearTimer, refresh, scheduleNext]);

  const refreshKeyRef = useRef(refreshKey);

  // 启动/停止轮询
  useEffect(() => {
    isMountedRef.current = true;
    const refreshKeyChanged = refreshKeyRef.current !== refreshKey;
    refreshKeyRef.current = refreshKey;

    if (enabled && !isPaused) {
      if (immediate || refreshKeyChanged) {
        refresh().then(scheduleNext);
      } else {
        scheduleNext();
      }
    }

    return () => {
      isMountedRef.current = false;
      clearTimer();
    };
  }, [enabled, isPaused, immediate, interval, refreshKey, refresh, scheduleNext, clearTimer]);

  return {
    isLoading,
    lastRefresh,
    refresh,
    pause,
    resume,
    isPaused,
  };
}
