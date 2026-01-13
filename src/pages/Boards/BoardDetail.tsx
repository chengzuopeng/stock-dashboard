/**
 * 板块详情页
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ReactECharts from 'echarts-for-react';
import { ArrowLeft, Plus, Check } from 'lucide-react';
import { Card, Tabs, Loading, Button, Empty, useToast } from '@/components/common';
import {
  getIndustryList,
  getConceptList,
  getIndustryConstituents,
  getConceptConstituents,
  getIndustryKline,
  getConceptKline,
  getIndustrySpot,
  getConceptSpot,
} from '@/services/sdk';
import { addToWatchlist, isInWatchlist } from '@/services/storage';
import {
  formatPrice,
  formatPercent,
  formatAmount,
  formatMarketCap,
  formatTurnover,
  getChangeColorClass,
} from '@/utils/format';
import type {
  IndustryBoard,
  ConceptBoard,
  IndustryBoardConstituent,
  ConceptBoardConstituent,
  IndustryBoardKline,
  ConceptBoardKline,
  IndustryBoardSpot,
  ConceptBoardSpot,
} from 'stock-sdk';
import styles from './BoardDetail.module.css';

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

  // 数据状态
  const [boardInfo, setBoardInfo] = useState<IndustryBoard | ConceptBoard | null>(null);
  const [constituents, setConstituents] = useState<(IndustryBoardConstituent | ConceptBoardConstituent)[]>([]);
  const [klineData, setKlineData] = useState<(IndustryBoardKline | ConceptBoardKline)[]>([]);
  const [spotData, setSpotData] = useState<(IndustryBoardSpot | ConceptBoardSpot)[]>([]);

  // UI 状态
  const [loading, setLoading] = useState(true);
  const [klinePeriod, setKlinePeriod] = useState('daily');
  const [addedCodes, setAddedCodes] = useState<Set<string>>(new Set());

  const isIndustry = type === 'industry';

  // 加载板块信息
  const fetchBoardInfo = useCallback(async () => {
    if (!code) return;
    try {
      const list = isIndustry ? await getIndustryList() : await getConceptList();
      const info = list.find((b) => b.code === code);
      if (info) setBoardInfo(info);
    } catch (error) {
      console.error('Fetch board info error:', error);
    }
  }, [code, isIndustry]);

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

  // 初始加载（只在板块代码变化时触发）
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchBoardInfo(), fetchConstituents(), fetchSpot()]);
      await fetchKline();
      setLoading(false);
    };
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, isIndustry]);

  // 周期变化时重新加载 K 线（不触发全页 loading）
  useEffect(() => {
    if (!loading && code) {
      fetchKline();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [klinePeriod]);

  // K线图配置
  const klineChartOption = useMemo(() => {
    if (!klineData.length) return {};

    // 获取 CSS 变量值
    const computedStyle = window.getComputedStyle(document.documentElement);
    const riseColor = computedStyle.getPropertyValue('--color-rise').trim() || '#ef4444';
    const fallColor = computedStyle.getPropertyValue('--color-fall').trim() || '#22c55e';
    const borderPrimary = computedStyle.getPropertyValue('--border-primary').trim() || '#333';
    const borderSecondary = computedStyle.getPropertyValue('--border-secondary').trim() || '#222';
    const textTertiary = computedStyle.getPropertyValue('--text-tertiary').trim() || '#666';
    const bgElevated = computedStyle.getPropertyValue('--bg-elevated').trim() || '#1a1a1a';
    const textPrimary = computedStyle.getPropertyValue('--text-primary').trim() || '#fff';

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
  }, [klineData]);

  // 跳转个股
  const handleStockClick = (stockCode: string) => {
    navigate(`/s/${stockCode}`);
  };

  // 加入自选
  const handleAddWatchlist = (stockCode: string, stockName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (addedCodes.has(stockCode) || isInWatchlist(stockCode)) return;
    addToWatchlist(stockCode);
    setAddedCodes(prev => new Set([...prev, stockCode]));
    toast.success(`已将 ${stockName} 加入自选`);
  };

  // 检查是否已加自选
  const checkIsAdded = (stockCode: string) => {
    return addedCodes.has(stockCode) || isInWatchlist(stockCode);
  };

  if (loading) {
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
              <ReactECharts
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
