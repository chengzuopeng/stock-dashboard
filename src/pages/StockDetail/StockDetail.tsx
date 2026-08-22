/**
 * 个股详情页
 */

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Star, StarOff, Bell, Trash2 } from 'lucide-react';
import type {
  DividendDetail,
  FundFlow,
  FullQuote,
  HistoryKline,
  PanelLargeOrder,
  TodayTimelineResponse,
} from 'stock-sdk';
import { LazyEChart } from '@/components/charts/LazyEChart';
import { getChartColors, type ChartColors } from '@/components/charts/chartTheme';
import { Button, Card, Loading, Tabs, useToast } from '@/components/common';
import { useAppSettings } from '@/contexts';
import { useAlertRules, useIsInWatchlist, usePolling, useTheme } from '@/hooks';
import {
  getDividendDetail,
  getFullQuotes,
  getFundFlow,
  getIndividualFundFlow,
  getKlineWithIndicators,
  getMinuteKline,
  getNorthboundIndividual,
  getPanelLargeOrder,
  getTodayTimeline,
} from '@/services/sdk';
import { watchlistActions } from '@/services/watchlistStore';
import type { AlertType, KlinePeriod } from '@/types';
import type { IndicatorConfig } from '@/types';
import {
  formatAmount,
  formatChange,
  formatCompactNumber,
  formatMarketCap,
  formatPercent,
  formatPrice,
  formatRatio,
  formatTurnover,
  formatVolume,
  formatVolumeRatio,
  formatYuanAmount,
  getChangeColorClass,
  normalizeStockCode,
  toYmd,
} from '@/utils/format';
import styles from './StockDetail.module.css';

type IndividualFundFlowRows = Awaited<ReturnType<typeof getIndividualFundFlow>>;
type NorthboundIndividualRows = Awaited<ReturnType<typeof getNorthboundIndividual>>;

const KLINE_PERIODS = [
  { key: 'daily', label: '日K' },
  { key: 'weekly', label: '周K' },
  { key: 'monthly', label: '月K' },
];

const KLINE_WINDOW_YEARS: Record<KlinePeriod, number | null> = {
  daily: 3,
  weekly: 10,
  monthly: null,
};

function getKlineStartDate(period: KlinePeriod): string | undefined {
  const years = KLINE_WINDOW_YEARS[period];
  if (years === null) return undefined;
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return toYmd(date);
}

const MINUTE_PERIODS = [
  { key: '1', label: '分时' },
  { key: '5', label: '5分' },
  { key: '15', label: '15分' },
  { key: '30', label: '30分' },
  { key: '60', label: '60分' },
];

const OVERLAY_OPTIONS = [
  { key: 'ma', label: 'MA' },
  { key: 'boll', label: 'BOLL' },
  { key: 'sar', label: 'SAR' },
  { key: 'kc', label: 'KC' },
] as const;

const OSCILLATOR_OPTIONS = [
  { key: 'macd', label: 'MACD' },
  { key: 'kdj', label: 'KDJ' },
  { key: 'rsi', label: 'RSI' },
  { key: 'obv', label: 'OBV' },
  { key: 'roc', label: 'ROC' },
  { key: 'dmi', label: 'DMI-ADX' },
] as const;

const ALERT_TYPE_OPTIONS: Array<{ key: AlertType; label: string }> = [
  { key: 'price_gte', label: '价格 >= ' },
  { key: 'price_lte', label: '价格 <= ' },
  { key: 'change_percent_gte', label: '涨幅 >= ' },
  { key: 'change_percent_lte', label: '涨幅 <= ' },
  { key: 'amount_gte', label: '成交额 >= ' },
];

type OverlayIndicatorKey = (typeof OVERLAY_OPTIONS)[number]['key'];
type OscillatorIndicatorKey = (typeof OSCILLATOR_OPTIONS)[number]['key'];

interface MinuteKlineItem {
  time: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

interface KlineDataItem extends HistoryKline {
  ma?: Record<string, number>;
  macd?: { dif?: number; dea?: number; macd?: number };
  boll?: { upper?: number; mid?: number; lower?: number };
  kdj?: { k?: number; d?: number; j?: number };
  rsi?: Record<string, number>;
  obv?: { obv: number | null; obvMa: number | null };
  roc?: { roc: number | null; signal: number | null };
  dmi?: { pdi: number | null; mdi: number | null; adx: number | null };
  sar?: { sar: number | null; trend: 1 | -1 | null };
  kc?: { upper: number | null; mid: number | null; lower: number | null };
}

function formatMaybeDate(value: string | null | undefined) {
  return value || '--';
}

function formatYield(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--';
  }

  return `${value.toFixed(2)}%`;
}

