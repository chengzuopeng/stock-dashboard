/**
 * 总览页面
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { Card, Tabs, Loading, Empty, Button } from '@/components/common';
import { useAllWatchlistCodes, usePolling } from '@/hooks';
import { useBoardData, useAppSettings } from '@/contexts';
import {
  getAllAShareQuotes,
  getFullQuotes,
  getFundFlowRank,
  getMarketFundFlow,
  getNorthboundFlowSummary,
  getSectorFundFlowRank,
} from '@/services/sdk';
import { selectAllCodes, watchlistStore } from '@/services/watchlistStore';
import { isLimitDown, isLimitUp } from '@/services/analysis';
import {
  formatPrice,
  formatPercent,
  formatAmount,
  formatYuanAmount,
  getChangeColorClass,
} from '@/utils/format';
import type { FullQuote } from 'stock-sdk';
import styles from './Dashboard.module.css';

// 主要指数
const MAIN_INDICES = [
  'sh000001', // 上证指数
  'sz399001', // 深证成指
  'sz399006', // 创业板指
  'sh000688', // 科创50
  'sz399300', // 沪深300
  'sh000016', // 上证50
];

// 榜单类型
const RANKING_TABS = [
  { key: 'rise', label: '涨幅榜' },
  { key: 'fall', label: '跌幅榜' },
  { key: 'amount', label: '成交额' },
  { key: 'turnover', label: '换手率' },
];

interface MarketSummary {
  riseCount: number;
  fallCount: number;
  flatCount: number;
  limitUpCount: number;
  limitDownCount: number;
  totalAmount: number;
}

type MarketFundFlowRows = Awaited<ReturnType<typeof getMarketFundFlow>>;
type NorthboundSummaryRows = Awaited<ReturnType<typeof getNorthboundFlowSummary>>;
type SectorFundFlowRows = Awaited<ReturnType<typeof getSectorFundFlowRank>>;
type FundFlowRankRows = Awaited<ReturnType<typeof getFundFlowRank>>;

export function Dashboard() {
  const navigate = useNavigate();
  const { getRefreshInterval } = useAppSettings();

  // 使用共享的板块数据（优化：避免重复请求）
  const { industryList, conceptList, loading: boardLoading } = useBoardData();

  // 本地数据状态
  const [indices, setIndices] = useState<FullQuote[]>([]);
  const [watchlistQuotes, setWatchlistQuotes] = useState<FullQuote[]>([]);
  const [marketQuotes, setMarketQuotes] = useState<FullQuote[]>([]);
  const [marketFundFlowHistory, setMarketFundFlowHistory] =
    useState<MarketFundFlowRows>([]);
  const [northboundSummary, setNorthboundSummary] =
    useState<NorthboundSummaryRows>([]);
  const [industryFundFlowRanks, setIndustryFundFlowRanks] =
    useState<SectorFundFlowRows>([]);
  const [conceptFundFlowRanks, setConceptFundFlowRanks] =
    useState<SectorFundFlowRows>([]);
  const [fundFlowRanks, setFundFlowRanks] = useState<FundFlowRankRows>([]);
  const [rankingTab, setRankingTab] = useState('rise');
  const [boardTab, setBoardTab] = useState<'industry' | 'concept'>('industry');
  const [initialLoading, setInitialLoading] = useState(true);

  // 获取自选代码
  const watchlistCodes = useAllWatchlistCodes();
  const listRefreshInterval = getRefreshInterval('list');
  const breadthRefreshInterval = Math.max(listRefreshInterval * 4, 60000);

  // 只加载指数和自选数据（板块数据由全局 Context 提供）
  // 自选代码在闭包内即时读取：依赖 length 的 memo 化会让轮询一直拉旧代码列表
  const fetchQuoteData = useCallback(async () => {
    try {
      const codes = selectAllCodes(watchlistStore.getSnapshot());
      const [indicesData, watchlistData] = await Promise.all([
        getFullQuotes(MAIN_INDICES),
        codes.length > 0
          ? getFullQuotes(codes.slice(0, 50))
          : Promise.resolve<FullQuote[]>([]),
      ]);
      setIndices(indicesData);
      setWatchlistQuotes(watchlistData);
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  const fetchMarketOverview = useCallback(async () => {
    try {
      const quotes = await getAllAShareQuotes({
        batchSize: 500,
        concurrency: 4,
      });
      setMarketQuotes(quotes);
    } catch (error) {
      console.error('Dashboard market overview error:', error);
    }
  }, []);

  const fetchMarketInsights = useCallback(async () => {
    try {
      const [
        marketFundFlowData,
        northboundSummaryData,
        industryFundFlowData,
        conceptFundFlowData,
        fundFlowRankData,
      ] = await Promise.all([
        getMarketFundFlow(),
        getNorthboundFlowSummary(),
        getSectorFundFlowRank({ indicator: 'today', sectorType: 'industry' }),
        getSectorFundFlowRank({ indicator: 'today', sectorType: 'concept' }),
        getFundFlowRank({ indicator: 'today' }),
      ]);

      setMarketFundFlowHistory(marketFundFlowData);
      setNorthboundSummary(northboundSummaryData);
      setIndustryFundFlowRanks(industryFundFlowData);
      setConceptFundFlowRanks(conceptFundFlowData);
      setFundFlowRanks(fundFlowRankData);
    } catch (error) {
      console.error('Dashboard market insights error:', error);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    fetchQuoteData();
    fetchMarketOverview();
    fetchMarketInsights();
  }, [fetchMarketInsights, fetchMarketOverview, fetchQuoteData]);

  // 轮询指数和自选数据（优化：只轮询需要实时更新的数据）
  usePolling(fetchQuoteData, {
    interval: listRefreshInterval,
    enabled: !initialLoading,
    immediate: false,
  });

  usePolling(fetchMarketOverview, {
    interval: breadthRefreshInterval,
    enabled: !initialLoading,
    immediate: false,
  });

  usePolling(fetchMarketInsights, {
    interval: breadthRefreshInterval,
    enabled: !initialLoading,
    immediate: false,
  });

  // 跳转详情
  const handleStockClick = (code: string) => {
    navigate(`/s/${code}`);
  };

  // 跳转板块
  const handleBoardClick = (code: string, type: 'industry' | 'concept') => {
    navigate(`/boards/${type}/${code}`);
  };

  const currentBoards = boardTab === 'industry' ? industryList : conceptList;
  const currentFundFlowBoards =
    boardTab === 'industry' ? industryFundFlowRanks : conceptFundFlowRanks;
  const strongestBoard = currentBoards[0];
  const latestMarketFundFlow = marketFundFlowHistory.at(-1) ?? null;
  const northboundSnapshot =
    northboundSummary.find(
      (item) => item.direction.includes('北向') || item.boardName.includes('北向')
    ) ??
    northboundSummary.find((item) => item.direction.includes('沪深港通')) ??
    northboundSummary[0] ??
    null;

  const marketSummary = useMemo<MarketSummary>(() => {
    return marketQuotes.reduce(
      (summary, quote) => {
        if (quote.changePercent > 0) summary.riseCount += 1;
        else if (quote.changePercent < 0) summary.fallCount += 1;
        else summary.flatCount += 1;

        if (isLimitUp(quote)) summary.limitUpCount += 1;
        if (isLimitDown(quote)) summary.limitDownCount += 1;
        summary.totalAmount += quote.amount ?? 0;
        return summary;
      },
      {
        riseCount: 0,
        fallCount: 0,
        flatCount: 0,
        limitUpCount: 0,
        limitDownCount: 0,
        totalAmount: 0,
      }
    );
  }, [marketQuotes]);

  const rankingItems = useMemo(() => {
    const sorted = [...marketQuotes];
    switch (rankingTab) {
      case 'fall':
        sorted.sort((a, b) => a.changePercent - b.changePercent);
        break;
      case 'amount':
        sorted.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
        break;
      case 'turnover':
        sorted.sort((a, b) => (b.turnoverRate ?? 0) - (a.turnoverRate ?? 0));
        break;
      case 'rise':
      default:
        sorted.sort((a, b) => b.changePercent - a.changePercent);
        break;
    }

    return sorted.slice(0, 10);
  }, [marketQuotes, rankingTab]);

  // 只在初始加载时显示 loading，之后即使数据获取失败也显示页面
  if (initialLoading && boardLoading) {
    return <Loading fullScreen text="加载中..." />;
  }

  return (
    <div className={styles.dashboard}>
      {/* 指数卡片 */}
      <section className={styles.indices}>
        {indices.map((item, index) => (
          <motion.div
            key={item.code}
            className={styles.indexCard}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => handleStockClick(item.code)}
          >
            <div className={styles.indexName}>{item.name}</div>
            <div className={`${styles.indexPrice} ${getChangeColorClass(item.changePercent)}`}>
              {formatPrice(item.price)}
            </div>
            <div className={styles.indexChange}>
              <span className={getChangeColorClass(item.changePercent)}>
                {formatPercent(item.changePercent)}
              </span>
              <span className={`${styles.indexChangeVal} ${getChangeColorClass(item.change)}`}>
                {item.change !== null && item.change > 0 ? '+' : ''}
                {item.change?.toFixed(2) ?? '--'}
              </span>
            </div>
            <div className={styles.indexAmount}>
              成交 {formatAmount(item.amount)}
            </div>
          </motion.div>
        ))}
      </section>

      <section className={styles.statsGrid}>
        <Card title="市场涨跌">
          <div className={styles.statCard}>
            <div className={styles.statValueRow}>
              <span className="text-rise">{marketSummary.riseCount}</span>
              <span className={styles.statDivider}>/</span>
              <span className="text-fall">{marketSummary.fallCount}</span>
            </div>
            <div className={styles.statMeta}>
              <span>上涨 / 下跌</span>
              <span>{marketSummary.flatCount} 平</span>
            </div>
          </div>
        </Card>

        <Card title="涨跌停">
          <div className={styles.statCard}>
            <div className={styles.statValueRow}>
              <span className="text-rise">{marketSummary.limitUpCount}</span>
              <span className={styles.statDivider}>/</span>
              <span className="text-fall">{marketSummary.limitDownCount}</span>
            </div>
            <div className={styles.statMeta}>
              <span>涨停 / 跌停</span>
            </div>
          </div>
        </Card>

        <Card title="全市场成交额">
          <div className={styles.statCard}>
            <div className={styles.statValueLarge}>
              {formatAmount(marketSummary.totalAmount)}
            </div>
            <div className={styles.statMeta}>
              <span>A 股实时成交额快照</span>
            </div>
          </div>
        </Card>

        <Card title="北向资金">
          <div className={styles.statCard}>
            <div
              className={`${styles.statValueLarge} ${getChangeColorClass(
                northboundSnapshot?.netInflow ?? northboundSnapshot?.netBuyAmount
              )}`}
            >
              {formatYuanAmount(
                northboundSnapshot?.netInflow ?? northboundSnapshot?.netBuyAmount
              )}
            </div>
            <div className={styles.statMeta}>
              <span>
                上涨 {northboundSnapshot?.upCount ?? '--'} / 下跌{' '}
                {northboundSnapshot?.downCount ?? '--'}
              </span>
              <span>{northboundSnapshot?.boardName ?? '北向汇总'}</span>
            </div>
          </div>
        </Card>

        <Card title="大盘主力">
          <div className={styles.statCard}>
            <div
              className={`${styles.statValueLarge} ${getChangeColorClass(
                latestMarketFundFlow?.mainNetInflow
              )}`}
            >
              {formatYuanAmount(latestMarketFundFlow?.mainNetInflow)}
            </div>
            <div className={styles.statMeta}>
              <span>
                占比 {formatPercent(latestMarketFundFlow?.mainNetInflowPercent)}
              </span>
              <span>{latestMarketFundFlow?.date ?? '当日快照'}</span>
            </div>
          </div>
        </Card>

        <Card title="最强板块">
          <div className={styles.statCard}>
            <div className={styles.statValueLarge}>{strongestBoard?.name ?? '--'}</div>
            <div className={styles.statMeta}>
              <span className={getChangeColorClass(strongestBoard?.changePercent)}>
                {formatPercent(strongestBoard?.changePercent)}
              </span>
              <span>{boardTab === 'industry' ? '行业强度' : '概念强度'}</span>
            </div>
          </div>
        </Card>
      </section>

      <div className={styles.mainGrid}>
        {/* 左侧：自选 + 榜单 */}
        <div className={styles.leftCol}>
          {/* 自选快照 */}
          <Card
            title="自选股"
            extra={
              <Button
                size="sm"
                variant="ghost"
                icon={<Plus size={14} />}
                onClick={() => navigate('/watchlist')}
              >
                管理
              </Button>
            }
          >
            {watchlistCodes.length === 0 ? (
              <Empty
                title="暂无自选股"
                description="搜索添加股票到自选"
                action={
                  <Button size="sm" onClick={() => navigate('/watchlist')}>
                    添加自选
                  </Button>
                }
              />
            ) : (
              <div className={styles.watchlist}>
                {watchlistQuotes.slice(0, 10).map((item) => (
                  <div
                    key={item.code}
                    className={styles.watchlistItem}
                    onClick={() => handleStockClick(item.code)}
                  >
                    <div className={styles.stockInfo}>
                      <span className={styles.stockName}>{item.name}</span>
                      <span className={styles.stockCode}>{item.code}</span>
                    </div>
                    <div className={styles.stockPrice}>
                      <span className={getChangeColorClass(item.changePercent)}>
                        {formatPrice(item.price)}
                      </span>
                    </div>
                    <div className={`${styles.stockChange} ${getChangeColorClass(item.changePercent)}`}>
                      {formatPercent(item.changePercent)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* 榜单 */}
          <Card
            title="市场榜单"
            extra={
              <Tabs
                items={RANKING_TABS}
                activeKey={rankingTab}
                onChange={setRankingTab}
                size="sm"
              />
            }
          >
            {rankingItems.length === 0 ? (
              <Loading size="md" />
            ) : (
              <div className={styles.rankingList}>
                {rankingItems.map((item, index) => (
                  <div
                    key={item.code}
                    className={styles.rankingItem}
                    onClick={() => handleStockClick(item.code)}
                  >
                    <span className={styles.rankNum}>{index + 1}</span>
                    <div className={styles.stockInfo}>
                      <span className={styles.stockName}>{item.name}</span>
                      <span className={styles.stockCode}>{item.code}</span>
                    </div>
                    <div className={styles.stockPrice}>
                      <span>{formatPrice(item.price)}</span>
                    </div>
                    <div className={`${styles.stockChange} ${getChangeColorClass(item.changePercent)}`}>
                      {rankingTab === 'amount'
                        ? formatAmount(item.amount)
                        : rankingTab === 'turnover'
                          ? `${item.turnoverRate?.toFixed(2) ?? '--'}%`
                          : formatPercent(item.changePercent)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="主力净流入榜">
            {fundFlowRanks.length === 0 ? (
              <Loading size="md" />
            ) : (
              <div className={styles.rankingList}>
                {fundFlowRanks.slice(0, 8).map((item, index) => (
                  <div
                    key={item.code}
                    className={styles.rankingItem}
                    onClick={() => handleStockClick(item.code)}
                  >
                    <span className={styles.rankNum}>{index + 1}</span>
                    <div className={styles.stockInfo}>
                      <span className={styles.stockName}>{item.name}</span>
                      <span className={styles.stockCode}>{item.code}</span>
                    </div>
                    <div className={styles.stockPrice}>
                      <span>{formatPrice(item.price)}</span>
                    </div>
                    <div
                      className={`${styles.stockChange} ${getChangeColorClass(
                        item.mainNetInflow
                      )}`}
                    >
                      {formatYuanAmount(item.mainNetInflow)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* 右侧：热点板块 */}
        <div className={styles.rightCol}>
          <Card
            title="热点板块"
            extra={
              <Tabs
                items={[
                  { key: 'industry', label: '行业' },
                  { key: 'concept', label: '概念' },
                ]}
                activeKey={boardTab}
                onChange={(key) => setBoardTab(key as 'industry' | 'concept')}
                size="sm"
              />
            }
          >
            <div className={styles.boardList}>
              {currentBoards.slice(0, 15).map((item, index) => (
                <motion.div
                  key={item.code}
                  className={styles.boardItem}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => handleBoardClick(item.code, boardTab)}
                >
                  <div className={styles.boardLeft}>
                    <span className={styles.boardRank}>{item.rank}</span>
                    <div className={styles.boardInfo}>
                      <span className={styles.boardName}>{item.name}</span>
                      <span className={styles.boardLeader}>
                        领涨：{item.leadingStock}
                        <span className={getChangeColorClass(item.leadingStockChangePercent)}>
                          {' '}{formatPercent(item.leadingStockChangePercent)}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className={styles.boardRight}>
                    <div className={`${styles.boardChange} ${getChangeColorClass(item.changePercent)}`}>
                      {formatPercent(item.changePercent)}
                    </div>
                    <div className={styles.boardStats}>
                      <span className="text-rise">{item.riseCount}↑</span>
                      <span className="text-fall">{item.fallCount}↓</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>

          <Card
            title="板块资金流"
            extra={
              <Tabs
                items={[
                  { key: 'industry', label: '行业' },
                  { key: 'concept', label: '概念' },
                ]}
                activeKey={boardTab}
                onChange={(key) => setBoardTab(key as 'industry' | 'concept')}
                size="sm"
              />
            }
          >
            <div className={styles.boardList}>
              {currentFundFlowBoards.slice(0, 12).map((item, index) => (
                <motion.div
                  key={`${item.code}-flow`}
                  className={styles.boardItem}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => handleBoardClick(item.code, boardTab)}
                >
                  <div className={styles.boardLeft}>
                    <span className={styles.boardRank}>{index + 1}</span>
                    <div className={styles.boardInfo}>
                      <span className={styles.boardName}>{item.name}</span>
                      <span className={styles.boardLeader}>
                        领流：{item.topStockName || '--'}
                        {item.topStockCode ? ` · ${item.topStockCode}` : ''}
                      </span>
                    </div>
                  </div>
                  <div className={styles.boardRight}>
                    <div
                      className={`${styles.boardChange} ${getChangeColorClass(
                        item.mainNetInflow
                      )}`}
                    >
                      {formatYuanAmount(item.mainNetInflow)}
                    </div>
                    <div className={styles.boardStats}>
                      <span className={getChangeColorClass(item.changePercent)}>
                        {formatPercent(item.changePercent)}
                      </span>
                      <span className={getChangeColorClass(item.mainNetInflowPercent)}>
                        {formatPercent(item.mainNetInflowPercent)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
