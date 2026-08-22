/**
 * 板块详情页
 */

import { useState, useEffect, useEffectEvent, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Check } from 'lucide-react';
import { Card, Tabs, Loading, Button, Empty, useToast } from '@/components/common';
import {
  getIndustryConstituents,
  getConceptConstituents,
  getIndustryKline,
  getConceptKline,
  getIndustrySpot,
  getConceptSpot,
  getSectorFundFlowHistory,
} from '@/services/sdk';
import { watchlistActions } from '@/services/watchlistStore';
import { useBoardData, useAppSettings } from '@/contexts';
import { useIsInWatchlist, useTheme } from '@/hooks';
import { getChartColors } from '@/components/charts/chartTheme';
import {
  formatPrice,
  formatPercent,
  formatAmount,
  formatMarketCap,
  formatTurnover,
  formatYuanAmount,
  getChangeColorClass,
} from '@/utils/format';
import type {
  IndustryBoardConstituent,
  ConceptBoardConstituent,
  IndustryBoardKline,
  ConceptBoardKline,
  IndustryBoardSpot,
  ConceptBoardSpot,
} from 'stock-sdk';
import { LazyEChart } from '@/components/charts/LazyEChart';
import styles from './BoardDetail.module.css';

type BoardFundFlowHistoryRows = Awaited<ReturnType<typeof getSectorFundFlowHistory>>;

// K线周期
const KLINE_PERIODS = [
  { key: 'daily', label: '日K' },
  { key: 'weekly', label: '周K' },
  { key: 'monthly', label: '月K' },
];

