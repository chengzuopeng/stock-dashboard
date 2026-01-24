/**
 * 个股详情页
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ReactECharts from 'echarts-for-react';
import {
  Star,
  StarOff,
  ArrowLeft,
} from 'lucide-react';
import { Card, Tabs, Loading, Button, useToast } from '@/components/common';
import { usePolling } from '@/hooks';
import {
  getFullQuotes,
  getTodayTimeline,
  getKlineWithIndicators,
  getMinuteKline,
  getFundFlow,
  getPanelLargeOrder,
} from '@/services/sdk';
import {
  addToWatchlist,
  removeFromWatchlist,
  isInWatchlist,
} from '@/services/storage';
import {
  formatPrice,
  formatPercent,
  formatChange,
  formatAmount,
  formatVolume,
  formatMarketCap,
  formatTurnover,
  formatVolumeRatio,
  formatRatio,
  getChangeColorClass,
  normalizeStockCode,
} from '@/utils/format';
import type {
  FullQuote,
  TodayTimelineResponse,
  FundFlow,
  PanelLargeOrder,
} from 'stock-sdk';
import styles from './StockDetail.module.css';

// K线周期
const KLINE_PERIODS = [
  { key: 'daily', label: '日K' },
  { key: 'weekly', label: '周K' },
  { key: 'monthly', label: '月K' },
];

// 分钟周期
const MINUTE_PERIODS = [
  { key: '1', label: '分时' },
  { key: '5', label: '5分' },
  { key: '15', label: '15分' },
  { key: '30', label: '30分' },
  { key: '60', label: '60分' },
];

// 指标选项
const INDICATOR_OPTIONS = [
  { key: 'ma', label: 'MA' },
  { key: 'macd', label: 'MACD' },
  { key: 'boll', label: 'BOLL' },
  { key: 'kdj', label: 'KDJ' },
  { key: 'rsi', label: 'RSI' },
];

export function StockDetail() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const normalizedCode = normalizeStockCode(code || '');
  const toast = useToast();

  // K线数据类型
  interface KlineDataItem {
    date?: string;
    time?: string;
    open: number;
    close: number;
    high: number;
    low: number;
    volume: number;
    ma?: { [key: string]: number };
    macd?: { dif: number; dea: number; macd: number };
    boll?: { upper: number; mid: number; lower: number };
    kdj?: { k: number; d: number; j: number };
    rsi?: { rsi6?: number; rsi12?: number; rsi24?: number };
  }

  // 分钟K线数据类型
  interface MinuteKlineItem {
    time: string;
    open: number;
    close: number;
    high: number;
    low: number;
    volume: number;
  }

  // 数据状态
  const [quote, setQuote] = useState<FullQuote | null>(null);
  const [timeline, setTimeline] = useState<TodayTimelineResponse | null>(null);
  const [minuteKline, setMinuteKline] = useState<MinuteKlineItem[]>([]);
  const [klineData, setKlineData] = useState<KlineDataItem[]>([]);
  const [fundFlow, setFundFlow] = useState<FundFlow | null>(null);
  const [largeOrder, setLargeOrder] = useState<PanelLargeOrder | null>(null);

  // UI 状态
  const [loading, setLoading] = useState(true);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [minutePeriod, setMinutePeriod] = useState('1');
  const [klinePeriod, setKlinePeriod] = useState('daily');
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>(['ma', 'macd']);

  // 检查自选状态
  useEffect(() => {
    setInWatchlist(isInWatchlist(normalizedCode));
  }, [normalizedCode]);

  // 加载行情数据
  const fetchQuote = useCallback(async () => {
    if (!normalizedCode) return;
    try {
      const [quoteData] = await getFullQuotes([normalizedCode]);
      if (quoteData) {
        setQuote(quoteData);
      }
    } catch (error) {
      console.error('Fetch quote error:', error);
    }
  }, [normalizedCode]);

  // 加载分时数据
  const fetchTimeline = useCallback(async () => {
    if (!normalizedCode) return;
    try {
      if (minutePeriod === '1') {
        const data = await getTodayTimeline(normalizedCode);
        setTimeline(data);
        setMinuteKline([]);
      } else {
        const data = await getMinuteKline(normalizedCode, {
          period: minutePeriod as '5' | '15' | '30' | '60',
        });
        // 保存分钟K线数据
        setMinuteKline(data as MinuteKlineItem[]);
      }
    } catch (error) {
      console.error('Fetch timeline error:', error);
    }
  }, [normalizedCode, minutePeriod]);

  // 加载 K 线数据
  const fetchKline = useCallback(async () => {
    if (!normalizedCode) return;
    try {
      const indicators: Record<string, boolean> = {};
      selectedIndicators.forEach((ind) => {
        indicators[ind] = true;
      });

      const data = await getKlineWithIndicators(normalizedCode, {
        period: klinePeriod as 'daily' | 'weekly' | 'monthly',
        adjust: 'qfq',
        indicators,
      });
      // 保留全部数据，通过 dataZoom 控制默认展示范围
      setKlineData(data as KlineDataItem[]);
    } catch (error) {
      console.error('Fetch kline error:', error);
    }
  }, [normalizedCode, klinePeriod, selectedIndicators]);

  // 加载资金数据
  const fetchFundData = useCallback(async () => {
    if (!normalizedCode) return;
    try {
      const [flowData] = await getFundFlow([normalizedCode]);
      const [orderData] = await getPanelLargeOrder([normalizedCode]);
      if (flowData) setFundFlow(flowData);
      if (orderData) setLargeOrder(orderData);
    } catch (error) {
      console.error('Fetch fund data error:', error);
    }
  }, [normalizedCode]);

  // 初始加载（只在代码变化时触发）
  useEffect(() => {
    const loadInitial = async () => {
      setLoading(true);
      await Promise.all([fetchQuote(), fetchTimeline(), fetchFundData()]);
      await fetchKline();
      setLoading(false);
    };
    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedCode]);

  // K线周期/指标变化时单独加载K线（不触发全页loading）
  useEffect(() => {
    if (!loading && normalizedCode) {
      fetchKline();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [klinePeriod, selectedIndicators]);

  // 分钟周期变化时重新加载分时数据
  useEffect(() => {
    if (!loading && normalizedCode) {
      fetchTimeline();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minutePeriod]);

  // 合并轮询：行情 + 分时（优化：从 2s/3s 分别轮询改为统一 5s 轮询，减少请求次数）
  const fetchRealtimeData = useCallback(async () => {
    await Promise.all([fetchQuote(), fetchTimeline()]);
  }, [fetchQuote, fetchTimeline]);

  usePolling(fetchRealtimeData, { interval: 5000, enabled: !loading });

  // 轮询资金（优化：从 10s 改为 30s）
  usePolling(fetchFundData, { interval: 30000, enabled: !loading });

  // 切换自选
  const handleToggleWatchlist = () => {
    if (inWatchlist) {
      removeFromWatchlist(normalizedCode);
      toast.success('已从自选移除');
    } else {
      addToWatchlist(normalizedCode);
      toast.success('已加入自选');
    }
    setInWatchlist(!inWatchlist);
  };

  // 分时图配置
  const timelineChartOption = useMemo(() => {
    // 分时图（1分钟）
    if (minutePeriod === '1') {
      if (!timeline?.data?.length) return {};

      const times = timeline.data.map((d) => d.time);
      const prices = timeline.data.map((d) => d.price);
      const avgPrices = timeline.data.map((d) => d.avgPrice);

      const prevClose = quote?.prevClose ?? prices[0];
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const range = Math.max(maxPrice - prevClose, prevClose - minPrice) * 1.1;

      return {
        animation: false,
        grid: {
          left: 60,
          right: 20,
          top: 20,
          bottom: 30,
        },
        xAxis: {
          type: 'category',
          data: times,
          axisLine: { lineStyle: { color: '#30363d' } },
          axisLabel: { color: '#6e7681', fontSize: 10 },
          splitLine: { show: false },
        },
        yAxis: {
          type: 'value',
          min: prevClose - range,
          max: prevClose + range,
          axisLine: { show: false },
          axisLabel: { 
            color: '#6e7681', 
            fontSize: 10,
            formatter: (v: number) => v.toFixed(2),
          },
          splitLine: { lineStyle: { color: '#21262d', type: 'dashed' } },
        },
        series: [
          {
            name: '价格',
            type: 'line',
            data: prices,
            symbol: 'none',
            lineStyle: { width: 1.5, color: '#58a6ff' },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(88, 166, 255, 0.3)' },
                  { offset: 1, color: 'rgba(88, 166, 255, 0)' },
                ],
              },
            },
          },
          {
            name: '均价',
            type: 'line',
            data: avgPrices,
            symbol: 'none',
            lineStyle: { width: 1, color: '#3b82f6', type: 'dashed' },
          },
        ],
        tooltip: {
          trigger: 'axis',
          backgroundColor: '#1c2128',
          borderColor: '#30363d',
          textStyle: { color: '#e6edf3', fontSize: 12 },
        },
      };
    }

    // 分钟K线（5/15/30/60分钟）
    if (!minuteKline.length) return {};

    const times = minuteKline.map((d) => d.time);
    const ohlc = minuteKline.map((d) => [d.open, d.close, d.low, d.high]);

    const riseColor = window.getComputedStyle(document.documentElement).getPropertyValue('--color-rise').trim() || '#ef4444';
    const fallColor = window.getComputedStyle(document.documentElement).getPropertyValue('--color-fall').trim() || '#22c55e';

    return {
      animation: false,
      grid: {
        left: 60,
        right: 20,
        top: 20,
        bottom: 30,
      },
      xAxis: {
        type: 'category',
        data: times,
        axisLine: { lineStyle: { color: '#30363d' } },
        axisLabel: { color: '#6e7681', fontSize: 10 },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLine: { show: false },
        axisLabel: { 
          color: '#6e7681', 
          fontSize: 10,
          formatter: (v: number) => v.toFixed(2),
        },
        splitLine: { lineStyle: { color: '#21262d', type: 'dashed' } },
      },
      series: [
        {
          name: `${minutePeriod}分K`,
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
        backgroundColor: '#1c2128',
        borderColor: '#30363d',
        textStyle: { color: '#e6edf3', fontSize: 12 },
        formatter: (params: unknown[]) => {
          const p = params[0] as { name: string; data: number[] };
          if (!p?.data) return '';
          const [open, close, low, high] = p.data;
          return `
            <div style="font-size: 12px;">
              <div style="margin-bottom: 4px;">${p.name}</div>
              <div>开: ${open?.toFixed(2) || '-'}</div>
              <div>收: ${close?.toFixed(2) || '-'}</div>
              <div>高: ${high?.toFixed(2) || '-'}</div>
              <div>低: ${low?.toFixed(2) || '-'}</div>
            </div>
          `;
        },
      },
    };
  }, [minutePeriod, timeline, quote?.prevClose, minuteKline]);

  // K线图配置
  const klineChartOption = useMemo(() => {
    if (!klineData.length) return {};

    const dates = klineData.map((d) => d.date || d.time);
    const ohlc = klineData.map((d) => [d.open, d.close, d.low, d.high]);
    const volumes = klineData.map((d) => ({
      value: d.volume,
      itemStyle: { color: d.close >= d.open ? '#ef4444' : '#22c55e' },
    }));

    // 计算默认显示范围：最后60根K线
    const dataLen = klineData.length;
    const defaultShowCount = 60;
    const startPercent = dataLen > defaultShowCount 
      ? Math.max(0, ((dataLen - defaultShowCount) / dataLen) * 100)
      : 0;

    const grids: unknown[] = [
      { left: 70, right: 30, top: 45, height: '50%' },
      { left: 70, right: 30, bottom: 50, height: '12%' },
    ];
    const xAxisArr: unknown[] = [
      {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: '#30363d' } },
        axisLabel: { show: false },
        splitLine: { show: false },
      },
      {
        type: 'category',
        data: dates,
        gridIndex: 1,
        axisLine: { lineStyle: { color: '#30363d' } },
        axisLabel: { color: '#6e7681', fontSize: 10 },
        splitLine: { show: false },
      },
    ];
    const yAxisArr: unknown[] = [
      {
        type: 'value',
        scale: true,
        axisLine: { show: false },
        axisLabel: { color: '#6e7681', fontSize: 10 },
        splitLine: { lineStyle: { color: '#21262d', type: 'dashed' } },
      },
      {
        type: 'value',
        gridIndex: 1,
        axisLine: { show: false },
        axisLabel: { show: false },
        splitLine: { show: false },
      },
    ];

    const series: unknown[] = [
      {
        name: 'K线',
        type: 'candlestick',
        data: ohlc,
        itemStyle: {
          color: '#ef4444',
          color0: '#22c55e',
          borderColor: '#ef4444',
          borderColor0: '#22c55e',
        },
      },
    ];

    // MA 线
    if (selectedIndicators.includes('ma')) {
      const maColors = ['#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6'];
      ['ma5', 'ma10', 'ma20', 'ma60'].forEach((maKey, idx) => {
        const maData = klineData.map((d) => {
          const maObj = d.ma as Record<string, number> | undefined;
          return maObj?.[maKey] ?? null;
        });
        series.push({
          name: maKey.toUpperCase(),
          type: 'line',
          data: maData,
          symbol: 'none',
          lineStyle: { width: 1, color: maColors[idx] },
        });
      });
    }

    // MACD 指标（需要单独的区域）
    if (selectedIndicators.includes('macd')) {
      // 添加 MACD 区域
      grids.push({ left: 70, right: 30, bottom: 50, height: '10%' });
      // 更新成交量区域位置
      grids[1] = { left: 70, right: 30, top: '66%', height: '8%' };
      grids[2] = { left: 70, right: 30, bottom: 50, height: '10%' };
      
      xAxisArr.push({
        type: 'category',
        data: dates,
        gridIndex: 2,
        axisLine: { lineStyle: { color: '#30363d' } },
        axisLabel: { show: false },
        splitLine: { show: false },
      });
      
      yAxisArr.push({
        type: 'value',
        gridIndex: 2,
        axisLine: { show: false },
        axisLabel: { color: '#6e7681', fontSize: 9 },
        splitLine: { show: false },
      });

      // MACD 柱状图
      const macdBars = klineData.map((d) => {
        const macdObj = d.macd as { dif?: number; dea?: number; macd?: number } | undefined;
        const val = macdObj?.macd ?? 0;
        return {
          value: val,
          itemStyle: { color: val >= 0 ? '#ef4444' : '#22c55e' },
        };
      });
      
      // DIF 线
      const difData = klineData.map((d) => {
        const macdObj = d.macd as { dif?: number; dea?: number; macd?: number } | undefined;
        return macdObj?.dif ?? null;
      });
      
      // DEA 线
      const deaData = klineData.map((d) => {
        const macdObj = d.macd as { dif?: number; dea?: number; macd?: number } | undefined;
        return macdObj?.dea ?? null;
      });

      series.push(
        {
          name: 'MACD',
          type: 'bar',
          xAxisIndex: 2,
          yAxisIndex: 2,
          data: macdBars,
          barWidth: '60%',
        },
        {
          name: 'DIF',
          type: 'line',
          xAxisIndex: 2,
          yAxisIndex: 2,
          data: difData,
          symbol: 'none',
          lineStyle: { width: 1, color: '#f59e0b' },
        },
        {
          name: 'DEA',
          type: 'line',
          xAxisIndex: 2,
          yAxisIndex: 2,
          data: deaData,
          symbol: 'none',
          lineStyle: { width: 1, color: '#3b82f6' },
        }
      );
    }

    // BOLL 指标（布林带，叠加在K线图上）
    if (selectedIndicators.includes('boll')) {
      const upperData = klineData.map((d) => {
        const bollObj = d.boll as { upper?: number; mid?: number; lower?: number } | undefined;
        return bollObj?.upper ?? null;
      });
      const midData = klineData.map((d) => {
        const bollObj = d.boll as { upper?: number; mid?: number; lower?: number } | undefined;
        return bollObj?.mid ?? null;
      });
      const lowerData = klineData.map((d) => {
        const bollObj = d.boll as { upper?: number; mid?: number; lower?: number } | undefined;
        return bollObj?.lower ?? null;
      });

      series.push(
        {
          name: 'BOLL上轨',
          type: 'line',
          data: upperData,
          symbol: 'none',
          lineStyle: { width: 1, color: '#f59e0b', type: 'dashed' },
        },
        {
          name: 'BOLL中轨',
          type: 'line',
          data: midData,
          symbol: 'none',
          lineStyle: { width: 1, color: '#8b5cf6' },
        },
        {
          name: 'BOLL下轨',
          type: 'line',
          data: lowerData,
          symbol: 'none',
          lineStyle: { width: 1, color: '#f59e0b', type: 'dashed' },
        }
      );
    }

    // KDJ 指标（需要单独区域）
    if (selectedIndicators.includes('kdj')) {
      const kdjGridIndex = grids.length;
      grids.push({ left: 70, right: 30, bottom: 50, height: '10%' });
      
      xAxisArr.push({
        type: 'category',
        data: dates,
        gridIndex: kdjGridIndex,
        axisLine: { lineStyle: { color: '#30363d' } },
        axisLabel: { show: false },
        splitLine: { show: false },
      });
      
      yAxisArr.push({
        type: 'value',
        gridIndex: kdjGridIndex,
        axisLine: { show: false },
        axisLabel: { color: '#6e7681', fontSize: 9 },
        splitLine: { show: false },
        min: 0,
        max: 100,
      });

      const kData = klineData.map((d) => {
        const kdjObj = d.kdj as { k?: number; d?: number; j?: number } | undefined;
        return kdjObj?.k ?? null;
      });
      const dData = klineData.map((d) => {
        const kdjObj = d.kdj as { k?: number; d?: number; j?: number } | undefined;
        return kdjObj?.d ?? null;
      });
      const jData = klineData.map((d) => {
        const kdjObj = d.kdj as { k?: number; d?: number; j?: number } | undefined;
        return kdjObj?.j ?? null;
      });

      series.push(
        {
          name: 'K',
          type: 'line',
          xAxisIndex: kdjGridIndex,
          yAxisIndex: kdjGridIndex,
          data: kData,
          symbol: 'none',
          lineStyle: { width: 1, color: '#f59e0b' },
        },
        {
          name: 'D',
          type: 'line',
          xAxisIndex: kdjGridIndex,
          yAxisIndex: kdjGridIndex,
          data: dData,
          symbol: 'none',
          lineStyle: { width: 1, color: '#3b82f6' },
        },
        {
          name: 'J',
          type: 'line',
          xAxisIndex: kdjGridIndex,
          yAxisIndex: kdjGridIndex,
          data: jData,
          symbol: 'none',
          lineStyle: { width: 1, color: '#ec4899' },
        }
      );
    }

    // RSI 指标（需要单独区域）
    if (selectedIndicators.includes('rsi')) {
      const rsiGridIndex = grids.length;
      grids.push({ left: 70, right: 30, bottom: 50, height: '10%' });
      
      xAxisArr.push({
        type: 'category',
        data: dates,
        gridIndex: rsiGridIndex,
        axisLine: { lineStyle: { color: '#30363d' } },
        axisLabel: { show: false },
        splitLine: { show: false },
      });
      
      yAxisArr.push({
        type: 'value',
        gridIndex: rsiGridIndex,
        axisLine: { show: false },
        axisLabel: { color: '#6e7681', fontSize: 9 },
        splitLine: { show: false },
        min: 0,
        max: 100,
      });

      const rsi6Data = klineData.map((d) => {
        const rsiObj = d.rsi as { rsi6?: number; rsi12?: number; rsi24?: number } | undefined;
        return rsiObj?.rsi6 ?? null;
      });
      const rsi12Data = klineData.map((d) => {
        const rsiObj = d.rsi as { rsi6?: number; rsi12?: number; rsi24?: number } | undefined;
        return rsiObj?.rsi12 ?? null;
      });
      const rsi24Data = klineData.map((d) => {
        const rsiObj = d.rsi as { rsi6?: number; rsi12?: number; rsi24?: number } | undefined;
        return rsiObj?.rsi24 ?? null;
      });

      series.push(
        {
          name: 'RSI6',
          type: 'line',
          xAxisIndex: rsiGridIndex,
          yAxisIndex: rsiGridIndex,
          data: rsi6Data,
          symbol: 'none',
          lineStyle: { width: 1, color: '#f59e0b' },
        },
        {
          name: 'RSI12',
          type: 'line',
          xAxisIndex: rsiGridIndex,
          yAxisIndex: rsiGridIndex,
          data: rsi12Data,
          symbol: 'none',
          lineStyle: { width: 1, color: '#3b82f6' },
        },
        {
          name: 'RSI24',
          type: 'line',
          xAxisIndex: rsiGridIndex,
          yAxisIndex: rsiGridIndex,
          data: rsi24Data,
          symbol: 'none',
          lineStyle: { width: 1, color: '#ec4899' },
        }
      );
    }

    // 成交量
    series.push({
      name: '成交量',
      type: 'bar',
      xAxisIndex: 1,
      yAxisIndex: 1,
      data: volumes,
    });

    // 计算 dataZoom 需要联动的 xAxis 索引
    const xAxisIndexes = xAxisArr.map((_, i) => i);

    // 获取最新一条数据用于显示指标数值
    const latestData = klineData[klineData.length - 1];
    const latestMa = latestData?.ma as Record<string, number> | undefined;
    const latestMacd = latestData?.macd as { dif?: number; dea?: number; macd?: number } | undefined;
    const latestBoll = latestData?.boll as { upper?: number; mid?: number; lower?: number } | undefined;
    const latestKdj = latestData?.kdj as { k?: number; d?: number; j?: number } | undefined;
    const latestRsi = latestData?.rsi as { rsi6?: number; rsi12?: number; rsi24?: number } | undefined;

    // 构建顶部指标文字
    const indicatorTexts: { text: string; color: string }[] = [];
    
    // 添加均线标题
    indicatorTexts.push({ text: '均线', color: '#8b949e' });
    
    if (selectedIndicators.includes('ma') && latestMa) {
      const maColors = ['#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6'];
      ['ma5', 'ma10', 'ma20', 'ma60'].forEach((key, idx) => {
        const val = latestMa[key];
        if (val !== undefined && val !== null) {
          indicatorTexts.push({
            text: `${key.toUpperCase()}:${val.toFixed(2)}`,
            color: maColors[idx],
          });
        }
      });
    }

    // 添加 BOLL 数值
    if (selectedIndicators.includes('boll') && latestBoll) {
      indicatorTexts.push({ text: '|', color: '#30363d' });
      indicatorTexts.push({ text: `BOLL上:${latestBoll.upper?.toFixed(2) ?? '-'}`, color: '#f59e0b' });
      indicatorTexts.push({ text: `中:${latestBoll.mid?.toFixed(2) ?? '-'}`, color: '#8b5cf6' });
      indicatorTexts.push({ text: `下:${latestBoll.lower?.toFixed(2) ?? '-'}`, color: '#f59e0b' });
    }

    // 构建图表顶部的 graphic 元素
    const graphicElements: unknown[] = [];
    if (indicatorTexts.length > 0) {
      let xPos = 80;
      indicatorTexts.forEach((item) => {
        graphicElements.push({
          type: 'text',
          left: xPos,
          top: 8,
          style: {
            text: item.text,
            fill: item.color,
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
          },
        });
        xPos += item.text.length * 7 + 10;
      });
    }

    // 成交量区域的标题
    const volumeLatest = latestData?.volume;
    graphicElements.push({
      type: 'text',
      left: 80,
      top: '64%',
      style: {
        text: `成交量 ${volumeLatest ? (volumeLatest / 10000).toFixed(2) + '万手' : '-'}`,
        fill: '#8b949e',
        fontSize: 10,
      },
    });
    
    // MACD 区域的标题
    if (selectedIndicators.includes('macd') && latestMacd) {
      graphicElements.push({
        type: 'text',
        left: 80,
        top: '78%',
        style: {
          text: `MACD(12,26,9) DIF:${latestMacd.dif?.toFixed(2) ?? '-'} DEA:${latestMacd.dea?.toFixed(2) ?? '-'} MACD:${latestMacd.macd?.toFixed(2) ?? '-'}`,
          fill: '#8b949e',
          fontSize: 10,
        },
      });
    }

    // KDJ 区域的标题
    if (selectedIndicators.includes('kdj') && latestKdj) {
      graphicElements.push({
        type: 'text',
        left: 80,
        top: '88%',
        style: {
          text: `KDJ(9,3,3) K:${latestKdj.k?.toFixed(2) ?? '-'} D:${latestKdj.d?.toFixed(2) ?? '-'} J:${latestKdj.j?.toFixed(2) ?? '-'}`,
          fill: '#8b949e',
          fontSize: 10,
        },
      });
    }

    // RSI 区域的标题
    if (selectedIndicators.includes('rsi') && latestRsi) {
      graphicElements.push({
        type: 'text',
        left: 80,
        top: selectedIndicators.includes('kdj') ? '94%' : '88%',
        style: {
          text: `RSI RSI6:${latestRsi.rsi6?.toFixed(2) ?? '-'} RSI12:${latestRsi.rsi12?.toFixed(2) ?? '-'} RSI24:${latestRsi.rsi24?.toFixed(2) ?? '-'}`,
          fill: '#8b949e',
          fontSize: 10,
        },
      });
    }

    return {
      animation: false,
      graphic: graphicElements,
      grid: grids,
      xAxis: xAxisArr,
      yAxis: yAxisArr,
      series,
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1c2128',
        borderColor: '#30363d',
        textStyle: { color: '#e6edf3', fontSize: 12 },
        formatter: (params: unknown[]) => {
          if (!params || !Array.isArray(params) || params.length === 0) return '';
          
          const firstParam = params[0] as { axisValue?: string; dataIndex?: number };
          const date = firstParam.axisValue || '';
          const dataIndex = firstParam.dataIndex ?? 0;
          const currentData = klineData[dataIndex];
          
          if (!currentData) return '';

          let html = `<div style="font-weight:500;margin-bottom:8px;">${date}</div>`;
          
          // K线数据
          const klineParam = params.find((p: unknown) => (p as { seriesName?: string }).seriesName === 'K线') as { data?: number[] } | undefined;
          if (klineParam?.data) {
            const [open, close, low, high] = klineParam.data;
            const changeColor = close >= open ? '#ef4444' : '#22c55e';
            html += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">`;
            html += `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${changeColor}"></span>`;
            html += `<span>K线</span></div>`;
            html += `<div style="padding-left:14px;line-height:1.6;">`;
            html += `<div><span style="color:#8b949e;">开:</span> <span style="color:${changeColor}">${open?.toFixed(2)}</span></div>`;
            html += `<div><span style="color:#8b949e;">收:</span> <span style="color:${changeColor}">${close?.toFixed(2)}</span></div>`;
            html += `<div><span style="color:#8b949e;">低:</span> <span style="color:${changeColor}">${low?.toFixed(2)}</span></div>`;
            html += `<div><span style="color:#8b949e;">高:</span> <span style="color:${changeColor}">${high?.toFixed(2)}</span></div>`;
            html += `</div>`;
          }

          // MA 数据
          const maData = currentData.ma as Record<string, number> | undefined;
          if (selectedIndicators.includes('ma') && maData) {
            const maColors = ['#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6'];
            ['ma5', 'ma10', 'ma20', 'ma60'].forEach((key, idx) => {
              const val = maData[key];
              if (val !== undefined && val !== null) {
                html += `<div style="display:flex;align-items:center;gap:6px;">`;
                html += `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${maColors[idx]}"></span>`;
                html += `<span>${key.toUpperCase()}</span>`;
                html += `<span style="margin-left:auto;">${val.toFixed(2)}</span>`;
                html += `</div>`;
              }
            });
          }

          // BOLL 数据
          const bollData = currentData.boll as { upper?: number; mid?: number; lower?: number } | undefined;
          if (selectedIndicators.includes('boll') && bollData) {
            html += `<div style="margin-top:4px;border-top:1px solid #30363d;padding-top:4px;">`;
            html += `<div style="color:#8b949e;font-size:11px;">BOLL(20,2)</div>`;
            html += `<div>上轨: ${bollData.upper?.toFixed(2) ?? '-'}</div>`;
            html += `<div>中轨: ${bollData.mid?.toFixed(2) ?? '-'}</div>`;
            html += `<div>下轨: ${bollData.lower?.toFixed(2) ?? '-'}</div>`;
            html += `</div>`;
          }

          // MACD 数据
          const macdData = currentData.macd as { dif?: number; dea?: number; macd?: number } | undefined;
          if (selectedIndicators.includes('macd') && macdData) {
            html += `<div style="margin-top:4px;border-top:1px solid #30363d;padding-top:4px;">`;
            html += `<div style="color:#8b949e;font-size:11px;">MACD(12,26,9)</div>`;
            html += `<div><span style="color:#f59e0b;">DIF:</span> ${macdData.dif?.toFixed(2) ?? '-'}</div>`;
            html += `<div><span style="color:#3b82f6;">DEA:</span> ${macdData.dea?.toFixed(2) ?? '-'}</div>`;
            html += `<div><span style="color:${(macdData.macd ?? 0) >= 0 ? '#ef4444' : '#22c55e'};">MACD:</span> ${macdData.macd?.toFixed(2) ?? '-'}</div>`;
            html += `</div>`;
          }

          // KDJ 数据
          const kdjData = currentData.kdj as { k?: number; d?: number; j?: number } | undefined;
          if (selectedIndicators.includes('kdj') && kdjData) {
            html += `<div style="margin-top:4px;border-top:1px solid #30363d;padding-top:4px;">`;
            html += `<div style="color:#8b949e;font-size:11px;">KDJ(9,3,3)</div>`;
            html += `<div><span style="color:#f59e0b;">K:</span> ${kdjData.k?.toFixed(2) ?? '-'}</div>`;
            html += `<div><span style="color:#3b82f6;">D:</span> ${kdjData.d?.toFixed(2) ?? '-'}</div>`;
            html += `<div><span style="color:#ec4899;">J:</span> ${kdjData.j?.toFixed(2) ?? '-'}</div>`;
            html += `</div>`;
          }

          // RSI 数据
          const rsiData = currentData.rsi as { rsi6?: number; rsi12?: number; rsi24?: number } | undefined;
          if (selectedIndicators.includes('rsi') && rsiData) {
            html += `<div style="margin-top:4px;border-top:1px solid #30363d;padding-top:4px;">`;
            html += `<div style="color:#8b949e;font-size:11px;">RSI</div>`;
            html += `<div><span style="color:#f59e0b;">RSI6:</span> ${rsiData.rsi6?.toFixed(2) ?? '-'}</div>`;
            html += `<div><span style="color:#3b82f6;">RSI12:</span> ${rsiData.rsi12?.toFixed(2) ?? '-'}</div>`;
            html += `<div><span style="color:#ec4899;">RSI24:</span> ${rsiData.rsi24?.toFixed(2) ?? '-'}</div>`;
            html += `</div>`;
          }

          // 成交量
          if (currentData.volume) {
            html += `<div style="margin-top:4px;border-top:1px solid #30363d;padding-top:4px;">`;
            html += `<div>成交量: ${(currentData.volume / 10000).toFixed(2)}万手</div>`;
            html += `</div>`;
          }

          return html;
        },
      },
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: xAxisIndexes,
          start: startPercent,
          end: 100,
        },
        {
          type: 'slider',
          xAxisIndex: xAxisIndexes,
          start: startPercent,
          end: 100,
          height: 20,
          bottom: 10,
          borderColor: '#30363d',
          backgroundColor: '#21262d',
          fillerColor: 'rgba(88, 166, 255, 0.2)',
          handleStyle: { color: '#58a6ff' },
          textStyle: { color: '#6e7681', fontSize: 10 },
        },
      ],
    };
  }, [klineData, selectedIndicators]);

  if (loading) {
    return <Loading fullScreen text="加载中..." />;
  }

  if (!quote) {
    return (
      <div className={styles.notFound}>
        <p>未找到股票 {code}</p>
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

        <div className={styles.stockHeader}>
          <div className={styles.stockTitle}>
            <h1 className={styles.stockName}>{quote.name}</h1>
            <span className={styles.stockCode}>{quote.code}</span>
          </div>
          <div className={styles.priceSection}>
            <span className={`${styles.price} ${getChangeColorClass(quote.changePercent)}`}>
              {formatPrice(quote.price)}
            </span>
            <div className={styles.changeInfo}>
              <span className={getChangeColorClass(quote.changePercent)}>
                {formatChange(quote.change)}
              </span>
              <span className={getChangeColorClass(quote.changePercent)}>
                {formatPercent(quote.changePercent)}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <Button
            variant={inWatchlist ? 'primary' : 'secondary'}
            icon={inWatchlist ? <Star size={16} /> : <StarOff size={16} />}
            onClick={handleToggleWatchlist}
          >
            {inWatchlist ? '已自选' : '加自选'}
          </Button>
        </div>
      </motion.header>

      {/* 行情摘要 */}
      <Card padding="md">
        <div className={styles.quoteGrid}>
          <div className={styles.quoteItem}>
            <span className={styles.quoteLabel}>今开</span>
            <span className={styles.quoteValue}>{formatPrice(quote.open)}</span>
          </div>
          <div className={styles.quoteItem}>
            <span className={styles.quoteLabel}>昨收</span>
            <span className={styles.quoteValue}>{formatPrice(quote.prevClose)}</span>
          </div>
          <div className={styles.quoteItem}>
            <span className={styles.quoteLabel}>最高</span>
            <span className={`${styles.quoteValue} text-rise`}>{formatPrice(quote.high)}</span>
          </div>
          <div className={styles.quoteItem}>
            <span className={styles.quoteLabel}>最低</span>
            <span className={`${styles.quoteValue} text-fall`}>{formatPrice(quote.low)}</span>
          </div>
          <div className={styles.quoteItem}>
            <span className={styles.quoteLabel}>成交量</span>
            <span className={styles.quoteValue}>{formatVolume(quote.volume)}</span>
          </div>
          <div className={styles.quoteItem}>
            <span className={styles.quoteLabel}>成交额</span>
            <span className={styles.quoteValue}>{formatAmount(quote.amount)}</span>
          </div>
          <div className={styles.quoteItem}>
            <span className={styles.quoteLabel}>换手率</span>
            <span className={styles.quoteValue}>{formatTurnover(quote.turnoverRate)}</span>
          </div>
          <div className={styles.quoteItem}>
            <span className={styles.quoteLabel}>量比</span>
            <span className={styles.quoteValue}>{formatVolumeRatio(quote.volumeRatio)}</span>
          </div>
          <div className={styles.quoteItem}>
            <span className={styles.quoteLabel}>市盈率</span>
            <span className={styles.quoteValue}>{formatRatio(quote.pe)}</span>
          </div>
          <div className={styles.quoteItem}>
            <span className={styles.quoteLabel}>市净率</span>
            <span className={styles.quoteValue}>{formatRatio(quote.pb)}</span>
          </div>
          <div className={styles.quoteItem}>
            <span className={styles.quoteLabel}>总市值</span>
            <span className={styles.quoteValue}>{formatMarketCap(quote.totalMarketCap)}</span>
          </div>
          <div className={styles.quoteItem}>
            <span className={styles.quoteLabel}>流通市值</span>
            <span className={styles.quoteValue}>{formatMarketCap(quote.circulatingMarketCap)}</span>
          </div>
        </div>
      </Card>

      <div className={styles.mainGrid}>
        {/* 左侧：图表 */}
        <div className={styles.chartSection}>
          {/* 分时/分钟线 */}
          <Card
            title="走势"
            extra={
              <Tabs
                items={MINUTE_PERIODS}
                activeKey={minutePeriod}
                onChange={setMinutePeriod}
                size="sm"
              />
            }
          >
            <div className={styles.chartContainer}>
              <ReactECharts
                option={timelineChartOption}
                style={{ height: '100%', width: '100%' }}
                notMerge
              />
            </div>
          </Card>

          {/* K线 */}
          <Card
            title="K线"
            extra={
              <div className={styles.klineControls}>
                <Tabs
                  items={KLINE_PERIODS}
                  activeKey={klinePeriod}
                  onChange={setKlinePeriod}
                  size="sm"
                />
                <div className={styles.indicatorTags}>
                  {INDICATOR_OPTIONS.map((ind) => (
                    <button
                      key={ind.key}
                      className={`${styles.indicatorTag} ${selectedIndicators.includes(ind.key) ? styles.active : ''}`}
                      onClick={() => {
                        setSelectedIndicators((prev) =>
                          prev.includes(ind.key)
                            ? prev.filter((i) => i !== ind.key)
                            : [...prev, ind.key]
                        );
                      }}
                    >
                      {ind.label}
                    </button>
                  ))}
                </div>
              </div>
            }
          >
            <div className={styles.chartContainerLarge}>
              <ReactECharts
                option={klineChartOption}
                style={{ height: '100%', width: '100%' }}
                notMerge
              />
            </div>
          </Card>
        </div>

        {/* 右侧：盘口+资金 */}
        <div className={styles.sideSection}>
          {/* 五档盘口 */}
          <Card title="五档盘口">
            <div className={styles.orderBook}>
              {/* 卖盘 */}
              <div className={styles.askSide}>
                {[...Array(5)].map((_, i) => {
                  const ask = quote.ask?.[4 - i];
                  return (
                    <div key={`ask-${i}`} className={styles.orderRow}>
                      <span className={styles.orderLabel}>卖{5 - i}</span>
                      <span className={`${styles.orderPrice} text-fall`}>
                        {formatPrice(ask?.price)}
                      </span>
                      <span className={styles.orderVolume}>
                        {ask?.volume ?? '--'}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* 买盘 */}
              <div className={styles.bidSide}>
                {quote.bid?.slice(0, 5).map((bid, i) => (
                  <div key={`bid-${i}`} className={styles.orderRow}>
                    <span className={styles.orderLabel}>买{i + 1}</span>
                    <span className={`${styles.orderPrice} text-rise`}>
                      {formatPrice(bid?.price)}
                    </span>
                    <span className={styles.orderVolume}>{bid?.volume ?? '--'}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* 资金流向 */}
          {fundFlow && (
            <Card title="资金流向">
              <div className={styles.fundFlow}>
                <div className={styles.fundItem}>
                  <span className={styles.fundLabel}>主力净流入</span>
                  <span className={`${styles.fundValue} ${getChangeColorClass(fundFlow.mainNet)}`}>
                    {formatAmount(fundFlow.mainNet / 10000)}
                  </span>
                </div>
                <div className={styles.fundItem}>
                  <span className={styles.fundLabel}>主力净占比</span>
                  <span className={`${styles.fundValue} ${getChangeColorClass(fundFlow.mainNetRatio)}`}>
                    {formatPercent(fundFlow.mainNetRatio)}
                  </span>
                </div>
                <div className={styles.fundItem}>
                  <span className={styles.fundLabel}>散户净流入</span>
                  <span className={`${styles.fundValue} ${getChangeColorClass(fundFlow.retailNet)}`}>
                    {formatAmount(fundFlow.retailNet / 10000)}
                  </span>
                </div>
              </div>
            </Card>
          )}

          {/* 大单结构 */}
          {largeOrder && (
            <Card title="大单结构">
              <div className={styles.largeOrder}>
                <div className={styles.orderBar}>
                  <div
                    className={styles.buyLarge}
                    style={{ width: `${largeOrder.buyLargeRatio}%` }}
                  />
                  <div
                    className={styles.buySmall}
                    style={{ width: `${largeOrder.buySmallRatio}%` }}
                  />
                  <div
                    className={styles.sellSmall}
                    style={{ width: `${largeOrder.sellSmallRatio}%` }}
                  />
                  <div
                    className={styles.sellLarge}
                    style={{ width: `${largeOrder.sellLargeRatio}%` }}
                  />
                </div>
                <div className={styles.orderLegend}>
                  <span className={styles.legendItem}>
                    <i className={styles.buyLargeDot} />
                    大买 {largeOrder.buyLargeRatio.toFixed(1)}%
                  </span>
                  <span className={styles.legendItem}>
                    <i className={styles.buySmallDot} />
                    小买 {largeOrder.buySmallRatio.toFixed(1)}%
                  </span>
                  <span className={styles.legendItem}>
                    <i className={styles.sellSmallDot} />
                    小卖 {largeOrder.sellSmallRatio.toFixed(1)}%
                  </span>
                  <span className={styles.legendItem}>
                    <i className={styles.sellLargeDot} />
                    大卖 {largeOrder.sellLargeRatio.toFixed(1)}%
                  </span>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
