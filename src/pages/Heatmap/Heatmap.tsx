/**
 * 热力图页面
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Grid3X3, Building2, Lightbulb, Star } from 'lucide-react';
import { Tabs, Loading } from '@/components/common';
import { usePolling, useTheme } from '@/hooks';
import { useBoardData, useAppSettings } from '@/contexts';
import { getAllQuotesByCodes, getIndustryConstituents } from '@/services/sdk';
import { selectAllCodes, watchlistStore } from '@/services/watchlistStore';
import { formatPercent, formatAmount } from '@/utils/format';
import type { FullQuote } from 'stock-sdk';
import type { HeatmapConfig } from '@/types';
import { LazyEChart } from '@/components/charts/LazyEChart';
import { getChartColors, withAlpha, type ChartColors } from '@/components/charts/chartTheme';
import styles from './Heatmap.module.css';

// 维度选项
const DIMENSION_OPTIONS = [
  { key: 'industry', label: '行业', icon: <Building2 size={14} /> },
  { key: 'concept', label: '概念', icon: <Lightbulb size={14} /> },
  // 暂时注释掉个股入口，待功能完善后启用
  // { key: 'stock', label: '个股', icon: <TrendingUp size={14} /> },
  { key: 'watchlist', label: '自选', icon: <Star size={14} /> },
];

// 颜色指标选项
const COLOR_FIELD_OPTIONS = [
  { key: 'changePercent', label: '涨跌幅' },
  { key: 'turnoverRate', label: '换手率' },
  { key: 'volumeRatio', label: '量比' },
];

// 面积指标选项
const SIZE_FIELD_OPTIONS = [
  { key: 'totalMarketCap', label: '总市值' },
  { key: 'amount', label: '成交额' },
];

const TOP_K_OPTIONS = [
  { key: '50', label: 'Top 50' },
  { key: '100', label: 'Top 100' },
  { key: '200', label: 'Top 200' },
];

interface HeatmapItem {
  changePercent?: number | null;
  turnoverRate?: number | null;
  volumeRatio?: number | null;
  totalMarketCap?: number | null;
  amount?: number | null;
}

// 获取颜色值（根据 colorField 配置）
function getColorValue(item: HeatmapItem, field: HeatmapConfig['colorField']) {
  switch (field) {
    case 'turnoverRate':
      return item.turnoverRate ?? 0;
    case 'volumeRatio':
      return item.volumeRatio ?? 1;
    case 'changePercent':
    default:
      return item.changePercent ?? 0;
  }
}

// 获取大小值（根据 sizeField 配置）
function getSizeValue(item: HeatmapItem, field: HeatmapConfig['sizeField']) {
  switch (field) {
    case 'amount':
      return item.amount ?? 1;
    case 'totalMarketCap':
    default:
      return item.totalMarketCap ?? 1;
  }
}

// 根据值获取颜色
function getTileColor(
  value: number,
  field: HeatmapConfig['colorField'],
  colors: ChartColors,
  minAlpha: number
) {
  const alphaFor = (intensity: number) => minAlpha + intensity * (1 - minAlpha);

  // 对于涨跌幅，正负值有不同颜色
  if (field === 'changePercent') {
    if (value === 0) return colors.flat;
    const intensity = Math.min(Math.abs(value) / 10, 1);
    return withAlpha(value > 0 ? colors.rise : colors.fall, alphaFor(intensity));
  }

  // 对于换手率和量比，只使用单色渐变（值越大颜色越深）
  const maxValue = field === 'turnoverRate' ? 20 : 5; // 换手率最大20%，量比最大5
  return withAlpha(colors.rise, alphaFor(Math.min(value / maxValue, 1)));
}

export function Heatmap() {
  const navigate = useNavigate();
  const { settings, updateSettings, getRefreshInterval } = useAppSettings();
  const { theme } = useTheme();

  // 使用共享的板块数据（优化：避免重复请求）
  const { industryList, conceptList, loading: boardLoading } = useBoardData();

  const config = settings.heatmapConfig;
  const colorMode = settings.colorMode;

  // tooltip 与瓦片同一套涨跌配色，跟随 colorMode
  const chartColors = useMemo(() => getChartColors(theme, colorMode), [theme, colorMode]);
  const minAlpha = theme === 'light' ? 0.55 : 0.3;

  // 个股数据状态
  const [stockQuotes, setStockQuotes] = useState<FullQuote[]>([]);

  // 更新配置
  const updateConfig = (updates: Partial<HeatmapConfig>) => {
    updateSettings({
      heatmapConfig: {
        ...config,
        ...updates,
      },
    });
  };

  // 加载个股数据（只在自选或个股模式时调用）
  const fetchStockData = useCallback(async () => {
    if (config.dimension !== 'stock' && config.dimension !== 'watchlist') return;

    try {
      if (config.dimension === 'watchlist') {
        const codes = selectAllCodes(watchlistStore.getSnapshot());
        if (codes.length > 0) {
          const quotes = await getAllQuotesByCodes(codes.slice(0, config.topK));
          setStockQuotes(quotes);
        } else {
          setStockQuotes([]);
        }
      } else {
        // 个股模式：从行业板块的成分股中获取
        const allStocks: FullQuote[] = [];

        // 获取前3个行业的成分股
        const topIndustries = industryList.slice(0, 3);
        for (const industry of topIndustries) {
          try {
            const constituents = await getIndustryConstituents(industry.code);
            const stockCodes = constituents.slice(0, 10).map((c) => c.code);
            if (stockCodes.length > 0) {
              const quotes = await getAllQuotesByCodes(stockCodes);
              allStocks.push(...quotes);
            }
          } catch {
            console.error(`Failed to fetch constituents for ${industry.code}`);
          }
        }

        // 去重并限制数量
        const uniqueStocks = Array.from(
          new Map(allStocks.map((s) => [s.code, s])).values()
        ).slice(0, config.topK);

        setStockQuotes(uniqueStocks);
      }
    } catch (error) {
      console.error('Fetch stock data error:', error);
    }
  }, [config.dimension, config.topK, industryList]);

  const isStockDimension = config.dimension === 'stock' || config.dimension === 'watchlist';

  // 轮询个股数据（板块数据由全局 Context 管理，无需轮询）
  const stockPollingEnabled = !boardLoading && isStockDimension;
  const { refresh: refreshStockData } = usePolling(fetchStockData, {
    interval: getRefreshInterval('heatmap'),
    enabled: stockPollingEnabled,
  });

  const stockQueryKey = `${config.dimension}:${config.topK}`;
  const lastStockQueryRef = useRef({ key: stockQueryKey, enabled: stockPollingEnabled });
  useEffect(() => {
    const last = lastStockQueryRef.current;
    lastStockQueryRef.current = { key: stockQueryKey, enabled: stockPollingEnabled };
    if (last.enabled && stockPollingEnabled && last.key !== stockQueryKey) {
      refreshStockData();
    }
  }, [stockQueryKey, stockPollingEnabled, refreshStockData]);

  // 兼容旧逻辑的 loading 状态
  const loading = boardLoading;

  // 板块数据没有 amount/volumeRatio 字段，选中会静默退化成全同色/同面积，按维度过滤掉
  const isBoardDimension = config.dimension === 'industry' || config.dimension === 'concept';
  const colorFieldOptions = isBoardDimension
    ? COLOR_FIELD_OPTIONS.filter((option) => option.key !== 'volumeRatio')
    : COLOR_FIELD_OPTIONS;
  const sizeFieldOptions = isBoardDimension
    ? SIZE_FIELD_OPTIONS.filter((option) => option.key !== 'amount')
    : SIZE_FIELD_OPTIONS;
  const effectiveColorField =
    isBoardDimension && config.colorField === 'volumeRatio'
      ? 'changePercent'
      : config.colorField;
  const effectiveSizeField =
    isBoardDimension && config.sizeField === 'amount'
      ? 'totalMarketCap'
      : config.sizeField;

  // 构建 Treemap 数据
  const treemapData = useMemo(() => {
    const tileColor = (item: HeatmapItem) =>
      getTileColor(getColorValue(item, effectiveColorField), effectiveColorField, chartColors, minAlpha);

    if (config.dimension === 'industry') {
      return industryList.map((item) => ({
        name: item.name || '未知',
        value: getSizeValue(item, effectiveSizeField),
        code: item.code,
        changePercent: item.changePercent,
        turnoverRate: item.turnoverRate,
        riseCount: item.riseCount,
        fallCount: item.fallCount,
        leadingStock: item.leadingStock,
        leadingStockChangePercent: item.leadingStockChangePercent,
        itemStyle: {
          color: tileColor(item),
        },
      }));
    }

    if (config.dimension === 'concept') {
      return conceptList.map((item) => ({
        name: item.name || '未知',
        value: getSizeValue(item, effectiveSizeField),
        code: item.code,
        changePercent: item.changePercent,
        turnoverRate: item.turnoverRate,
        riseCount: item.riseCount,
        fallCount: item.fallCount,
        leadingStock: item.leadingStock,
        leadingStockChangePercent: item.leadingStockChangePercent,
        itemStyle: {
          color: tileColor(item),
        },
      }));
    }

    if (config.dimension === 'stock' || config.dimension === 'watchlist') {
      return stockQuotes.map((item) => ({
        name: item.name || '未知',
        value: getSizeValue(item, effectiveSizeField),
        code: item.code,
        changePercent: item.changePercent,
        price: item.price,
        amount: item.amount,
        turnoverRate: item.turnoverRate,
        itemStyle: {
          color: tileColor(item),
        },
      }));
    }

    return [];
  }, [
    config.dimension,
    industryList,
    conceptList,
    stockQuotes,
    effectiveColorField,
    effectiveSizeField,
    chartColors,
    minAlpha,
  ]);

  // Treemap 配置
  const chartOption = useMemo(() => {
    const { rise, fall, flat, bgElevated, bgCard, borderPrimary, textPrimary, textTertiary, accent } =
      chartColors;

    return {
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: bgElevated,
        borderColor: borderPrimary,
        borderWidth: 1,
        padding: [10, 14],
        textStyle: { color: textPrimary, fontSize: 12 },
        extraCssText: 'box-shadow: 0 8px 24px rgba(0,0,0,0.25); border-radius: 8px;',
        formatter: (params: { data: Record<string, unknown> }) => {
          const data = params.data;
          if (!data || !data.name) return '';

          let content = `<div style="font-weight:600;font-size:13px;margin-bottom:6px;color:${textPrimary};">${data.name}</div>`;

          if (data.changePercent !== undefined && data.changePercent !== null) {
            const changePercent = data.changePercent as number;
            const color = changePercent > 0 ? rise : changePercent < 0 ? fall : flat;
            content += `<div style="display:flex;justify-content:space-between;gap:16px;"><span style="color:${textTertiary}">涨跌幅</span><span style="color:${color};font-weight:500">${formatPercent(changePercent)}</span></div>`;
          }

          if (data.turnoverRate !== undefined && data.turnoverRate !== null) {
            content += `<div style="display:flex;justify-content:space-between;gap:16px;margin-top:2px;"><span style="color:${textTertiary}">换手率</span><span>${(data.turnoverRate as number).toFixed(2)}%</span></div>`;
          }

          if (data.leadingStock) {
            const leadingChange = data.leadingStockChangePercent as number | null;
            const leadingColor = leadingChange != null && leadingChange > 0 ? rise : leadingChange != null && leadingChange < 0 ? fall : flat;
            content += `<div style="margin-top:8px;padding-top:8px;border-top:1px solid ${borderPrimary};"><span style="color:${textTertiary};font-size:11px">领涨</span><div style="margin-top:2px;display:flex;justify-content:space-between;"><span>${data.leadingStock}</span><span style="color:${leadingColor}">${leadingChange != null ? formatPercent(leadingChange) : ''}</span></div></div>`;
          }

          if (data.riseCount !== undefined && data.riseCount !== null) {
            content += `<div style="margin-top:6px;font-size:11px;color:${textTertiary}"><span style="color:${rise}">${data.riseCount}↑</span> <span style="color:${fall}">${data.fallCount ?? 0}↓</span></div>`;
          }

          if (data.price !== undefined && data.price !== null) {
            content += `<div style="display:flex;justify-content:space-between;gap:16px;margin-top:2px;"><span style="color:${textTertiary}">现价</span><span>${(data.price as number).toFixed(2)}</span></div>`;
            if (data.amount !== undefined && data.amount !== null) {
              content += `<div style="display:flex;justify-content:space-between;gap:16px;margin-top:2px;"><span style="color:${textTertiary}">成交额</span><span>${formatAmount(data.amount as number)}</span></div>`;
            }
          }

          return content;
        },
      },
      series: [
        {
          type: 'treemap',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          roam: false,
          nodeClick: 'link',
          breadcrumb: { show: false },
          label: {
            show: true,
            formatter: (params: { data: Record<string, unknown> }) => {
              const data = params.data;
              if (!data || !data.name) return '';
              const change = data.changePercent as number;
              const changeStr = change !== undefined && change !== null ? formatPercent(change) : '';
              return `{name|${data.name}}\n{change|${changeStr}}`;
            },
            rich: {
              name: {
                fontSize: 13,
                color: '#fff',
                fontWeight: 600,
                textShadowColor: 'rgba(0,0,0,0.5)',
                textShadowBlur: 2,
              },
              change: {
                fontSize: 12,
                color: 'rgba(255,255,255,0.9)',
                padding: [3, 0, 0, 0],
                textShadowColor: 'rgba(0,0,0,0.5)',
                textShadowBlur: 2,
              },
            },
          },
          itemStyle: {
            borderColor: bgCard,
            borderWidth: 1,
            gapWidth: 1,
          },
          emphasis: {
            itemStyle: {
              borderColor: accent,
              borderWidth: 2,
            },
            label: {
              show: true,
            },
          },
          levels: [
            {
              itemStyle: {
                borderColor: bgCard,
                borderWidth: 1,
                gapWidth: 1,
              },
            },
          ],
          data: treemapData,
        },
      ],
    };
  }, [treemapData, chartColors]);

  // 点击处理
  const handleChartClick = (params: { data?: { code?: string } }) => {
    const data = params.data;
    if (!data?.code) return;

    if (config.dimension === 'industry') {
      navigate(`/boards/industry/${data.code}`);
    } else if (config.dimension === 'concept') {
      navigate(`/boards/concept/${data.code}`);
    } else {
      navigate(`/s/${data.code}`);
    }
  };

  if (loading) {
    return <Loading fullScreen text="加载热力图数据..." />;
  }

  return (
    <div className={styles.heatmap}>
      {/* 控制栏 */}
      <motion.div
        className={styles.controls}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <div className={styles.controlGroup}>
          <Tabs
            items={DIMENSION_OPTIONS}
            activeKey={config.dimension}
            onChange={(key) => updateConfig({ dimension: key as HeatmapConfig['dimension'] })}
            size="sm"
          />
        </div>

        <div className={styles.controlGroup}>
          <span className={styles.controlLabel}>颜色</span>
          <Tabs
            items={colorFieldOptions}
            activeKey={effectiveColorField}
            onChange={(key) => updateConfig({ colorField: key as HeatmapConfig['colorField'] })}
            size="sm"
          />
        </div>

        <div className={styles.controlGroup}>
          <span className={styles.controlLabel}>面积</span>
          <Tabs
            items={sizeFieldOptions}
            activeKey={effectiveSizeField}
            onChange={(key) => updateConfig({ sizeField: key as HeatmapConfig['sizeField'] })}
            size="sm"
          />
        </div>

        <div className={styles.controlGroup}>
          <button
            className={`${styles.colorModeBtn} ${colorMode === 'red-rise' ? styles.active : ''}`}
            onClick={() => updateSettings({ colorMode: colorMode === 'red-rise' ? 'green-rise' : 'red-rise' })}
          >
            {colorMode === 'red-rise' ? '红涨绿跌' : '绿涨红跌'}
          </button>
        </div>

        <div className={styles.controlGroup}>
          <span className={styles.controlLabel}>范围</span>
          <Tabs
            items={TOP_K_OPTIONS}
            activeKey={String(config.topK)}
            onChange={(key) => updateConfig({ topK: Number(key) })}
            size="sm"
          />
        </div>
      </motion.div>

      {/* 热力图 */}
      <div className={styles.chartCard}>
        <div className={styles.chartWrapper}>
          {treemapData.length > 0 ? (
            <LazyEChart
              option={chartOption}
              style={{ height: '100%', width: '100%' }}
              onEvents={{ click: handleChartClick }}
              notMerge
            />
          ) : (
            <div className={styles.emptyState}>
              <Grid3X3 size={48} strokeWidth={1} />
              <p>暂无数据</p>
            </div>
          )}
        </div>
      </div>

      {/* 图例 */}
      <div className={styles.legend}>
        <div className={styles.legendBar}>
          <span className={styles.legendLabel}>跌</span>
          <div className={styles.legendGradient} />
          <span className={styles.legendLabel}>涨</span>
        </div>
      </div>
    </div>
  );
}
