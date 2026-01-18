/**
 * 尾盘选股法（一日持股法）页面
 * 参考 __refer__ 目录逻辑实现
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  Target,
  ChevronLeft,
  SearchX,
  SlidersHorizontal,
  Check,
  ToggleLeft,
  ToggleRight,
  RotateCcw,
  Zap,
  Plus,
  Save,
  FolderOpen,
  Trash2,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Square,
  X,
} from 'lucide-react';
import { useToast } from '@/components/common';
import { getAllAShareQuotes, getTodayTimeline } from '@/services/sdk';
import { addToWatchlist, isInWatchlist } from '@/services/storage';
import type { FullQuote, TodayTimelineResponse } from 'stock-sdk';
import styles from './EndOfDayPicker.module.css';

// ========== 类型定义 ==========

interface FilterConditions {
  marketCapMin: number;
  marketCapMax: number;
  volumeRatioMin: number;
  changePercentMin: number;
  changePercentMax: number;
  turnoverRateMin: number;
  turnoverRateMax: number;
  excludeST: boolean;
  timelineAboveAvgRatio: number;
}

interface SavedScheme {
  id: string;
  name: string;
  filters: FilterConditions;
  createdAt: number;
}

interface RecentUsage {
  filters: FilterConditions;
  usedAt: number;
}

type SortField = 'changePercent' | 'timelineAboveAvgRatio' | 'turnoverRate' | 'circulatingMarketCap' | 'volumeRatio';
type SortOrder = 'asc' | 'desc';

interface TimelinePoint {
  time: string;
  price: number;
  avgPrice: number;
}

interface StockData {
  code: string;
  name: string;
  price: number;
  changePercent: number;
  change: number;
  volume: number;
  amount: number;
  turnoverRate: number | null;
  volumeRatio: number | null;
  circulatingMarketCap: number | null;
  totalMarketCap: number | null;
  pe: number | null;
  pb: number | null;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  timeline?: TimelinePoint[];
  timelineAboveAvgRatio?: number;
}

interface LoadingProgress {
  completed: number;
  total: number;
  stage: string;
}

// ========== 常量 ==========

const STORAGE_KEY = 'end-of-day-picker-settings';
const SCHEMES_STORAGE_KEY = 'end-of-day-picker-schemes';
const RECENT_USAGE_STORAGE_KEY = 'end-of-day-picker-recent';
const MAX_RECENT_USAGE = 5;

const DEFAULT_FILTERS: FilterConditions = {
  marketCapMin: 50,
  marketCapMax: 200,
  volumeRatioMin: 1.2,
  changePercentMin: 3,
  changePercentMax: 5,
  turnoverRateMin: 5,
  turnoverRateMax: 10,
  excludeST: true,
  timelineAboveAvgRatio: 80,
};

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'changePercent', label: '涨幅' },
  { field: 'timelineAboveAvgRatio', label: '分时强度' },
  { field: 'turnoverRate', label: '换手率' },
  { field: 'circulatingMarketCap', label: '流通市值' },
  { field: 'volumeRatio', label: '量比' },
];

// ========== 工具函数 ==========

const loadFiltersFromStorage = (): FilterConditions => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_FILTERS, ...parsed };
    }
  } catch (error) {
    console.warn('读取筛选条件失败:', error);
  }
  return DEFAULT_FILTERS;
};

const saveFiltersToStorage = (filters: FilterConditions): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch (error) {
    console.warn('保存筛选条件失败:', error);
  }
};

// 方案存储
const loadSchemesFromStorage = (): SavedScheme[] => {
  try {
    const stored = localStorage.getItem(SCHEMES_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('读取方案失败:', error);
  }
  return [];
};

const saveSchemesToStorage = (schemes: SavedScheme[]): void => {
  try {
    localStorage.setItem(SCHEMES_STORAGE_KEY, JSON.stringify(schemes));
  } catch (error) {
    console.warn('保存方案失败:', error);
  }
};

// 最近使用存储
const loadRecentUsageFromStorage = (): RecentUsage[] => {
  try {
    const stored = localStorage.getItem(RECENT_USAGE_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('读取最近使用失败:', error);
  }
  return [];
};

const saveRecentUsageToStorage = (recentUsage: RecentUsage[]): void => {
  try {
    localStorage.setItem(RECENT_USAGE_STORAGE_KEY, JSON.stringify(recentUsage));
  } catch (error) {
    console.warn('保存最近使用失败:', error);
  }
};

const addRecentUsage = (filters: FilterConditions): void => {
  const recent = loadRecentUsageFromStorage();
  const newEntry: RecentUsage = { filters, usedAt: Date.now() };
  // 检查是否已存在相同配置
  const isDuplicate = recent.some(
    (r) => JSON.stringify(r.filters) === JSON.stringify(filters)
  );
  if (!isDuplicate) {
    const updated = [newEntry, ...recent].slice(0, MAX_RECENT_USAGE);
    saveRecentUsageToStorage(updated);
  }
};

const formatNumber = (num: number | null, decimals = 2): string => {
  if (num === null || num === undefined) return '-';
  return num.toFixed(decimals);
};

const formatLargeNumber = (num: number): string => {
  if (num >= 100000000) {
    return (num / 100000000).toFixed(2) + '亿';
  } else if (num >= 10000) {
    return (num / 10000).toFixed(2) + '万';
  }
  return num.toFixed(2);
};

// ========== 子组件 ==========

// 分时图组件
function TimelineChart({ data, prevClose }: { data: TimelinePoint[]; prevClose: number }) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;

    const width = 320;
    const height = 100;
    const padding = { top: 6, right: 6, bottom: 6, left: 6 };

    const prices = data.map((d) => d.price);
    const avgPrices = data.map((d) => d.avgPrice);
    const allValues = [...prices, ...avgPrices, prevClose];

    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const range = maxValue - minValue || 1;

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const getX = (index: number) => padding.left + (index / (data.length - 1)) * chartWidth;
    const getY = (value: number) => padding.top + ((maxValue - value) / range) * chartHeight;

    const pricePath = data
      .map((d, i) => {
        const x = getX(i);
        const y = getY(d.price);
        return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
      })
      .join(' ');

    const avgPath = data
      .map((d, i) => {
        const x = getX(i);
        const y = getY(d.avgPrice);
        return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
      })
      .join(' ');

    const fillPath =
      pricePath +
      ` L ${getX(data.length - 1)} ${height - padding.bottom}` +
      ` L ${padding.left} ${height - padding.bottom} Z`;

    const prevCloseY = getY(prevClose);
    const lastPoint = data[data.length - 1];
    const lastX = getX(data.length - 1);
    const lastY = getY(lastPoint.price);

    return {
      width,
      height,
      pricePath,
      avgPath,
      fillPath,
      prevCloseY,
      lastX,
      lastY,
      isPositive: lastPoint.price >= prevClose,
    };
  }, [data, prevClose]);

  if (!chartData) {
    return <div className={styles.chartEmpty}>暂无分时数据</div>;
  }

  return (
    <div className={styles.timelineChart}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${chartData.width} ${chartData.height}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="priceGradientEOD" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop
              offset="0%"
              stopColor={chartData.isPositive ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}
            />
            <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
          </linearGradient>
        </defs>

        <path d={chartData.fillPath} fill="url(#priceGradientEOD)" />

        <line
          x1={5}
          y1={chartData.prevCloseY}
          x2={chartData.width - 5}
          y2={chartData.prevCloseY}
          stroke="var(--text-tertiary)"
          strokeWidth={1}
          strokeDasharray="4 2"
          opacity={0.5}
        />

        <path
          d={chartData.avgPath}
          fill="none"
          stroke="var(--color-warning)"
          strokeWidth={1.5}
          opacity={0.8}
        />

        <path
          d={chartData.pricePath}
          fill="none"
          stroke={chartData.isPositive ? 'var(--color-rise)' : 'var(--color-fall)'}
          strokeWidth={1.5}
        />

        <circle
          cx={chartData.lastX}
          cy={chartData.lastY}
          r={3}
          fill={chartData.isPositive ? 'var(--color-rise)' : 'var(--color-fall)'}
        />
      </svg>
      <div className={styles.chartLegend}>
        <span className={styles.legendItem}>
          <span
            className={styles.legendLine}
            style={{
              background: chartData.isPositive ? 'var(--color-rise)' : 'var(--color-fall)',
            }}
          />
          价格
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendLine} style={{ background: 'var(--color-warning)' }} />
          均价
        </span>
      </div>
    </div>
  );
}

// 股票卡片组件
function StockCard({
  stock,
  index,
  onAddWatchlist,
  isSelected,
  onToggleSelect,
  showSelect,
}: {
  stock: StockData;
  index: number;
  onAddWatchlist: (code: string, name: string) => void;
  isSelected?: boolean;
  onToggleSelect?: (code: string) => void;
  showSelect?: boolean;
}) {
  const navigate = useNavigate();
  const isPositive = stock.changePercent >= 0;
  const inWatchlist = isInWatchlist(stock.code);

  const handleCardClick = () => {
    const marketPrefix =
      stock.code.startsWith('6') || stock.code.startsWith('9')
        ? 'sh'
        : stock.code.startsWith('4') || stock.code.startsWith('8')
          ? 'bj'
          : 'sz';
    navigate(`/s/${marketPrefix}${stock.code}`);
  };

  const handleSelectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelect?.(stock.code);
  };

  return (
    <motion.div
      className={`${styles.stockCard} ${isPositive ? styles.positive : styles.negative} ${isSelected ? styles.selected : ''}`}
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.4,
        delay: index * 0.05,
        ease: 'easeOut',
      }}
      whileHover={{
        scale: 1.02,
        y: -3,
        transition: { duration: 0.2 },
      }}
      onClick={handleCardClick}
    >
      <div className={styles.stockHeader}>
        <div className={styles.stockInfo}>
          <div className={styles.stockNameRow}>
            {showSelect && (
              <button className={styles.selectBtn} onClick={handleSelectClick}>
                {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
              </button>
            )}
            <h3 className={styles.stockName}>{stock.name}</h3>
          </div>
          <span className={styles.stockCode}>{stock.code}</span>
        </div>
        <motion.div
          className={styles.changeBadge}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: index * 0.05 + 0.2, type: 'spring' }}
        >
          <span className={styles.changeIcon}>{isPositive ? '▲' : '▼'}</span>
          <span className={styles.changePercent}>{formatNumber(stock.changePercent)}%</span>
        </motion.div>
      </div>

      <div className={styles.priceSection}>
        <div className={styles.currentPrice}>
          <span className={styles.priceLabel}>现价</span>
          <span className={styles.priceValue}>{formatNumber(stock.price)}</span>
        </div>
        <div className={styles.priceChange}>
          <span className={styles.changeValue}>
            {isPositive ? '+' : ''}
            {formatNumber(stock.change)}
          </span>
          {stock.timelineAboveAvgRatio !== undefined && (
            <span className={styles.timelineRatio}>
              强度 {stock.timelineAboveAvgRatio.toFixed(0)}%
            </span>
          )}
        </div>
      </div>

      {stock.timeline && stock.timeline.length > 0 && (
        <div className={styles.timelineSection}>
          <TimelineChart data={stock.timeline} prevClose={stock.prevClose} />
        </div>
      )}

      <div className={styles.dataGrid}>
        <div className={styles.dataItem}>
          <span className={styles.dataLabel}>流通市值</span>
          <span className={styles.dataValue}>{formatNumber(stock.circulatingMarketCap)}亿</span>
        </div>
        <div className={styles.dataItem}>
          <span className={styles.dataLabel}>量比</span>
          <span className={styles.dataValue}>{formatNumber(stock.volumeRatio)}</span>
        </div>
        <div className={styles.dataItem}>
          <span className={styles.dataLabel}>换手率</span>
          <span className={styles.dataValue}>{formatNumber(stock.turnoverRate)}%</span>
        </div>
        <div className={styles.dataItem}>
          <span className={styles.dataLabel}>成交额</span>
          <span className={styles.dataValue}>{formatLargeNumber(stock.amount)}</span>
        </div>
      </div>

      <button
        className={`${styles.addWatchlistBtn} ${inWatchlist ? styles.added : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          if (!inWatchlist) {
            onAddWatchlist(stock.code, stock.name);
          }
        }}
        disabled={inWatchlist}
      >
        {inWatchlist ? <Check size={14} /> : <Plus size={14} />}
        {inWatchlist ? '已自选' : '加自选'}
      </button>
    </motion.div>
  );
}

// 加载遮罩组件
function LoadingOverlay({ progress }: { progress: LoadingProgress }) {
  const percentage = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <motion.div
      className={styles.loadingOverlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className={styles.loadingContent}>
        <div className={styles.loadingSpinner}>
          <motion.div
            className={styles.spinnerRing}
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />
          <div className={styles.spinnerCenter}>
            <motion.span
              className={styles.loadingPercentage}
              key={percentage}
              initial={{ scale: 1.2, opacity: 0.5 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {percentage}%
            </motion.span>
          </div>
        </div>

        <div className={styles.loadingProgress}>
          <motion.div
            className={styles.loadingProgressFill}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>

        <div className={styles.loadingStatus}>
          <p className={styles.loadingText}>{progress.stage || '正在扫描全市场股票数据...'}</p>
          <p className={styles.loadingDetail}>
            {progress.total > 0
              ? `已处理 ${progress.completed} / ${progress.total}`
              : '正在初始化连接...'}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ========== 主组件 ==========

export function EndOfDayPicker() {
  const toast = useToast();
  const [filters, setFilters] = useState<FilterConditions>(loadFiltersFromStorage);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress>({
    completed: 0,
    total: 0,
    stage: '',
  });
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const abortRef = useRef(false);

  // 方案管理
  const [savedSchemes, setSavedSchemes] = useState<SavedScheme[]>(loadSchemesFromStorage);
  const [recentUsage, setRecentUsage] = useState<RecentUsage[]>(loadRecentUsageFromStorage);
  const [showSchemePanel, setShowSchemePanel] = useState(false);
  const [showRecentPanel, setShowRecentPanel] = useState(false);
  const [newSchemeName, setNewSchemeName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  // 排序
  const [sortField, setSortField] = useState<SortField>('timelineAboveAvgRatio');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // 批量选择
  const [selectedStocks, setSelectedStocks] = useState<Set<string>>(new Set());
  const [showSelectMode, setShowSelectMode] = useState(false);

  // 保存筛选条件
  useEffect(() => {
    saveFiltersToStorage(filters);
  }, [filters]);

  // 恢复默认设置
  const handleResetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  // 基础条件筛选
  const filterStocksBasic = useCallback(
    (quotes: FullQuote[]): Omit<StockData, 'timeline' | 'timelineAboveAvgRatio'>[] => {
      return quotes
        .filter((quote) => {
          const marketCap = quote.circulatingMarketCap;
          const volumeRatio = quote.volumeRatio;
          const changePercent = quote.changePercent;
          const turnoverRate = quote.turnoverRate;
          const name = quote.name;

          if (filters.excludeST && (name.includes('ST') || name.includes('*ST'))) {
            return false;
          }
          if (
            marketCap === null ||
            marketCap < filters.marketCapMin ||
            marketCap > filters.marketCapMax
          ) {
            return false;
          }
          if (volumeRatio === null || volumeRatio < filters.volumeRatioMin) {
            return false;
          }
          if (
            changePercent < filters.changePercentMin ||
            changePercent > filters.changePercentMax
          ) {
            return false;
          }
          if (
            turnoverRate === null ||
            turnoverRate < filters.turnoverRateMin ||
            turnoverRate > filters.turnoverRateMax
          ) {
            return false;
          }
          return true;
        })
        .map((quote) => ({
          code: quote.code,
          name: quote.name,
          price: quote.price,
          changePercent: quote.changePercent,
          change: quote.change,
          volume: quote.volume,
          amount: quote.amount,
          turnoverRate: quote.turnoverRate,
          volumeRatio: quote.volumeRatio,
          circulatingMarketCap: quote.circulatingMarketCap,
          totalMarketCap: quote.totalMarketCap,
          pe: quote.pe,
          pb: quote.pb,
          high: quote.high,
          low: quote.low,
          open: quote.open,
          prevClose: quote.prevClose,
        }))
        .sort((a, b) => b.changePercent - a.changePercent);
    },
    [filters]
  );

  // 计算分时强度
  const calculateTimelineRatio = (
    timeline: TodayTimelineResponse
  ): { ratio: number; points: TimelinePoint[] } => {
    if (!timeline.data || timeline.data.length === 0) {
      return { ratio: 0, points: [] };
    }

    const points: TimelinePoint[] = timeline.data.map((item) => ({
      time: item.time,
      price: item.price,
      avgPrice: item.avgPrice,
    }));

    const aboveAvgCount = points.filter((p) => p.price >= p.avgPrice).length;
    const ratio = (aboveAvgCount / points.length) * 100;

    return { ratio, points };
  };

  // 获取分时数据并筛选
  const filterWithTimeline = useCallback(
    async (
      basicStocks: Omit<StockData, 'timeline' | 'timelineAboveAvgRatio'>[],
      minRatio: number,
      onProgress: (completed: number, total: number) => void
    ): Promise<StockData[]> => {
      const results: StockData[] = [];
      const total = basicStocks.length;

      const batchSize = 5;
      for (let i = 0; i < basicStocks.length; i += batchSize) {
        if (abortRef.current) break;

        const batch = basicStocks.slice(i, i + batchSize);
        const promises = batch.map(async (stock) => {
          try {
            const marketPrefix =
              stock.code.startsWith('6') || stock.code.startsWith('9')
                ? 'sh'
                : stock.code.startsWith('4') || stock.code.startsWith('8')
                  ? 'bj'
                  : 'sz';
            const fullCode = `${marketPrefix}${stock.code}`;

            const timeline = await getTodayTimeline(fullCode);
            const { ratio, points } = calculateTimelineRatio(timeline);

            if (ratio >= minRatio) {
              return {
                ...stock,
                timeline: points,
                timelineAboveAvgRatio: ratio,
              } as StockData;
            }
            return null;
          } catch (error) {
            console.warn(`获取 ${stock.code} 分时数据失败:`, error);
            return null;
          }
        });

        const batchResults = await Promise.all(promises);
        batchResults.forEach((result) => {
          if (result) results.push(result);
        });

        onProgress(Math.min(i + batchSize, total), total);
      }

      return results.sort((a, b) => (b.timelineAboveAvgRatio || 0) - (a.timelineAboveAvgRatio || 0));
    },
    []
  );

  // 开始分析
  const handleStartAnalysis = useCallback(async () => {
    setIsLoading(true);
    setLoadingProgress({ completed: 0, total: 0, stage: '获取行情数据' });
    setStocks([]);
    abortRef.current = false;

    // 记录最近使用
    addRecentUsage(filters);
    setRecentUsage(loadRecentUsageFromStorage());

    try {
      // 第一阶段：获取全市场行情
      const quotes = await getAllAShareQuotes({
        batchSize: 500,
        concurrency: 5,
        onProgress: (completed, total) => {
          setLoadingProgress({ completed, total, stage: '获取行情数据' });
        },
      });

      if (abortRef.current) return;

      // 第二阶段：基础条件筛选
      setLoadingProgress({ completed: 0, total: 100, stage: '基础条件筛选' });
      const basicFilteredStocks = filterStocksBasic(quotes);

      if (basicFilteredStocks.length === 0) {
        toast.info('没有符合基础条件的股票，请尝试调整筛选条件');
        setIsLoading(false);
        setHasAnalyzed(true);
        return;
      }

      if (abortRef.current) return;

      // 第三阶段：分时结构筛选
      setLoadingProgress({
        completed: 0,
        total: basicFilteredStocks.length,
        stage: '分时结构筛选',
      });
      const finalStocks = await filterWithTimeline(
        basicFilteredStocks,
        filters.timelineAboveAvgRatio,
        (completed, total) => {
          setLoadingProgress({ completed, total, stage: '分时结构筛选' });
        }
      );

      if (!abortRef.current) {
        setStocks(finalStocks);
        setHasAnalyzed(true);
      }
    } catch (error) {
      console.error('获取股票数据失败:', error);
      toast.error('获取股票数据失败，请重试');
    } finally {
      setIsLoading(false);
    }
  }, [filters, filterStocksBasic, filterWithTimeline, toast]);

  // 加入自选
  const handleAddWatchlist = useCallback(
    (code: string, name: string) => {
      const marketPrefix =
        code.startsWith('6') || code.startsWith('9')
          ? 'sh'
          : code.startsWith('4') || code.startsWith('8')
            ? 'bj'
            : 'sz';
      addToWatchlist(`${marketPrefix}${code}`);
      toast.success(`已将 ${name} 加入自选`);
      // 强制刷新以更新按钮状态
      setStocks((prev) => [...prev]);
    },
    [toast]
  );

  // 更新筛选条件
  const handleFilterChange = (key: keyof FilterConditions, value: number | boolean) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // 保存方案
  const handleSaveScheme = useCallback(() => {
    if (!newSchemeName.trim()) {
      toast.warning('请输入方案名称');
      return;
    }
    const newScheme: SavedScheme = {
      id: Date.now().toString(),
      name: newSchemeName.trim(),
      filters: { ...filters },
      createdAt: Date.now(),
    };
    const updated = [...savedSchemes, newScheme];
    setSavedSchemes(updated);
    saveSchemesToStorage(updated);
    setNewSchemeName('');
    setShowSaveInput(false);
    toast.success(`方案「${newScheme.name}」已保存`);
  }, [newSchemeName, filters, savedSchemes, toast]);

  // 加载方案
  const handleLoadScheme = useCallback((scheme: SavedScheme) => {
    setFilters(scheme.filters);
    setShowSchemePanel(false);
    toast.success(`已加载方案「${scheme.name}」`);
  }, [toast]);

  // 删除方案
  const handleDeleteScheme = useCallback((schemeId: string) => {
    const updated = savedSchemes.filter((s) => s.id !== schemeId);
    setSavedSchemes(updated);
    saveSchemesToStorage(updated);
    toast.success('方案已删除');
  }, [savedSchemes, toast]);

  // 加载最近使用
  const handleLoadRecent = useCallback((recent: RecentUsage) => {
    setFilters(recent.filters);
    setShowRecentPanel(false);
    toast.success('已加载历史配置');
  }, [toast]);

  // 排序股票
  const sortedStocks = useMemo(() => {
    return [...stocks].sort((a, b) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      return sortOrder === 'desc' ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
    });
  }, [stocks, sortField, sortOrder]);

  // 切换排序
  const handleSortChange = useCallback((field: SortField) => {
    if (field === sortField) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  }, [sortField]);

  // 切换选择
  const handleToggleSelect = useCallback((code: string) => {
    setSelectedStocks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(code)) {
        newSet.delete(code);
      } else {
        newSet.add(code);
      }
      return newSet;
    });
  }, []);

  // 全选/取消全选
  const handleSelectAll = useCallback(() => {
    if (selectedStocks.size === sortedStocks.length) {
      setSelectedStocks(new Set());
    } else {
      setSelectedStocks(new Set(sortedStocks.map((s) => s.code)));
    }
  }, [selectedStocks.size, sortedStocks]);

  // 批量加入自选
  const handleBatchAddWatchlist = useCallback(() => {
    let addedCount = 0;
    selectedStocks.forEach((code) => {
      const stock = stocks.find((s) => s.code === code);
      if (stock && !isInWatchlist(code)) {
        const marketPrefix =
          code.startsWith('6') || code.startsWith('9')
            ? 'sh'
            : code.startsWith('4') || code.startsWith('8')
              ? 'bj'
              : 'sz';
        addToWatchlist(`${marketPrefix}${code}`);
        addedCount++;
      }
    });
    if (addedCount > 0) {
      toast.success(`已将 ${addedCount} 只股票加入自选`);
      setStocks((prev) => [...prev]); // 刷新状态
    } else {
      toast.info('所选股票已在自选中');
    }
    setSelectedStocks(new Set());
    setShowSelectMode(false);
  }, [selectedStocks, stocks, toast]);

  return (
    <div className={styles.container}>
      {/* 页面头部 */}
      <motion.header
        className={styles.header}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className={styles.titleSection}>
          <h1 className={styles.title}>
            <TrendingUp size={24} />
            尾盘选股法
          </h1>
          <p className={styles.subtitle}>
            一日持股法分析工具 · 筛选分时强势股票
          </p>
        </div>
      </motion.header>

      <main className={styles.main}>
        <AnimatePresence mode="wait">
          {!hasAnalyzed ? (
            <motion.div
              key="start-screen"
              className={styles.startScreen}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
            >
              {/* 开始按钮 */}
              <motion.div
                className={styles.startButtonContainer}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                <motion.button
                  className={styles.startButton}
                  onClick={handleStartAnalysis}
                  disabled={isLoading}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <span className={styles.buttonGlow} />
                  <span className={styles.buttonContent}>
                    <Zap size={28} />
                    <span>开始分析</span>
                  </span>
                </motion.button>
              </motion.div>

              {/* 筛选条件卡片 */}
              <motion.div
                className={`${styles.filterCard} ${isEditing ? styles.editing : ''}`}
                onClick={() => !isEditing && setIsEditing(true)}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                whileHover={!isEditing ? { scale: 1.01 } : undefined}
              >
                <div className={styles.filterHeader}>
                  <div className={styles.filterTitle}>
                    <SlidersHorizontal size={20} />
                    <span>筛选条件</span>
                  </div>
                  <div className={styles.filterActions}>
                    <AnimatePresence mode="wait">
                      {isEditing ? (
                        <motion.div
                          key="editing"
                          className={styles.editActions}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                        >
                          <button
                            className={styles.resetBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResetFilters();
                            }}
                            title="恢复默认"
                          >
                            <RotateCcw size={14} />
                            默认
                          </button>
                          <button
                            className={styles.schemeBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowSchemePanel(!showSchemePanel);
                              setShowRecentPanel(false);
                            }}
                            title="管理方案"
                          >
                            <FolderOpen size={14} />
                            方案
                          </button>
                          <button
                            className={styles.recentBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowRecentPanel(!showRecentPanel);
                              setShowSchemePanel(false);
                            }}
                            title="最近使用"
                          >
                            <Clock size={14} />
                            历史
                          </button>
                          <button
                            className={styles.saveBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsEditing(false);
                              setShowSchemePanel(false);
                              setShowRecentPanel(false);
                            }}
                          >
                            <Check size={14} />
                            完成
                          </button>
                        </motion.div>
                      ) : (
                        <motion.span
                          key="hint"
                          className={styles.editHint}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          点击编辑
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* 方案管理面板 */}
                <AnimatePresence>
                  {showSchemePanel && (
                    <motion.div
                      className={styles.schemePanel}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className={styles.schemePanelHeader}>
                        <span>保存的方案</span>
                        <button
                          className={styles.addSchemeBtn}
                          onClick={() => setShowSaveInput(!showSaveInput)}
                        >
                          <Plus size={14} />
                          保存当前
                        </button>
                      </div>
                      {showSaveInput && (
                        <div className={styles.saveInputRow}>
                          <input
                            type="text"
                            placeholder="输入方案名称"
                            value={newSchemeName}
                            onChange={(e) => setNewSchemeName(e.target.value)}
                            className={styles.schemeNameInput}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveScheme()}
                          />
                          <button className={styles.confirmSaveBtn} onClick={handleSaveScheme}>
                            <Save size={14} />
                          </button>
                        </div>
                      )}
                      {savedSchemes.length > 0 ? (
                        <div className={styles.schemeList}>
                          {savedSchemes.map((scheme) => (
                            <div key={scheme.id} className={styles.schemeItem}>
                              <button
                                className={styles.schemeLoadBtn}
                                onClick={() => handleLoadScheme(scheme)}
                              >
                                {scheme.name}
                              </button>
                              <button
                                className={styles.schemeDeleteBtn}
                                onClick={() => handleDeleteScheme(scheme.id)}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className={styles.emptyHint}>暂无保存的方案</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 最近使用面板 */}
                <AnimatePresence>
                  {showRecentPanel && (
                    <motion.div
                      className={styles.recentPanel}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className={styles.schemePanelHeader}>
                        <span>最近使用</span>
                      </div>
                      {recentUsage.length > 0 ? (
                        <div className={styles.schemeList}>
                          {recentUsage.map((recent, idx) => (
                            <button
                              key={idx}
                              className={styles.recentItem}
                              onClick={() => handleLoadRecent(recent)}
                            >
                              <span className={styles.recentSummary}>
                                市值 {recent.filters.marketCapMin}-{recent.filters.marketCapMax}亿 · 
                                涨幅 {recent.filters.changePercentMin}-{recent.filters.changePercentMax}%
                              </span>
                              <span className={styles.recentTime}>
                                {new Date(recent.usedAt).toLocaleString('zh-CN', {
                                  month: 'numeric',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className={styles.emptyHint}>暂无使用记录</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className={styles.filterGrid}>
                  {/* 流通市值 */}
                  <div className={styles.filterItem}>
                    <span className={styles.filterLabel}>流通市值</span>
                    <div className={styles.filterValue}>
                      {isEditing ? (
                        <>
                          <input
                            type="number"
                            value={filters.marketCapMin}
                            onChange={(e) =>
                              handleFilterChange('marketCapMin', parseFloat(e.target.value) || 0)
                            }
                            className={styles.filterInput}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className={styles.filterSeparator}>~</span>
                          <input
                            type="number"
                            value={filters.marketCapMax}
                            onChange={(e) =>
                              handleFilterChange('marketCapMax', parseFloat(e.target.value) || 0)
                            }
                            className={styles.filterInput}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className={styles.filterUnit}>亿</span>
                        </>
                      ) : (
                        <span className={styles.filterDisplay}>
                          {filters.marketCapMin} ~ {filters.marketCapMax}
                          <span className={styles.filterUnit}>亿</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 量比 */}
                  <div className={styles.filterItem}>
                    <span className={styles.filterLabel}>量比</span>
                    <div className={styles.filterValue}>
                      {isEditing ? (
                        <>
                          <input
                            type="number"
                            value={filters.volumeRatioMin}
                            onChange={(e) =>
                              handleFilterChange('volumeRatioMin', parseFloat(e.target.value) || 0)
                            }
                            className={styles.filterInput}
                            onClick={(e) => e.stopPropagation()}
                            step="0.1"
                          />
                        </>
                      ) : (
                        <span className={styles.filterDisplay}>≥ {filters.volumeRatioMin}</span>
                      )}
                    </div>
                  </div>

                  {/* 当日涨幅 */}
                  <div className={styles.filterItem}>
                    <span className={styles.filterLabel}>当日涨幅</span>
                    <div className={styles.filterValue}>
                      {isEditing ? (
                        <>
                          <input
                            type="number"
                            value={filters.changePercentMin}
                            onChange={(e) =>
                              handleFilterChange('changePercentMin', parseFloat(e.target.value) || 0)
                            }
                            className={styles.filterInput}
                            onClick={(e) => e.stopPropagation()}
                            step="0.5"
                          />
                          <span className={styles.filterSeparator}>~</span>
                          <input
                            type="number"
                            value={filters.changePercentMax}
                            onChange={(e) =>
                              handleFilterChange('changePercentMax', parseFloat(e.target.value) || 0)
                            }
                            className={styles.filterInput}
                            onClick={(e) => e.stopPropagation()}
                            step="0.5"
                          />
                          <span className={styles.filterUnit}>%</span>
                        </>
                      ) : (
                        <span className={styles.filterDisplay}>
                          {filters.changePercentMin} ~ {filters.changePercentMax}
                          <span className={styles.filterUnit}>%</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 换手率 */}
                  <div className={styles.filterItem}>
                    <span className={styles.filterLabel}>换手率</span>
                    <div className={styles.filterValue}>
                      {isEditing ? (
                        <>
                          <input
                            type="number"
                            value={filters.turnoverRateMin}
                            onChange={(e) =>
                              handleFilterChange('turnoverRateMin', parseFloat(e.target.value) || 0)
                            }
                            className={styles.filterInput}
                            onClick={(e) => e.stopPropagation()}
                            step="0.5"
                          />
                          <span className={styles.filterSeparator}>~</span>
                          <input
                            type="number"
                            value={filters.turnoverRateMax}
                            onChange={(e) =>
                              handleFilterChange('turnoverRateMax', parseFloat(e.target.value) || 0)
                            }
                            className={styles.filterInput}
                            onClick={(e) => e.stopPropagation()}
                            step="0.5"
                          />
                          <span className={styles.filterUnit}>%</span>
                        </>
                      ) : (
                        <span className={styles.filterDisplay}>
                          {filters.turnoverRateMin} ~ {filters.turnoverRateMax}
                          <span className={styles.filterUnit}>%</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 过滤ST */}
                  <div className={styles.filterItem}>
                    <span className={styles.filterLabel}>过滤ST股票</span>
                    <div className={styles.filterValue}>
                      {isEditing ? (
                        <button
                          className={`${styles.toggleBtn} ${filters.excludeST ? styles.active : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFilterChange('excludeST', !filters.excludeST);
                          }}
                        >
                          {filters.excludeST ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                          <span>{filters.excludeST ? '开启' : '关闭'}</span>
                        </button>
                      ) : (
                        <span className={styles.filterDisplay}>
                          {filters.excludeST ? '开启' : '关闭'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 分时强度 */}
                  <div className={styles.filterItem}>
                    <span className={styles.filterLabel}>分时强度</span>
                    <div className={styles.filterValue}>
                      {isEditing ? (
                        <>
                          <input
                            type="number"
                            value={filters.timelineAboveAvgRatio}
                            onChange={(e) =>
                              handleFilterChange(
                                'timelineAboveAvgRatio',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className={styles.filterInput}
                            onClick={(e) => e.stopPropagation()}
                            step="5"
                            min="0"
                            max="100"
                          />
                          <span className={styles.filterUnit}>%</span>
                        </>
                      ) : (
                        <span className={styles.filterDisplay}>
                          ≥ {filters.timelineAboveAvgRatio}
                          <span className={styles.filterUnit}>%</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="results-screen"
              className={styles.resultsScreen}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* 结果头部 */}
              <div className={styles.resultsHeader}>
                <motion.div
                  className={styles.resultsSummary}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Target size={20} />
                  <span className={styles.summaryText}>
                    共筛选出 <strong>{stocks.length}</strong> 只符合条件的股票
                  </span>
                </motion.div>
                <motion.div
                  className={styles.resultsActions}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  {/* 批量选择按钮 */}
                  {stocks.length > 0 && (
                    <button
                      className={`${styles.selectModeBtn} ${showSelectMode ? styles.active : ''}`}
                      onClick={() => {
                        setShowSelectMode(!showSelectMode);
                        if (showSelectMode) {
                          setSelectedStocks(new Set());
                        }
                      }}
                    >
                      {showSelectMode ? <X size={16} /> : <CheckSquare size={16} />}
                      {showSelectMode ? '取消' : '批量选'}
                    </button>
                  )}
                  <button
                    className={styles.backButton}
                    onClick={() => {
                      setHasAnalyzed(false);
                      setStocks([]);
                      setShowSelectMode(false);
                      setSelectedStocks(new Set());
                    }}
                  >
                    <ChevronLeft size={18} />
                    重新筛选
                  </button>
                </motion.div>
              </div>

              {/* 排序和批量操作栏 */}
              {stocks.length > 0 && (
                <motion.div
                  className={styles.sortBar}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <div className={styles.sortSection}>
                    <ArrowUpDown size={14} />
                    <span className={styles.sortLabel}>排序：</span>
                    {SORT_OPTIONS.map((option) => (
                      <button
                        key={option.field}
                        className={`${styles.sortOption} ${sortField === option.field ? styles.active : ''}`}
                        onClick={() => handleSortChange(option.field)}
                      >
                        {option.label}
                        {sortField === option.field && (
                          sortOrder === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />
                        )}
                      </button>
                    ))}
                  </div>
                  {showSelectMode && (
                    <div className={styles.batchSection}>
                      <button className={styles.selectAllBtn} onClick={handleSelectAll}>
                        {selectedStocks.size === sortedStocks.length ? '取消全选' : '全选'}
                      </button>
                      <button
                        className={styles.batchAddBtn}
                        onClick={handleBatchAddWatchlist}
                        disabled={selectedStocks.size === 0}
                      >
                        <Plus size={14} />
                        加入自选 ({selectedStocks.size})
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

              {/* 结果列表 */}
              {sortedStocks.length > 0 ? (
                <motion.div
                  className={styles.stockGrid}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  {sortedStocks.map((stock, index) => (
                    <StockCard
                      key={stock.code}
                      stock={stock}
                      index={index}
                      onAddWatchlist={handleAddWatchlist}
                      isSelected={selectedStocks.has(stock.code)}
                      onToggleSelect={handleToggleSelect}
                      showSelect={showSelectMode}
                    />
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  className={styles.noResults}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <SearchX size={64} strokeWidth={1} />
                  <p className={styles.noResultsTitle}>没有找到符合条件的股票</p>
                  <p className={styles.noResultsHint}>请尝试调整筛选条件后重新分析</p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* 加载遮罩 */}
      <AnimatePresence>
        {isLoading && <LoadingOverlay progress={loadingProgress} />}
      </AnimatePresence>
    </div>
  );
}