export function BoardDetail() {
  const { type, code } = useParams<{ type: 'industry' | 'concept'; code: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { industryList, conceptList, loading: boardLoading } = useBoardData();
  const { theme } = useTheme();
  const { settings } = useAppSettings();
  const chartColors = useMemo(
    () => getChartColors(theme, settings.colorMode),
    [theme, settings.colorMode]
  );

  // 数据状态
  const [constituents, setConstituents] = useState<(IndustryBoardConstituent | ConceptBoardConstituent)[]>([]);
  const [klineData, setKlineData] = useState<(IndustryBoardKline | ConceptBoardKline)[]>([]);
  const [spotData, setSpotData] = useState<(IndustryBoardSpot | ConceptBoardSpot)[]>([]);
  const [fundFlowHistory, setFundFlowHistory] = useState<BoardFundFlowHistoryRows>([]);

  // UI 状态
  const [loading, setLoading] = useState(true);
  const [klinePeriod, setKlinePeriod] = useState('daily');

  const isIndustry = type === 'industry';
  const boardInfo = useMemo(() => {
    if (!code) return null;
    const list = isIndustry ? industryList : conceptList;
    return list.find((item) => item.code === code) ?? null;
  }, [code, conceptList, industryList, isIndustry]);

  // 加载成分股
  const fetchConstituents = useCallback(async () => {
    if (!code) return;
    try {
      const data = isIndustry
        ? await getIndustryConstituents(code)
        : await getConceptConstituents(code);
      setConstituents(data);
    } catch (error) {
      console.error('Fetch constituents error:', error);
    }
  }, [code, isIndustry]);

  // 加载 K 线
  const fetchKline = useCallback(async () => {
    if (!code) return;
    try {
      const data = isIndustry
        ? await getIndustryKline(code, { period: klinePeriod as 'daily' | 'weekly' | 'monthly' })
        : await getConceptKline(code, { period: klinePeriod as 'daily' | 'weekly' | 'monthly' });
      // 只保留最近 60 条 K 线数据
      setKlineData(data.slice(-60));
    } catch (error) {
      console.error('Fetch kline error:', error);
    }
  }, [code, isIndustry, klinePeriod]);

  // 加载 Spot 指标
  const fetchSpot = useCallback(async () => {
    if (!code) return;
    try {
      const data = isIndustry
        ? await getIndustrySpot(code)
        : await getConceptSpot(code);
      setSpotData(data);
    } catch (error) {
      console.error('Fetch spot error:', error);
    }
  }, [code, isIndustry]);

  const fetchFundFlowHistory = useCallback(async () => {
    if (!code) return;
    try {
      const data = await getSectorFundFlowHistory(code, { period: 'daily' });
      setFundFlowHistory(data.slice(-30));
    } catch (error) {
      console.error('Fetch board fund flow error:', error);
    }
  }, [code]);

  // 初始加载（只在板块代码变化时触发）
  const loadAll = useEffectEvent(async () => {
    setLoading(true);
    await Promise.all([
      fetchConstituents(),
      fetchSpot(),
      fetchFundFlowHistory(),
      fetchKline(),
    ]);
    setLoading(false);
  });

  useEffect(() => {
    loadAll();
  }, [code, isIndustry]);

  // 周期变化时重新加载 K 线（不触发全页 loading）
  const reloadKline = useEffectEvent(() => {
    if (!loading && code) {
      fetchKline();
    }
  });

  useEffect(() => {
    reloadKline();
  }, [klinePeriod]);

  // K线图配置
  const klineChartOption = useMemo(() => {
    if (!klineData.length) return {};

    const {
      rise: riseColor,
      fall: fallColor,
      borderPrimary,
      borderSecondary,
      textTertiary,
      bgElevated,
      textPrimary,
    } = chartColors;

    const dates = klineData.map((d) => d.date);
    const ohlc = klineData.map((d) => [d.open, d.close, d.low, d.high]);

    return {
      animation: false,
      grid: { left: 60, right: 20, top: 20, bottom: 30 },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: borderPrimary } },
        axisLabel: { color: textTertiary, fontSize: 10 },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLine: { show: false },
        axisLabel: { 
          color: textTertiary, 
          fontSize: 10,
          formatter: (value: number) => value.toFixed(2),
        },
        splitLine: { lineStyle: { color: borderSecondary, type: 'dashed' } },
      },
      series: [
        {
          type: 'candlestick',
          data: ohlc,
          itemStyle: {
            color: riseColor,
            color0: fallColor,
            borderColor: riseColor,
            borderColor0: fallColor,
          },
        },
      ],
      tooltip: {
        trigger: 'axis',
        backgroundColor: bgElevated,
        borderColor: borderPrimary,
        textStyle: { color: textPrimary, fontSize: 12 },
      },
      dataZoom: [
        { type: 'inside', start: 70, end: 100 },
        { type: 'slider', start: 70, end: 100, height: 20, bottom: 0 },
      ],
    };
  }, [klineData, chartColors]);

  const latestFundFlow = fundFlowHistory.at(-1) ?? null;

  const fundFlowChartOption = useMemo(() => {
    if (!fundFlowHistory.length) return {};

    const {
      rise: riseColor,
      fall: fallColor,
      borderPrimary,
      borderSecondary,
      textTertiary,
      bgElevated,
      textPrimary,
    } = chartColors;

    return {
      animation: false,
      grid: { left: 60, right: 50, top: 20, bottom: 30 },
      xAxis: {
        type: 'category',
        data: fundFlowHistory.map((item) => item.date),
        axisLine: { lineStyle: { color: borderPrimary } },
        axisLabel: { color: textTertiary, fontSize: 10 },
      },
      yAxis: [
        {
          type: 'value',
          axisLine: { show: false },
          axisLabel: {
            color: textTertiary,
            fontSize: 10,
            formatter: (value: number) => `${value.toFixed(1)}亿`,
          },
          splitLine: { lineStyle: { color: borderSecondary, type: 'dashed' } },
        },
        {
          type: 'value',
          axisLine: { show: false },
          axisLabel: {
            color: textTertiary,
            fontSize: 10,
            formatter: (value: number) => `${value.toFixed(1)}%`,
          },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '主力净流入',
          type: 'bar',
          data: fundFlowHistory.map((item) =>
            item.mainNetInflow === null ? null : item.mainNetInflow / 100000000
          ),
          itemStyle: {
            color: (params: { value: number }) => (params.value >= 0 ? riseColor : fallColor),
          },
          barMaxWidth: 18,
        },
        {
          name: '净占比',
          type: 'line',
          yAxisIndex: 1,
          data: fundFlowHistory.map((item) => item.mainNetInflowPercent),
          symbol: 'none',
          lineStyle: { width: 1.5, color: chartColors.accent },
        },
      ],
      tooltip: {
        trigger: 'axis',
        backgroundColor: bgElevated,
        borderColor: borderPrimary,
        textStyle: { color: textPrimary, fontSize: 12 },
      },
    };
  }, [fundFlowHistory, chartColors]);

  // 跳转个股
  const handleStockClick = (stockCode: string) => {
    navigate(`/s/${stockCode}`);
  };

  // 加入自选
  const handleAddWatchlist = (stockCode: string, stockName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (checkIsAdded(stockCode)) return;
    watchlistActions.add(stockCode);
    toast.success(`已将 ${stockName} 加入自选`);
  };

  // 检查是否已加自选
  const checkIsAdded = useIsInWatchlist();

  if (loading || boardLoading) {
    return <Loading fullScreen text="加载板块数据..." />;
  }

  if (!boardInfo) {
    return (
      <div className={styles.notFound}>
        <p>未找到板块 {code}</p>
        <Button onClick={() => navigate(-1)}>返回</Button>
      </div>
    );
  }

  return (
    <div className={styles.detail}>
      {/* 头部 */}
      <motion.header
        className={styles.header}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>

        <div className={styles.boardHeader}>
          <h1 className={styles.boardName}>{boardInfo.name}</h1>
          <span className={styles.boardType}>
            {isIndustry ? '行业板块' : '概念板块'}
          </span>
        </div>

        <div className={`${styles.boardChange} ${getChangeColorClass(boardInfo.changePercent)}`}>
          {formatPercent(boardInfo.changePercent)}
        </div>

        <div className={styles.boardMeta}>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>总市值</span>
            <span>{formatMarketCap(boardInfo.totalMarketCap)}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>换手率</span>
            <span>{formatTurnover(boardInfo.turnoverRate)}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>涨/跌</span>
            <span>
              <span className="text-rise">{boardInfo.riseCount}</span>
              {' / '}
              <span className="text-fall">{boardInfo.fallCount}</span>
            </span>
          </div>
        </div>
      </motion.header>

      <div className={styles.content}>
        {/* K线图 */}
        <Card
          title="K线走势"
          extra={
            <Tabs
              items={KLINE_PERIODS}
              activeKey={klinePeriod}
              onChange={setKlinePeriod}
              size="sm"
            />
          }
        >
          <div className={styles.chartContainer}>
            {klineData.length > 0 ? (
              <LazyEChart
                option={klineChartOption}
                style={{ height: '100%', width: '100%' }}
                notMerge
              />
            ) : (
              <Empty title="暂无K线数据" />
            )}
          </div>
        </Card>

        {/* Spot 指标 */}
        {spotData.length > 0 && (
          <Card title="实时指标">
            <div className={styles.spotGrid}>
              {spotData.map((spot) => (
                <div key={spot.item} className={styles.spotItem}>
                  <span className={styles.spotLabel}>{spot.item}</span>
                  <span className={styles.spotValue}>
                    {spot.value?.toLocaleString() ?? '--'}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {fundFlowHistory.length > 0 && latestFundFlow && (
          <Card title="板块资金流">
            <div className={styles.flowSummary}>
              <div className={styles.flowSummaryItem}>
                <span className={styles.flowSummaryLabel}>主力净流入</span>
                <span
                  className={`${styles.flowSummaryValue} ${getChangeColorClass(
                    latestFundFlow.mainNetInflow
                  )}`}
                >
                  {formatYuanAmount(latestFundFlow.mainNetInflow)}
                </span>
              </div>
              <div className={styles.flowSummaryItem}>
                <span className={styles.flowSummaryLabel}>净占比</span>
                <span
                  className={`${styles.flowSummaryValue} ${getChangeColorClass(
                    latestFundFlow.mainNetInflowPercent
                  )}`}
                >
                  {formatPercent(latestFundFlow.mainNetInflowPercent)}
                </span>
              </div>
              <div className={styles.flowSummaryItem}>
                <span className={styles.flowSummaryLabel}>超大单净流入</span>
                <span
                  className={`${styles.flowSummaryValue} ${getChangeColorClass(
                    latestFundFlow.superLargeNetInflow
                  )}`}
                >
                  {formatYuanAmount(latestFundFlow.superLargeNetInflow)}
                </span>
              </div>
              <div className={styles.flowSummaryItem}>
                <span className={styles.flowSummaryLabel}>小单净流入</span>
                <span
                  className={`${styles.flowSummaryValue} ${getChangeColorClass(
                    latestFundFlow.smallNetInflow
                  )}`}
                >
                  {formatYuanAmount(latestFundFlow.smallNetInflow)}
                </span>
              </div>
            </div>
            <div className={styles.flowChart}>
              <LazyEChart
                option={fundFlowChartOption}
                style={{ height: '100%', width: '100%' }}
                notMerge
              />
            </div>
          </Card>
        )}

        {/* 成分股 */}
        <Card title={`成分股 (${constituents.length})`}>
          <div className={styles.stockTable}>
            <div className={styles.tableHeader}>
              <span className={styles.colRank}>排名</span>
              <span className={styles.colName}>名称/代码</span>
              <span className={styles.colPrice}>现价</span>
              <span className={styles.colChangePercent}>涨跌幅</span>
              <span className={styles.colAmount}>成交额</span>
              <span className={styles.colTurnover}>换手</span>
              <span className={styles.colPe}>PE</span>
              <span className={styles.colAction}>操作</span>
            </div>
            <div className={styles.tableBody}>
              {constituents.slice(0, 50).map((stock) => (
                <div
                  key={stock.code}
                  className={styles.tableRow}
                  onClick={() => handleStockClick(stock.code)}
                >
                  <span className={styles.colRank}>
                    <span className={`${styles.rankNum} ${stock.rank <= 3 ? styles.top3 : ''}`}>
                      {stock.rank}
                    </span>
                  </span>
                  <div className={styles.colName}>
                    <span className={styles.stockName}>{stock.name}</span>
                    <span className={styles.stockCode}>{stock.code}</span>
                  </div>
                  <span className={`${styles.colPrice} ${getChangeColorClass(stock.changePercent)}`}>
                    {formatPrice(stock.price)}
                  </span>
                  <span className={`${styles.colChangePercent} ${getChangeColorClass(stock.changePercent)}`}>
                    {formatPercent(stock.changePercent)}
                  </span>
                  <span className={styles.colAmount}>
                    {formatAmount(stock.amount)}
                  </span>
                  <span className={styles.colTurnover}>
                    {formatTurnover(stock.turnoverRate)}
                  </span>
                  <span className={styles.colPe}>
                    {stock.pe?.toFixed(2) ?? '--'}
                  </span>
                  <div className={styles.colAction}>
                    <button
                      className={`${styles.addBtn} ${checkIsAdded(stock.code) ? styles.added : ''}`}
                      onClick={(e) => handleAddWatchlist(stock.code, stock.name, e)}
                      disabled={checkIsAdded(stock.code)}
                    >
                      {checkIsAdded(stock.code) ? <Check size={14} /> : <Plus size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