function buildTimelineOption(args: {
  minutePeriod: string;
  timeline: TodayTimelineResponse | null;
  minuteKline: MinuteKlineItem[];
  prevClose: number | undefined;
  colors: ChartColors;
}) {
  const { minutePeriod, timeline, minuteKline, prevClose, colors } = args;

  if (minutePeriod === '1') {
    if (!timeline?.data?.length) {
      return {};
    }

    const times = timeline.data.map((item) => item.time);
    const prices = timeline.data.map((item) => item.price);
    const avgPrices = timeline.data.map((item) => item.avgPrice);
    const basePrice = prevClose ?? prices[0];
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = Math.max(maxPrice - basePrice, basePrice - minPrice) * 1.1;

    return {
      animation: false,
      grid: { left: 60, right: 20, top: 20, bottom: 30 },
      xAxis: {
        type: 'category',
        data: times,
        axisLine: { lineStyle: { color: colors.borderPrimary } },
        axisLabel: { color: colors.textTertiary, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        min: basePrice - range,
        max: basePrice + range,
        axisLine: { show: false },
        axisLabel: {
          color: colors.textTertiary,
          fontSize: 10,
          formatter: (value: number) => value.toFixed(2),
        },
        splitLine: { lineStyle: { color: colors.borderSecondary, type: 'dashed' } },
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
                { offset: 0, color: 'rgba(88, 166, 255, 0.28)' },
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
        backgroundColor: colors.bgElevated,
        borderColor: colors.borderPrimary,
        textStyle: { color: colors.textPrimary, fontSize: 12 },
      },
    };
  }

  if (!minuteKline.length) {
    return {};
  }

  const times = minuteKline.map((item) => item.time);
  const ohlc = minuteKline.map((item) => [item.open, item.close, item.low, item.high]);

  return {
    animation: false,
    grid: { left: 60, right: 20, top: 20, bottom: 30 },
    xAxis: {
      type: 'category',
      data: times,
      axisLine: { lineStyle: { color: colors.borderPrimary } },
      axisLabel: { color: colors.textTertiary, fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLine: { show: false },
      axisLabel: {
        color: colors.textTertiary,
        fontSize: 10,
        formatter: (value: number) => value.toFixed(2),
      },
      splitLine: { lineStyle: { color: colors.borderSecondary, type: 'dashed' } },
    },
    series: [
      {
        name: `${minutePeriod}分K`,
        type: 'candlestick',
        data: ohlc,
        itemStyle: {
          color: colors.rise,
          color0: colors.fall,
          borderColor: colors.rise,
          borderColor0: colors.fall,
        },
      },
    ],
    tooltip: {
      trigger: 'axis',
      backgroundColor: colors.bgElevated,
      borderColor: colors.borderPrimary,
      textStyle: { color: colors.textPrimary, fontSize: 12 },
    },
  };
}

function buildKlineOption(args: {
  data: KlineDataItem[];
  overlays: OverlayIndicatorKey[];
  oscillator: OscillatorIndicatorKey;
  indicatorConfig: IndicatorConfig;
  colors: ChartColors;
}) {
  const { data, overlays, oscillator, indicatorConfig, colors } = args;

  if (!data.length) {
    return {};
  }

  const dates = data.map((item) => item.date);
  const ohlc = data.map((item) => [
    item.open ?? 0,
    item.close ?? 0,
    item.low ?? 0,
    item.high ?? 0,
  ]);
  const volumes = data.map((item) => ({
    value: item.volume ?? 0,
    itemStyle: {
      color: (item.close ?? 0) >= (item.open ?? 0) ? colors.rise : colors.fall,
    },
  }));

  const startPercent =
    data.length > 60 ? Math.max(0, ((data.length - 60) / data.length) * 100) : 0;

  const series: unknown[] = [
    {
      name: 'K线',
      type: 'candlestick',
      data: ohlc,
      itemStyle: {
        color: colors.rise,
        color0: colors.fall,
        borderColor: colors.rise,
        borderColor0: colors.fall,
      },
    },
    {
      name: '成交量',
      type: 'bar',
      xAxisIndex: 1,
      yAxisIndex: 1,
      data: volumes,
    },
  ];

  if (overlays.includes('ma')) {
    const maColors = ['#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316'];
    indicatorConfig.ma.forEach((period, index) => {
      series.push({
        name: `MA${period}`,
        type: 'line',
        data: data.map((item) => item.ma?.[`ma${period}`] ?? null),
        symbol: 'none',
        lineStyle: { width: 1, color: maColors[index % maColors.length] },
      });
    });
  }

  if (overlays.includes('boll')) {
    series.push(
      {
        name: 'BOLL上轨',
        type: 'line',
        data: data.map((item) => item.boll?.upper ?? null),
        symbol: 'none',
        lineStyle: { width: 1, color: '#f59e0b', type: 'dashed' },
      },
      {
        name: 'BOLL中轨',
        type: 'line',
        data: data.map((item) => item.boll?.mid ?? null),
        symbol: 'none',
        lineStyle: { width: 1, color: '#8b5cf6' },
      },
      {
        name: 'BOLL下轨',
        type: 'line',
        data: data.map((item) => item.boll?.lower ?? null),
        symbol: 'none',
        lineStyle: { width: 1, color: '#f59e0b', type: 'dashed' },
      }
    );
  }

  if (overlays.includes('sar')) {
    series.push({
      name: 'SAR',
      type: 'scatter',
      data: data.map((item) => item.sar?.sar ?? null),
      symbolSize: 5,
      itemStyle: { color: '#22d3ee' },
    });
  }

  if (overlays.includes('kc')) {
    series.push(
      {
        name: 'KC上轨',
        type: 'line',
        data: data.map((item) => item.kc?.upper ?? null),
        symbol: 'none',
        lineStyle: { width: 1, color: '#10b981' },
      },
      {
        name: 'KC中轨',
        type: 'line',
        data: data.map((item) => item.kc?.mid ?? null),
        symbol: 'none',
        lineStyle: { width: 1, color: '#06b6d4' },
      },
      {
        name: 'KC下轨',
        type: 'line',
        data: data.map((item) => item.kc?.lower ?? null),
        symbol: 'none',
        lineStyle: { width: 1, color: '#10b981' },
      }
    );
  }

  switch (oscillator) {
    case 'kdj':
      series.push(
        {
          name: 'K',
          type: 'line',
          xAxisIndex: 2,
          yAxisIndex: 2,
          data: data.map((item) => item.kdj?.k ?? null),
          symbol: 'none',
          lineStyle: { width: 1, color: '#f59e0b' },
        },
        {
          name: 'D',
          type: 'line',
          xAxisIndex: 2,
          yAxisIndex: 2,
          data: data.map((item) => item.kdj?.d ?? null),
          symbol: 'none',
          lineStyle: { width: 1, color: '#3b82f6' },
        },
        {
          name: 'J',
          type: 'line',
          xAxisIndex: 2,
          yAxisIndex: 2,
          data: data.map((item) => item.kdj?.j ?? null),
          symbol: 'none',
          lineStyle: { width: 1, color: '#ec4899' },
        }
      );
      break;
    case 'rsi':
      indicatorConfig.rsi.forEach((period, index) => {
        const colors = ['#f59e0b', '#3b82f6', '#ec4899', '#14b8a6'];
        series.push({
          name: `RSI${period}`,
          type: 'line',
          xAxisIndex: 2,
          yAxisIndex: 2,
          data: data.map((item) => item.rsi?.[`rsi${period}`] ?? null),
          symbol: 'none',
          lineStyle: { width: 1, color: colors[index % colors.length] },
        });
      });
      break;
    case 'obv':
      series.push(
        {
          name: 'OBV',
          type: 'line',
          xAxisIndex: 2,
          yAxisIndex: 2,
          data: data.map((item) => item.obv?.obv ?? null),
          symbol: 'none',
          lineStyle: { width: 1, color: '#60a5fa' },
        },
        {
          name: 'OBV MA',
          type: 'line',
          xAxisIndex: 2,
          yAxisIndex: 2,
          data: data.map((item) => item.obv?.obvMa ?? null),
          symbol: 'none',
          lineStyle: { width: 1, color: '#f59e0b' },
        }
      );
      break;
    case 'roc':
      series.push(
        {
          name: 'ROC',
          type: 'line',
          xAxisIndex: 2,
          yAxisIndex: 2,
          data: data.map((item) => item.roc?.roc ?? null),
          symbol: 'none',
          lineStyle: { width: 1, color: colors.fall },
        },
        {
          name: 'ROC Signal',
          type: 'line',
          xAxisIndex: 2,
          yAxisIndex: 2,
          data: data.map((item) => item.roc?.signal ?? null),
          symbol: 'none',
          lineStyle: { width: 1, color: '#f59e0b' },
        }
      );
      break;
    case 'dmi':
      series.push(
        {
          name: '+DI',
          type: 'line',
          xAxisIndex: 2,
          yAxisIndex: 2,
          data: data.map((item) => item.dmi?.pdi ?? null),
          symbol: 'none',
          lineStyle: { width: 1, color: colors.fall },
        },
        {
          name: '-DI',
          type: 'line',
          xAxisIndex: 2,
          yAxisIndex: 2,
          data: data.map((item) => item.dmi?.mdi ?? null),
          symbol: 'none',
          lineStyle: { width: 1, color: colors.rise },
        },
        {
          name: 'ADX',
          type: 'line',
          xAxisIndex: 2,
          yAxisIndex: 2,
          data: data.map((item) => item.dmi?.adx ?? null),
          symbol: 'none',
          lineStyle: { width: 1, color: '#3b82f6' },
        }
      );
      break;
    case 'macd':
    default:
      series.push(
        {
          name: 'MACD',
          type: 'bar',
          xAxisIndex: 2,
          yAxisIndex: 2,
          data: data.map((item) => ({
            value: item.macd?.macd ?? 0,
            itemStyle: { color: (item.macd?.macd ?? 0) >= 0 ? colors.rise : colors.fall },
          })),
        },
        {
          name: 'DIF',
          type: 'line',
          xAxisIndex: 2,
          yAxisIndex: 2,
          data: data.map((item) => item.macd?.dif ?? null),
          symbol: 'none',
          lineStyle: { width: 1, color: '#f59e0b' },
        },
        {
          name: 'DEA',
          type: 'line',
          xAxisIndex: 2,
          yAxisIndex: 2,
          data: data.map((item) => item.macd?.dea ?? null),
          symbol: 'none',
          lineStyle: { width: 1, color: '#3b82f6' },
        }
      );
      break;
  }

  const latest = data[data.length - 1];
  const oscillatorSummary =
    oscillator === 'macd'
      ? `MACD ${latest.macd?.dif?.toFixed(2) ?? '-'} / ${latest.macd?.dea?.toFixed(2) ?? '-'}`
      : oscillator === 'kdj'
        ? `KDJ ${latest.kdj?.k?.toFixed(2) ?? '-'} / ${latest.kdj?.d?.toFixed(2) ?? '-'} / ${latest.kdj?.j?.toFixed(2) ?? '-'}`
        : oscillator === 'rsi'
          ? `RSI ${indicatorConfig.rsi
              .map((period) => `${period}:${latest.rsi?.[`rsi${period}`]?.toFixed(2) ?? '-'}`)
              .join(' ')}`
          : oscillator === 'obv'
            ? `OBV ${latest.obv?.obv?.toFixed(0) ?? '-'}`
            : oscillator === 'roc'
              ? `ROC ${latest.roc?.roc?.toFixed(2) ?? '-'}`
              : `DMI ${latest.dmi?.pdi?.toFixed(2) ?? '-'} / ${latest.dmi?.mdi?.toFixed(2) ?? '-'} / ${latest.dmi?.adx?.toFixed(2) ?? '-'}`;

  return {
    animation: false,
    grid: [
      { left: 70, right: 30, top: 42, height: '40%' },
      { left: 70, right: 30, top: '62%', height: '10%' },
      { left: 70, right: 30, top: '78%', height: '12%' },
    ],
    graphic: [
      {
        type: 'text',
        left: 80,
        top: 10,
        style: {
          text: oscillatorSummary,
          fill: colors.textTertiary,
          fontSize: 11,
        },
      },
    ],
    xAxis: [
      {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: colors.borderPrimary } },
        axisLabel: { show: false },
      },
      {
        type: 'category',
        gridIndex: 1,
        data: dates,
        axisLine: { lineStyle: { color: colors.borderPrimary } },
        axisLabel: { show: false },
      },
      {
        type: 'category',
        gridIndex: 2,
        data: dates,
        axisLine: { lineStyle: { color: colors.borderPrimary } },
        axisLabel: { color: colors.textTertiary, fontSize: 10 },
      },
    ],
    yAxis: [
      {
        type: 'value',
        scale: true,
        axisLine: { show: false },
        axisLabel: { color: colors.textTertiary, fontSize: 10 },
        splitLine: { lineStyle: { color: colors.borderSecondary, type: 'dashed' } },
      },
      {
        type: 'value',
        gridIndex: 1,
        axisLine: { show: false },
        axisLabel: { show: false },
        splitLine: { show: false },
      },
      {
        type: 'value',
        gridIndex: 2,
        axisLine: { show: false },
        axisLabel: { color: colors.textTertiary, fontSize: 9 },
        splitLine: { show: false },
      },
    ],
    series,
    tooltip: {
      trigger: 'axis',
      backgroundColor: colors.bgElevated,
      borderColor: colors.borderPrimary,
      textStyle: { color: colors.textPrimary, fontSize: 12 },
      formatter: (params: unknown[]) => {
        if (!Array.isArray(params) || params.length === 0) {
          return '';
        }

        const firstParam = params[0] as { axisValue?: string; dataIndex?: number };
        const dataIndex = firstParam.dataIndex ?? 0;
        const item = data[dataIndex];

        if (!item) {
          return '';
        }

        const overlayTexts: string[] = [];

        if (overlays.includes('ma')) {
          overlayTexts.push(
            ...indicatorConfig.ma.map(
              (period) => `MA${period}: ${item.ma?.[`ma${period}`]?.toFixed(2) ?? '--'}`
            )
          );
        }

        if (overlays.includes('boll')) {
          overlayTexts.push(
            `BOLL: ${item.boll?.upper?.toFixed(2) ?? '--'} / ${item.boll?.mid?.toFixed(2) ?? '--'} / ${item.boll?.lower?.toFixed(2) ?? '--'}`
          );
        }

        if (overlays.includes('sar')) {
          overlayTexts.push(`SAR: ${item.sar?.sar?.toFixed(2) ?? '--'}`);
        }

        if (overlays.includes('kc')) {
          overlayTexts.push(
            `KC: ${item.kc?.upper?.toFixed(2) ?? '--'} / ${item.kc?.mid?.toFixed(2) ?? '--'} / ${item.kc?.lower?.toFixed(2) ?? '--'}`
          );
        }

        let oscillatorText = '';
        switch (oscillator) {
          case 'kdj':
            oscillatorText = `KDJ: ${item.kdj?.k?.toFixed(2) ?? '--'} / ${item.kdj?.d?.toFixed(2) ?? '--'} / ${item.kdj?.j?.toFixed(2) ?? '--'}`;
            break;
          case 'rsi':
            oscillatorText = indicatorConfig.rsi
              .map((period) => `RSI${period}: ${item.rsi?.[`rsi${period}`]?.toFixed(2) ?? '--'}`)
              .join('<br/>');
            break;
          case 'obv':
            oscillatorText = `OBV: ${item.obv?.obv?.toFixed(0) ?? '--'} / MA: ${item.obv?.obvMa?.toFixed(0) ?? '--'}`;
            break;
          case 'roc':
            oscillatorText = `ROC: ${item.roc?.roc?.toFixed(2) ?? '--'} / Signal: ${item.roc?.signal?.toFixed(2) ?? '--'}`;
            break;
          case 'dmi':
            oscillatorText = `+DI: ${item.dmi?.pdi?.toFixed(2) ?? '--'}<br/>-DI: ${item.dmi?.mdi?.toFixed(2) ?? '--'}<br/>ADX: ${item.dmi?.adx?.toFixed(2) ?? '--'}`;
            break;
          case 'macd':
          default:
            oscillatorText = `DIF: ${item.macd?.dif?.toFixed(2) ?? '--'} / DEA: ${item.macd?.dea?.toFixed(2) ?? '--'} / MACD: ${item.macd?.macd?.toFixed(2) ?? '--'}`;
            break;
        }

        return `
          <div style="font-weight:500;margin-bottom:8px;">${firstParam.axisValue ?? ''}</div>
          <div>开: ${(item.open ?? 0).toFixed(2)} 收: ${(item.close ?? 0).toFixed(2)}</div>
          <div>高: ${(item.high ?? 0).toFixed(2)} 低: ${(item.low ?? 0).toFixed(2)}</div>
          <div>量: ${((item.volume ?? 0) / 10000).toFixed(2)}万手</div>
          ${overlayTexts.length > 0 ? `<div style="margin-top:6px;border-top:1px solid ${colors.borderPrimary};padding-top:6px;">${overlayTexts.join('<br/>')}</div>` : ''}
          <div style="margin-top:6px;border-top:1px solid ${colors.borderPrimary};padding-top:6px;">${oscillatorText}</div>
        `;
      },
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1, 2], start: startPercent, end: 100 },
      {
        type: 'slider',
        xAxisIndex: [0, 1, 2],
        start: startPercent,
        end: 100,
        bottom: 10,
        height: 20,
        borderColor: colors.borderPrimary,
        backgroundColor: colors.borderSecondary,
        fillerColor: 'rgba(88, 166, 255, 0.2)',
        handleStyle: { color: '#58a6ff' },
        textStyle: { color: colors.textTertiary, fontSize: 10 },
      },
    ],
  };
}

