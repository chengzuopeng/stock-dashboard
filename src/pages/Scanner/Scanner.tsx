/**
 * 扫描页面
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Play, Plus, ScanLine, SquareX } from 'lucide-react';
import { Button, Card, Empty, Tabs, useToast } from '@/components/common';
import { useBoardData } from '@/contexts';
import {
  type AnalysisProgress,
  isAnalysisAborted,
  type ScannerSignalKey,
  type ScannerStockPoolItem,
  scanSignalPool,
} from '@/services/analysis';
import { selectAllCodes, watchlistActions, watchlistStore } from '@/services/watchlistStore';
import { useIsInWatchlist } from '@/hooks';
import {
  getAllAShareQuotes,
  getAllQuotesByCodes,
  getConceptConstituents,
  getIndustryConstituents,
  getStockChanges,
  getZTPool,
} from '@/services/sdk';
import { normalizeStockCode, parseStockCode } from '@/utils/format';
import styles from './Scanner.module.css';

const SIGNAL_TEMPLATES: Array<{ key: ScannerSignalKey; label: string; desc: string }> = [
  { key: 'ma_golden', label: 'MA金叉', desc: '短期均线上穿长期均线' },
  { key: 'ma_death', label: 'MA死叉', desc: '短期均线下穿长期均线' },
  { key: 'macd_golden', label: 'MACD金叉', desc: 'DIF 上穿 DEA' },
  { key: 'macd_death', label: 'MACD死叉', desc: 'DIF 下穿 DEA' },
  { key: 'rsi_oversold', label: 'RSI超卖', desc: 'RSI 低于 30' },
  { key: 'rsi_overbought', label: 'RSI超买', desc: 'RSI 高于 70' },
  { key: 'boll_upper', label: 'BOLL上轨', desc: '收盘价突破上轨' },
  { key: 'boll_lower', label: 'BOLL下轨', desc: '收盘价跌破下轨' },
];

const POOL_SOURCES = [
  { key: 'watchlist', label: '自选股' },
  { key: 'board', label: '手选板块' },
  { key: 'ranking', label: '榜单 TopN' },
  { key: 'zt_pool', label: '涨停/强势池' },
  { key: 'stock_changes', label: '盘口异动池' },
] as const;

const BOARD_TYPES = [
  { key: 'industry', label: '行业' },
  { key: 'concept', label: '概念' },
] as const;

const RANKING_FIELDS = [
  { key: 'amount', label: '成交额' },
  { key: 'changePercent', label: '涨幅' },
  { key: 'turnoverRate', label: '换手率' },
] as const;

const TOP_N_OPTIONS = [20, 50, 100];
const BOARD_LIMIT_OPTIONS = [30, 50, 80];
const ZT_POOL_TYPES = [
  { key: 'zt', label: '涨停池' },
  { key: 'strong', label: '强势股' },
  { key: 'yesterday', label: '昨日涨停' },
  { key: 'sub_new', label: '次新股' },
  { key: 'broken', label: '炸板池' },
  { key: 'dt', label: '跌停池' },
] as const;
const STOCK_CHANGE_TYPES = [
  { key: 'rocket_launch', label: '火箭发射' },
  { key: 'large_buy', label: '大笔买入' },
  { key: 'big_buy_order', label: '大单扫货' },
  { key: 'limit_up_seal', label: '封涨停板' },
  { key: 'gap_up', label: '向上缺口' },
  { key: 'high_60d', label: '60日新高' },
] as const;

type PoolSource = (typeof POOL_SOURCES)[number]['key'];
type BoardType = (typeof BOARD_TYPES)[number]['key'];
type RankingField = (typeof RANKING_FIELDS)[number]['key'];
type ZTPoolType = (typeof ZT_POOL_TYPES)[number]['key'];
type StockChangeType = (typeof STOCK_CHANGE_TYPES)[number]['key'];

interface ScanResultRow {
  code: string;
  routeCode: string;
  name: string;
  signal: string;
  time: string;
}

function formatProgress(progress: AnalysisProgress) {
  if (progress.total <= 0) {
    return progress.stage || '准备中';
  }

  return `${progress.stage} (${progress.completed}/${progress.total})`;
}

export function Scanner() {
  const navigate = useNavigate();
  const toast = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  // 离开页面即中止扫描：扫描池可达上百个请求，不中止会在后台跑完
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);
  const { industryList, conceptList } = useBoardData();

  const [selectedSignals, setSelectedSignals] = useState<ScannerSignalKey[]>(['ma_golden']);
  const [poolSource, setPoolSource] = useState<PoolSource>('watchlist');
  const [boardType, setBoardType] = useState<BoardType>('industry');
  const [selectedBoardCode, setSelectedBoardCode] = useState('');
  const [boardLimit, setBoardLimit] = useState(50);
  const [rankingField, setRankingField] = useState<RankingField>('amount');
  const [poolTopN, setPoolTopN] = useState(20);
  const [ztPoolType, setZtPoolType] = useState<ZTPoolType>('strong');
  const [stockChangeType, setStockChangeType] =
    useState<StockChangeType>('rocket_launch');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<AnalysisProgress>({
    completed: 0,
    total: 0,
    stage: '待开始',
  });
  const [results, setResults] = useState<ScanResultRow[]>([]);

  const currentBoards = boardType === 'industry' ? industryList : conceptList;

  const boardOptions = useMemo(
    () => currentBoards.map((item) => ({ code: item.code, name: item.name })),
    [currentBoards]
  );

  const selectedBoardName = useMemo(
    () => boardOptions.find((item) => item.code === selectedBoardCode)?.name ?? '',
    [boardOptions, selectedBoardCode]
  );

  const toggleSignal = useCallback((key: ScannerSignalKey) => {
    setSelectedSignals((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  }, []);

  const handlePoolSourceChange = useCallback((key: string) => {
    setPoolSource(key as PoolSource);
  }, []);

  const handleBoardTypeChange = useCallback((key: string) => {
    setBoardType(key as BoardType);
    setSelectedBoardCode('');
  }, []);

  const resolveRankingPool = useCallback(async (): Promise<ScannerStockPoolItem[]> => {
    const quotes = await getAllAShareQuotes({ batchSize: 500, concurrency: 4 });

    return [...quotes]
      .sort((a, b) => {
        const left = a[rankingField] ?? 0;
        const right = b[rankingField] ?? 0;
        return (right as number) - (left as number);
      })
      .slice(0, poolTopN)
      .map((quote) => ({
        code: parseStockCode(normalizeStockCode(quote.code)).symbol || quote.code,
        routeCode: normalizeStockCode(quote.code),
        name: quote.name,
      }));
  }, [poolTopN, rankingField]);

  const resolveBoardPool = useCallback(async (): Promise<ScannerStockPoolItem[]> => {
    if (!selectedBoardCode) {
      toast.info('请先选择一个板块');
      return [];
    }

    const constituents =
      boardType === 'industry'
        ? await getIndustryConstituents(selectedBoardCode)
        : await getConceptConstituents(selectedBoardCode);

    return constituents.slice(0, boardLimit).map((item) => {
      const routeCode = normalizeStockCode(item.code);
      return {
        code: parseStockCode(routeCode).symbol || item.code,
        routeCode,
        name: item.name,
      };
    });
  }, [boardLimit, boardType, selectedBoardCode, toast]);

  const resolveWatchlistPool = useCallback(async (): Promise<ScannerStockPoolItem[]> => {
    const routeCodes = selectAllCodes(watchlistStore.getSnapshot())
      .map((code) => normalizeStockCode(code))
      .filter(Boolean);

    if (routeCodes.length === 0) return [];

    // 自选池只有代码没有名称，批量拉一次行情回填，否则结果表名称列显示代码
    const nameByCode = new Map<string, string>();
    try {
      const quotes = await getAllQuotesByCodes(routeCodes);
      quotes.forEach((quote) => {
        if (quote?.code && quote.name) {
          nameByCode.set(normalizeStockCode(quote.code), quote.name);
        }
      });
    } catch (error) {
      console.error('Fetch watchlist names error:', error);
    }

    return routeCodes.map((routeCode) => ({
      code: parseStockCode(routeCode).symbol || routeCode,
      routeCode,
      name: nameByCode.get(routeCode) || parseStockCode(routeCode).symbol || routeCode,
    }));
  }, []);

  const resolveZTPoolSource = useCallback(async (): Promise<ScannerStockPoolItem[]> => {
    const items = await getZTPool(ztPoolType);
    return items.slice(0, poolTopN).map((item) => {
      const routeCode = normalizeStockCode(item.code);
      return {
        code: parseStockCode(routeCode).symbol || item.code,
        routeCode,
        name: item.name,
      };
    });
  }, [poolTopN, ztPoolType]);

  const resolveStockChangePool = useCallback(async (): Promise<ScannerStockPoolItem[]> => {
    const items = await getStockChanges(stockChangeType);
    const deduped = new Map<string, ScannerStockPoolItem>();

    for (const item of items) {
      const routeCode = normalizeStockCode(item.code);
      if (!routeCode || deduped.has(routeCode)) {
        continue;
      }

      deduped.set(routeCode, {
        code: parseStockCode(routeCode).symbol || item.code,
        routeCode,
        name: item.name,
      });
    }

    return Array.from(deduped.values()).slice(0, poolTopN);
  }, [poolTopN, stockChangeType]);

  const resolveStockPool = useCallback(async () => {
    if (poolSource === 'watchlist') {
      return resolveWatchlistPool();
    }

    if (poolSource === 'board') {
      return resolveBoardPool();
    }

    if (poolSource === 'zt_pool') {
      return resolveZTPoolSource();
    }

    if (poolSource === 'stock_changes') {
      return resolveStockChangePool();
    }

    return resolveRankingPool();
  }, [
    poolSource,
    resolveBoardPool,
    resolveRankingPool,
    resolveStockChangePool,
    resolveWatchlistPool,
    resolveZTPoolSource,
  ]);

  const handleScan = useCallback(async () => {
    if (selectedSignals.length === 0) {
      toast.info('请至少选择一个信号模板');
      return;
    }

    setIsScanning(true);
    setResults([]);
    setScanProgress({ completed: 0, total: 0, stage: '准备股票池' });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const pool = await resolveStockPool();

      if (pool.length === 0) {
        toast.info('股票池为空，请切换来源或补充选股范围');
        setIsScanning(false);
        return;
      }

      const now = new Date().toLocaleString('zh-CN', { hour12: false });
      const buffered: ScanResultRow[] = [];

      const scanned = await scanSignalPool(pool, selectedSignals, {
        signal: controller.signal,
        concurrency: 4,
        onProgress: setScanProgress,
        onResult: (result) => {
          buffered.push({
            code: result.code,
            routeCode: result.routeCode,
            name: result.name,
            signal: result.matchedSignals.join(' / '),
            time: now,
          });
          setResults([...buffered]);
        },
      });

      setResults(
        scanned.map((item) => ({
          code: item.code,
          routeCode: item.routeCode,
          name: item.name,
          signal: item.matchedSignals.join(' / '),
          time: now,
        }))
      );
    } catch (error) {
      if (isAnalysisAborted(error)) {
        toast.info('已取消扫描');
      } else {
        console.error('Scan error:', error);
        toast.error('扫描失败，请稍后重试');
      }
    } finally {
      abortControllerRef.current = null;
      setIsScanning(false);
    }
  }, [resolveStockPool, selectedSignals, toast]);

  const handleCancelScan = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleStockClick = useCallback(
    (routeCode: string) => {
      navigate(`/s/${routeCode}`);
    },
    [navigate]
  );

  const isInWatchlist = useIsInWatchlist();

  const handleAddWatchlist = useCallback(
    (routeCode: string, name: string) => {
      watchlistActions.add(routeCode);
      toast.success(`已将 ${name} 加入自选`);
    },
    [toast]
  );

  return (
    <div className={styles.scanner}>
      <motion.div
        className={styles.header}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className={styles.title}>
          <ScanLine size={24} />
          信号扫描
        </h1>
        <p className={styles.subtitle}>统一并发控制、支持取消的技术信号扫描器，现已支持 1.9.0 动态股池</p>
      </motion.div>

      <div className={styles.content}>
        <div className={styles.configSection}>
          <Card title="股票池来源">
            <div className={styles.configStack}>
              <Tabs
                items={POOL_SOURCES.map((item) => ({ key: item.key, label: item.label }))}
                activeKey={poolSource}
                onChange={handlePoolSourceChange}
              />

              {poolSource === 'board' && (
                <div className={styles.fieldBlock}>
                  <Tabs
                    items={BOARD_TYPES.map((item) => ({ key: item.key, label: item.label }))}
                    activeKey={boardType}
                    onChange={handleBoardTypeChange}
                    size="sm"
                  />
                  <div className={styles.fieldRow}>
                    <select
                      className={styles.select}
                      value={selectedBoardCode}
                      onChange={(event) => setSelectedBoardCode(event.target.value)}
                    >
                      <option value="">选择板块</option>
                      {boardOptions.map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className={styles.selectSmall}
                      value={boardLimit}
                      onChange={(event) => setBoardLimit(Number(event.target.value))}
                    >
                      {BOARD_LIMIT_OPTIONS.map((value) => (
                        <option key={value} value={value}>
                          前 {value} 只
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedBoardName && (
                    <p className={styles.helperText}>当前板块：{selectedBoardName}</p>
                  )}
                </div>
              )}

              {poolSource === 'ranking' && (
                <div className={styles.fieldBlock}>
                  <Tabs
                    items={RANKING_FIELDS.map((item) => ({ key: item.key, label: item.label }))}
                    activeKey={rankingField}
                    onChange={(key) => setRankingField(key as RankingField)}
                    size="sm"
                  />
                  <div className={styles.topNGroup}>
                    {TOP_N_OPTIONS.map((value) => (
                      <button
                        key={value}
                        className={`${styles.topNButton} ${poolTopN === value ? styles.active : ''}`}
                        onClick={() => setPoolTopN(value)}
                      >
                        Top {value}
                      </button>
                    ))}
                  </div>
                  <p className={styles.helperText}>榜单来源为全市场 A 股实时行情</p>
                </div>
              )}

              {poolSource === 'zt_pool' && (
                <div className={styles.fieldBlock}>
                  <Tabs
                    items={ZT_POOL_TYPES.map((item) => ({ key: item.key, label: item.label }))}
                    activeKey={ztPoolType}
                    onChange={(key) => setZtPoolType(key as ZTPoolType)}
                    size="sm"
                  />
                  <div className={styles.topNGroup}>
                    {TOP_N_OPTIONS.map((value) => (
                      <button
                        key={value}
                        className={`${styles.topNButton} ${poolTopN === value ? styles.active : ''}`}
                        onClick={() => setPoolTopN(value)}
                      >
                        Top {value}
                      </button>
                    ))}
                  </div>
                  <p className={styles.helperText}>来源于 stock-sdk v2 涨停池/强势股动态股票池</p>
                </div>
              )}

              {poolSource === 'stock_changes' && (
                <div className={styles.fieldBlock}>
                  <div className={styles.fieldRow}>
                    <select
                      className={styles.select}
                      value={stockChangeType}
                      onChange={(event) =>
                        setStockChangeType(event.target.value as StockChangeType)
                      }
                    >
                      {STOCK_CHANGE_TYPES.map((item) => (
                        <option key={item.key} value={item.key}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.topNGroup}>
                    {TOP_N_OPTIONS.map((value) => (
                      <button
                        key={value}
                        className={`${styles.topNButton} ${poolTopN === value ? styles.active : ''}`}
                        onClick={() => setPoolTopN(value)}
                      >
                        Top {value}
                      </button>
                    ))}
                  </div>
                  <p className={styles.helperText}>来源于 stock-sdk v2 盘口异动流，已按股票去重</p>
                </div>
              )}

              {poolSource === 'watchlist' && (
                <p className={styles.helperText}>使用当前全部自选分组的去重股票池</p>
              )}
            </div>
          </Card>

          <Card title="信号模板">
            <div className={styles.signalGrid}>
              {SIGNAL_TEMPLATES.map((signal) => (
                <button
                  key={signal.key}
                  className={`${styles.signalCard} ${selectedSignals.includes(signal.key) ? styles.active : ''}`}
                  onClick={() => toggleSignal(signal.key)}
                >
                  <span className={styles.signalLabel}>{signal.label}</span>
                  <span className={styles.signalDesc}>{signal.desc}</span>
                </button>
              ))}
            </div>
          </Card>

          <div className={styles.actionRow}>
            <Button
              variant="primary"
              size="lg"
              block
              icon={<Play size={18} />}
              loading={isScanning}
              onClick={handleScan}
              disabled={selectedSignals.length === 0}
            >
              {isScanning ? formatProgress(scanProgress) : '开始扫描'}
            </Button>
            {isScanning && (
              <Button
                variant="danger"
                size="lg"
                block
                icon={<SquareX size={18} />}
                onClick={handleCancelScan}
              >
                取消扫描
              </Button>
            )}
          </div>
        </div>

        <div className={styles.resultSection}>
          <Card
            title="扫描结果"
            extra={<span className={styles.resultCount}>{results.length} 个触发</span>}
          >
            {results.length === 0 ? (
              <Empty
                icon={<ScanLine size={48} strokeWidth={1} />}
                title={isScanning ? '正在扫描...' : '暂无扫描结果'}
                description={
                  isScanning ? formatProgress(scanProgress) : '选择股票池和信号模板后开始扫描'
                }
              />
            ) : (
              <div className={styles.resultList}>
                {results.map((item) => (
                  <div
                    key={`${item.routeCode}-${item.signal}`}
                    className={styles.resultItem}
                    onClick={() => handleStockClick(item.routeCode)}
                  >
                    <div className={styles.resultInfo}>
                      <span className={styles.resultName}>{item.name}</span>
                      <span className={styles.resultCode}>{item.code}</span>
                    </div>
                    <div className={styles.resultSignal}>
                      <span className={styles.signalTag}>{item.signal}</span>
                      <span className={styles.resultTime}>{item.time}</span>
                    </div>
                    <button
                      className={`${styles.addBtn} ${isInWatchlist(item.routeCode) ? styles.added : ''}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (!isInWatchlist(item.routeCode)) {
                          handleAddWatchlist(item.routeCode, item.name);
                        }
                      }}
                      disabled={isInWatchlist(item.routeCode)}
                    >
                      {isInWatchlist(item.routeCode) ? <Check size={14} /> : <Plus size={14} />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