export function StockDetail() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { settings, getRefreshInterval } = useAppSettings();
  const { theme } = useTheme();
  const chartColors = useMemo(
    () => getChartColors(theme, settings.colorMode),
    [theme, settings.colorMode]
  );
  const normalizedCode = normalizeStockCode(code || '');

  const [quote, setQuote] = useState<FullQuote | null>(null);
  const [timeline, setTimeline] = useState<TodayTimelineResponse | null>(null);
  const [minuteKline, setMinuteKline] = useState<MinuteKlineItem[]>([]);
  const [klineData, setKlineData] = useState<KlineDataItem[]>([]);
  const [fundFlow, setFundFlow] = useState<FundFlow | null>(null);
  const [largeOrder, setLargeOrder] = useState<PanelLargeOrder | null>(null);
  const [individualFundFlowHistory, setIndividualFundFlowHistory] =
    useState<IndividualFundFlowRows>([]);
  const [northboundHoldings, setNorthboundHoldings] =
    useState<NorthboundIndividualRows>([]);
  const [dividends, setDividends] = useState<DividendDetail[]>([]);
  const alerts = useAlertRules(normalizedCode);

  const [loading, setLoading] = useState(true);
  const isInWatchlist = useIsInWatchlist();
  const inWatchlist = isInWatchlist(normalizedCode);
  const [minutePeriod, setMinutePeriod] = useState('1');
  const [klinePeriod, setKlinePeriod] = useState('daily');
  const [selectedOverlays, setSelectedOverlays] = useState<OverlayIndicatorKey[]>(['ma']);
  const [selectedOscillator, setSelectedOscillator] =
    useState<OscillatorIndicatorKey>('macd');
  const [alertType, setAlertType] = useState<AlertType>('price_gte');
  const [alertValue, setAlertValue] = useState('');

  const detailRefreshInterval = getRefreshInterval('detail');
  const fundRefreshInterval = Math.max(detailRefreshInterval * 6, 30000);

  // 每个 alertType 只预填一次：quote 随轮询高频更新，无守卫会持续覆写用户正在输入的阈值
  const prefilledAlertTypeRef = useRef<AlertType | null>(null);

  useEffect(() => {
    if (!quote || prefilledAlertTypeRef.current === alertType) {
      return;
    }
    prefilledAlertTypeRef.current = alertType;

    switch (alertType) {
      case 'change_percent_gte':
      case 'change_percent_lte':
        setAlertValue(String(quote.changePercent.toFixed(2)));
        break;
      case 'amount_gte':
        setAlertValue(String(Math.max(quote.amount, 1).toFixed(2)));
        break;
      case 'price_gte':
      case 'price_lte':
      default:
        setAlertValue(String(quote.price.toFixed(2)));
        break;
    }
  }, [alertType, quote]);

  const fetchQuote = useCallback(async () => {
    if (!normalizedCode) {
      return;
    }

    try {
      const [quoteData] = await getFullQuotes([normalizedCode]);
      if (quoteData) {
        setQuote(quoteData);
      }
    } catch (error) {
      console.error('Fetch quote error:', error);
    }
  }, [normalizedCode]);

  // 周期切换后旧周期的慢响应可能后到，比对最新周期丢弃过期数据
  const minutePeriodRef = useRef(minutePeriod);
  const klinePeriodRef = useRef(klinePeriod);

  useEffect(() => {
    minutePeriodRef.current = minutePeriod;
    klinePeriodRef.current = klinePeriod;
  }, [minutePeriod, klinePeriod]);

  const fetchTimeline = useCallback(async () => {
    if (!normalizedCode) {
      return;
    }

    const requestPeriod = minutePeriod;
    try {
      if (requestPeriod === '1') {
        const data = await getTodayTimeline(normalizedCode);
        if (minutePeriodRef.current !== requestPeriod) return;
        setTimeline(data);
        setMinuteKline([]);
        return;
      }

      const data = await getMinuteKline(normalizedCode, {
        period: requestPeriod as '5' | '15' | '30' | '60',
      });
      if (minutePeriodRef.current !== requestPeriod) return;
      setMinuteKline(data as MinuteKlineItem[]);
      setTimeline(null);
    } catch (error) {
      console.error('Fetch timeline error:', error);
    }
  }, [minutePeriod, normalizedCode]);

  const fetchKline = useCallback(async () => {
    if (!normalizedCode) {
      return;
    }

    const requestPeriod = klinePeriod as KlinePeriod;
    try {
      const data = await getKlineWithIndicators(normalizedCode, {
        period: requestPeriod,
        adjust: 'qfq',
        startDate: getKlineStartDate(requestPeriod),
        indicators: {
          ma: { periods: settings.indicatorConfig.ma },
          macd: settings.indicatorConfig.macd,
          boll: settings.indicatorConfig.boll,
          kdj: settings.indicatorConfig.kdj,
          rsi: { periods: settings.indicatorConfig.rsi },
          obv: { maPeriod: settings.indicatorConfig.ma[1] ?? 10 },
          roc: { period: 12, signalPeriod: 6 },
          dmi: settings.indicatorConfig.dmi,
          sar: settings.indicatorConfig.sar,
          kc: settings.indicatorConfig.kc,
        },
      });
      if (klinePeriodRef.current !== requestPeriod) return;
      setKlineData(data as unknown as KlineDataItem[]);
    } catch (error) {
      console.error('Fetch kline error:', error);
    }
  }, [klinePeriod, normalizedCode, settings.indicatorConfig]);

  const fetchFundData = useCallback(async () => {
    if (!normalizedCode) {
      return;
    }

    try {
      const [
        [flowData],
        [orderData],
        individualFundFlowData,
        northboundHoldingData,
      ] = await Promise.all([
        getFundFlow([normalizedCode]),
        getPanelLargeOrder([normalizedCode]),
        getIndividualFundFlow(normalizedCode, { period: 'daily' }),
        getNorthboundIndividual(normalizedCode),
      ]);

      if (flowData) {
        setFundFlow(flowData);
      }
      if (orderData) {
        setLargeOrder(orderData);
      }

      setIndividualFundFlowHistory(individualFundFlowData.slice(-8));
      setNorthboundHoldings(northboundHoldingData.slice(-8));
    } catch (error) {
      console.error('Fetch fund data error:', error);
    }
  }, [normalizedCode]);

  const fetchDividendData = useCallback(async () => {
    if (!normalizedCode) {
      return;
    }

    try {
      const data = await getDividendDetail(normalizedCode);
      setDividends(data.slice(0, 6));
    } catch (error) {
      console.error('Fetch dividend error:', error);
    }
  }, [normalizedCode]);

  // 整载只跑一次（换股由路由 key 重挂载触发）；周期/指标变化走下面的专属增量 effect，
  // 若把 fetch 回调放进依赖，切个 tab 就会全屏 loading + 五个接口全部重拉
  const loadInitial = useEffectEvent(async () => {
    setLoading(true);
    await Promise.all([
      fetchQuote(),
      fetchTimeline(),
      fetchKline(),
      fetchFundData(),
      fetchDividendData(),
    ]);
    setLoading(false);
  });

  useEffect(() => {
    loadInitial();
  }, [normalizedCode]);

  // 跳过挂载首轮（loadInitial 已拉过），只响应周期/指标配置变化
  const reloadTimeline = useEffectEvent(() => {
    if (!loading) fetchTimeline();
  });

  useEffect(() => {
    reloadTimeline();
  }, [minutePeriod]);

  const reloadKline = useEffectEvent(() => {
    if (!loading) fetchKline();
  });

  useEffect(() => {
    reloadKline();
  }, [klinePeriod, settings.indicatorConfig]);

  usePolling(
    useCallback(async () => {
      await Promise.all([fetchQuote(), fetchTimeline()]);
    }, [fetchQuote, fetchTimeline]),
    {
      interval: detailRefreshInterval,
      enabled: !loading,
      immediate: false,
    }
  );

  usePolling(fetchFundData, {
    interval: fundRefreshInterval,
    enabled: !loading,
    immediate: false,
  });

  const handleToggleWatchlist = useCallback(() => {
    if (inWatchlist) {
      watchlistActions.remove(normalizedCode);
      toast.success('已从自选移除');
    } else {
      watchlistActions.add(normalizedCode);
      toast.success('已加入自选');
    }
  }, [inWatchlist, normalizedCode, toast]);

  const handleAddAlert = useCallback(() => {
    if (!quote) {
      return;
    }

    const value = Number(alertValue);
    // 涨跌幅类阈值合法值域含负数（跌幅告警），只有价格/成交额类才要求正数
    const requiresPositive = !['change_percent_gte', 'change_percent_lte'].includes(alertType);
    if (!Number.isFinite(value) || (requiresPositive && value <= 0)) {
      toast.warning('请输入有效的告警阈值');
      return;
    }

    watchlistActions.addAlert({
      code: normalizedCode,
      name: quote.name,
      type: alertType,
      value,
      cooldownSec: 300,
      enabled: true,
      lastTriggeredAt: 0,
    });
    toast.success('已添加本地告警');
  }, [alertType, alertValue, normalizedCode, quote, toast]);

  const handleDeleteAlert = useCallback(
    (ruleId: string) => {
      watchlistActions.deleteAlert(ruleId);
      toast.success('已删除告警');
    },
    [toast]
  );

  const latestNorthboundHolding = northboundHoldings.at(-1) ?? null;

  const timelineChartOption = useMemo(
    () =>
      buildTimelineOption({
        minutePeriod,
        timeline,
        minuteKline,
        prevClose: quote?.prevClose,
        colors: chartColors,
      }),
    [minuteKline, minutePeriod, quote?.prevClose, timeline, chartColors]
  );

  const klineChartOption = useMemo(
    () =>
      buildKlineOption({
        data: klineData,
        overlays: selectedOverlays,
        oscillator: selectedOscillator,
        indicatorConfig: settings.indicatorConfig,
        colors: chartColors,
      }),
    [klineData, selectedOscillator, selectedOverlays, settings.indicatorConfig, chartColors]
  );

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
        <div className={styles.chartSection}>
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
              <LazyEChart option={timelineChartOption} style={{ height: '100%', width: '100%' }} notMerge />
            </div>
          </Card>

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
                <div className={styles.klineIndicatorPanel}>
                  <div className={styles.indicatorTags}>
                    {OVERLAY_OPTIONS.map((indicator) => (
                      <button
                        key={indicator.key}
                        className={`${styles.indicatorTag} ${selectedOverlays.includes(indicator.key) ? styles.active : ''}`}
                        onClick={() =>
                          setSelectedOverlays((prev) =>
                            prev.includes(indicator.key)
                              ? prev.filter((item) => item !== indicator.key)
                              : [...prev, indicator.key]
                          )
                        }
                      >
                        {indicator.label}
                      </button>
                    ))}
                  </div>
                  <div className={styles.oscillatorTags}>
                    {OSCILLATOR_OPTIONS.map((indicator) => (
                      <button
                        key={indicator.key}
                        className={`${styles.indicatorTag} ${selectedOscillator === indicator.key ? styles.active : ''}`}
                        onClick={() => setSelectedOscillator(indicator.key)}
                      >
                        {indicator.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            }
          >
            <div className={styles.chartContainerLarge}>
              <LazyEChart option={klineChartOption} style={{ height: '100%', width: '100%' }} notMerge />
            </div>
          </Card>
        </div>

        <div className={styles.sideSection}>
          <Card title="五档盘口">
            <div className={styles.orderBook}>
              <div className={styles.askSide}>
                {[...Array(5)].map((_, index) => {
                  const ask = quote.ask?.[4 - index];
                  return (
                    <div key={`ask-${index}`} className={styles.orderRow}>
                      <span className={styles.orderLabel}>卖{5 - index}</span>
                      <span className={`${styles.orderPrice} text-fall`}>
                        {formatPrice(ask?.price)}
                      </span>
                      <span className={styles.orderVolume}>{ask?.volume ?? '--'}</span>
                    </div>
                  );
                })}
              </div>
              <div className={styles.bidSide}>
                {quote.bid?.slice(0, 5).map((bid, index) => (
                  <div key={`bid-${index}`} className={styles.orderRow}>
                    <span className={styles.orderLabel}>买{index + 1}</span>
                    <span className={`${styles.orderPrice} text-rise`}>
                      {formatPrice(bid?.price)}
                    </span>
                    <span className={styles.orderVolume}>{bid?.volume ?? '--'}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {fundFlow && (
            <Card title="个股资金流">
              <div className={styles.fundFlow}>
                <div className={styles.fundItem}>
                  <span className={styles.fundLabel}>主力净流入</span>
                  <span className={`${styles.fundValue} ${getChangeColorClass(fundFlow.mainNet)}`}>
                    {formatAmount(fundFlow.mainNet)}
                  </span>
                </div>
                <div className={styles.fundItem}>
                  <span className={styles.fundLabel}>主力净占比</span>
                  <span
                    className={`${styles.fundValue} ${getChangeColorClass(
                      fundFlow.mainNetRatio
                    )}`}
                  >
                    {formatPercent(fundFlow.mainNetRatio)}
                  </span>
                </div>
                <div className={styles.fundItem}>
                  <span className={styles.fundLabel}>散户净流入</span>
                  <span className={`${styles.fundValue} ${getChangeColorClass(fundFlow.retailNet)}`}>
                    {formatAmount(fundFlow.retailNet)}
                  </span>
                </div>
              </div>

              {individualFundFlowHistory.length > 0 && (
                <div className={styles.historySection}>
                  <div className={styles.historySectionHeader}>近 8 日主力资金</div>
                  <div className={styles.historyList}>
                    {[...individualFundFlowHistory].reverse().map((item) => (
                      <div key={item.date} className={styles.historyRow}>
                        <span className={styles.historyDate}>{formatMaybeDate(item.date)}</span>
                        <div className={styles.historyValueGroup}>
                          <span
                            className={`${styles.historyPrimary} ${getChangeColorClass(
                              item.mainNetInflow
                            )}`}
                          >
                            {formatYuanAmount(item.mainNetInflow)}
                          </span>
                          <span className={styles.historyMeta}>
                            {formatPercent(item.mainNetInflowPercent)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {largeOrder && (
            <Card title="大单结构">
              <div className={styles.largeOrder}>
                <div className={styles.orderBar}>
                  <div className={styles.buyLarge} style={{ width: `${largeOrder.buyLargeRatio}%` }} />
                  <div className={styles.buySmall} style={{ width: `${largeOrder.buySmallRatio}%` }} />
                  <div className={styles.sellSmall} style={{ width: `${largeOrder.sellSmallRatio}%` }} />
                  <div className={styles.sellLarge} style={{ width: `${largeOrder.sellLargeRatio}%` }} />
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

          <Card title="北向持仓">
            {latestNorthboundHolding ? (
              <div className={styles.historySection}>
                <div className={styles.historyList}>
                  <div className={styles.historyRow}>
                    <span className={styles.historyDate}>最新持仓市值</span>
                    <div className={styles.historyValueGroup}>
                      <span className={styles.historyPrimary}>
                        {formatYuanAmount(latestNorthboundHolding.holdMarketValue)}
                      </span>
                      <span className={styles.historyMeta}>
                        {formatMaybeDate(latestNorthboundHolding.date)}
                      </span>
                    </div>
                  </div>
                  <div className={styles.historyRow}>
                    <span className={styles.historyDate}>持股 / 流通占比</span>
                    <div className={styles.historyValueGroup}>
                      <span className={styles.historyPrimary}>
                        {formatCompactNumber(latestNorthboundHolding.holdShares)} 股
                      </span>
                      <span className={styles.historyMeta}>
                        {formatPercent(latestNorthboundHolding.holdRatioFloat, false)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={styles.historySectionHeader}>近 8 日持仓变化</div>
                <div className={styles.historyList}>
                  {[...northboundHoldings].reverse().map((item) => (
                    <div key={item.date} className={styles.historyRow}>
                      <span className={styles.historyDate}>{formatMaybeDate(item.date)}</span>
                      <div className={styles.historyValueGroup}>
                        <span className={styles.historyPrimary}>
                          {formatYuanAmount(item.holdMarketValue)}
                        </span>
                        <span
                          className={`${styles.historyMeta} ${getChangeColorClass(
                            item.changePercent
                          )}`}
                        >
                          {formatPercent(item.changePercent)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className={styles.dividendEmpty}>当前股票暂无北向持仓样本</div>
            )}
          </Card>

          <Card title="分红 / 除权">
            {dividends.length === 0 ? (
              <div className={styles.dividendEmpty}>暂无可展示的分红数据</div>
            ) : (
              <div className={styles.dividendList}>
                {dividends.map((item, index) => (
                  <div key={`${item.reportDate ?? 'unknown'}-${index}`} className={styles.dividendItem}>
                    <div className={styles.dividendHeader}>
                      <span className={styles.dividendReport}>{formatMaybeDate(item.reportDate)}</span>
                      <span className={styles.dividendProgress}>{item.assignProgress || '待披露'}</span>
                    </div>
                    <div className={styles.dividendDesc}>{item.dividendDesc || '暂无派息说明'}</div>
                    <div className={styles.dividendMeta}>
                      <span>股息率 {formatYield(item.dividendYield)}</span>
                      <span>除权 {formatMaybeDate(item.exDividendDate)}</span>
                    </div>
                    <div className={styles.dividendMeta}>
                      <span>公告 {formatMaybeDate(item.noticeDate)}</span>
                      <span>发放 {formatMaybeDate(item.payDate)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="本地告警">
            <div className={styles.alertEditor}>
              <div className={styles.alertInputs}>
                <select
                  className={styles.alertSelect}
                  value={alertType}
                  onChange={(event) => setAlertType(event.target.value as AlertType)}
                >
                  {ALERT_TYPE_OPTIONS.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <input
                  className={styles.alertInput}
                  value={alertValue}
                  onChange={(event) => setAlertValue(event.target.value)}
                  type="number"
                  step="0.01"
                />
              </div>
              <Button variant="secondary" icon={<Bell size={14} />} onClick={handleAddAlert}>
                新增告警
              </Button>
            </div>

            {alerts.length === 0 ? (
              <div className={styles.dividendEmpty}>当前股票暂无本地告警</div>
            ) : (
              <div className={styles.alertList}>
                {alerts.map((rule) => (
                  <div key={rule.id} className={styles.alertItem}>
                    <div className={styles.alertInfo}>
                      <span className={styles.alertLabel}>
                        {ALERT_TYPE_OPTIONS.find((item) => item.key === rule.type)?.label}
                        {rule.value}
                      </span>
                      <span className={styles.alertMeta}>冷却 {rule.cooldownSec}s</span>
                    </div>
                    <button
                      className={styles.alertDelete}
                      onClick={() => handleDeleteAlert(rule.id)}
                    >
                      <Trash2 size={14} />
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
