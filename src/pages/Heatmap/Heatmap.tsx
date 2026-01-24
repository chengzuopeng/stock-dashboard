/**
 * 热力图页面
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { motion } from 'framer-motion';
import { Grid3X3, Building2, Lightbulb, Star } from 'lucide-react';
import { Tabs, Loading } from '@/components/common';
import { usePolling } from '@/hooks';
import { useBoardData } from '@/contexts';
import { getAllQuotesByCodes, getIndustryConstituents } from '@/services/sdk';
import { getAllWatchlistCodes, getHeatmapConfig, saveHeatmapConfig } from '@/services/storage';
import { formatPercent, formatAmount } from '@/utils/format';
import type { FullQuote } from 'stock-sdk';
import type { HeatmapConfig } from '@/types';
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

export function Heatmap() {
  const navigate = useNavigate();
  
  // 使用共享的板块数据（优化：避免重复请求）
  const { industryList, conceptList, loading: boardLoading } = useBoardData();

  // 配置状态
  const [config, setConfig] = useState<HeatmapConfig>(getHeatmapConfig);

  // 个股数据状态
  const [stockQuotes, setStockQuotes] = useState<FullQuote[]>([]);

  // 更新配置
  const updateConfig = (updates: Partial<HeatmapConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    saveHeatmapConfig(newConfig);
  };

  // 加载个股数据（只在自选或个股模式时调用）
  const fetchStockData = useCallback(async () => {
    if (config.dimension !== 'stock' && config.dimension !== 'watchlist') return;

    try {
      if (config.dimension === 'watchlist') {
        const codes = getAllWatchlistCodes();
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

  // 维度变化时加载个股数据
  useEffect(() => {
    if (config.dimension === 'stock' || config.dimension === 'watchlist') {
      fetchStockData();
    }
  }, [config.dimension, fetchStockData]);

  // 轮询个股数据（板块数据由全局 Context 管理，无需轮询）
  usePolling(fetchStockData, {
    interval: 10000,
    enabled: !boardLoading && (config.dimension === 'stock' || config.dimension === 'watchlist'),
  });

  // 兼容旧逻辑的 loading 状态
  const loading = boardLoading;

  // 获取颜色值（根据 colorField 配置）
  const getColorValue = (item: { changePercent?: number | null; turnoverRate?: number | null; volumeRatio?: number | null }) => {
    switch (config.colorField) {
      case 'turnoverRate':
        return item.turnoverRate ?? 0;
      case 'volumeRatio':
        return item.volumeRatio ?? 1;
      case 'changePercent':
      default:
        return item.changePercent ?? 0;
    }
  };

  // 获取大小值（根据 sizeField 配置）
  const getSizeValue = (item: { totalMarketCap?: number | null; amount?: number | null }) => {
    switch (config.sizeField) {
      case 'amount':
        return item.amount ?? 1;
      case 'totalMarketCap':
      default:
        return item.totalMarketCap ?? 1;
    }
  };

  // 根据值获取颜色
  const getColor = (value: number, field: string = 'changePercent') => {
    if (value === null || value === undefined) return '#6e7681';
    
    const isRiseRed = config.colorMode === 'red-rise';
    
    // 对于涨跌幅，正负值有不同颜色
    if (field === 'changePercent') {
      if (value === 0) return '#6e7681';
      if (value > 0) {
        const intensity = Math.min(value / 10, 1);
        return `rgba(${isRiseRed ? '239, 68, 68' : '34, 197, 94'}, ${0.3 + intensity * 0.7})`;
      } else {
        const intensity = Math.min(Math.abs(value) / 10, 1);
        return `rgba(${isRiseRed ? '34, 197, 94' : '239, 68, 68'}, ${0.3 + intensity * 0.7})`;
      }
    }
    
    // 对于换手率和量比，只使用单色渐变（值越大颜色越深）
    const maxValue = field === 'turnoverRate' ? 20 : 5; // 换手率最大20%，量比最大5
    const intensity = Math.min(value / maxValue, 1);
    return `rgba(${isRiseRed ? '239, 68, 68' : '34, 197, 94'}, ${0.3 + intensity * 0.7})`;
  };

  // 构建 Treemap 数据
  const treemapData = useMemo(() => {
    if (config.dimension === 'industry') {
      return industryList.map((item) => {
        const colorValue = getColorValue(item);
        return {
          name: item.name || '未知',
          value: getSizeValue(item),
          code: item.code,
          changePercent: item.changePercent,
          turnoverRate: item.turnoverRate,
          riseCount: item.riseCount,
          fallCount: item.fallCount,
          leadingStock: item.leadingStock,
          leadingStockChangePercent: item.leadingStockChangePercent,
          itemStyle: {
            color: getColor(colorValue, config.colorField),
          },
        };
      });
    }

    if (config.dimension === 'concept') {
      return conceptList.map((item) => {
        const colorValue = getColorValue(item);
        return {
          name: item.name || '未知',
          value: getSizeValue(item),
          code: item.code,
          changePercent: item.changePercent,
          turnoverRate: item.turnoverRate,
          riseCount: item.riseCount,
          fallCount: item.fallCount,
          leadingStock: item.leadingStock,
          leadingStockChangePercent: item.leadingStockChangePercent,
          itemStyle: {
            color: getColor(colorValue, config.colorField),
          },
        };
      });
    }

    if (config.dimension === 'stock' || config.dimension === 'watchlist') {
      return stockQuotes.map((item) => {
        const colorValue = getColorValue(item);
        return {
          name: item.name || '未知',
          value: getSizeValue(item),
          code: item.code,
          changePercent: item.changePercent,
          price: item.price,
          amount: item.amount,
          turnoverRate: item.turnoverRate,
          itemStyle: {
            color: getColor(colorValue, config.colorField),
          },
        };
      });
    }

    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.dimension, config.colorField, config.sizeField, industryList, conceptList, stockQuotes, config.colorMode]);

  // Treemap 配置
  const chartOption = useMemo(() => {
    return {
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: 'rgba(28, 33, 40, 0.96)',
        borderColor: '#30363d',
        borderWidth: 1,
        padding: [10, 14],
        textStyle: { color: '#e6edf3', fontSize: 12 },
        extraCssText: 'box-shadow: 0 8px 24px rgba(0,0,0,0.4); border-radius: 8px;',
        formatter: (params: { data: Record<string, unknown> }) => {
          const data = params.data;
          if (!data || !data.name) return '';
          
          let content = `<div style="font-weight:600;font-size:13px;margin-bottom:6px;color:#fff;">${data.name}</div>`;
          
          if (data.changePercent !== undefined && data.changePercent !== null) {
            const changePercent = data.changePercent as number;
            const color = changePercent > 0 ? '#ef4444' : changePercent < 0 ? '#22c55e' : '#8b949e';
            content += `<div style="display:flex;justify-content:space-between;gap:16px;"><span style="color:#8b949e">涨跌幅</span><span style="color:${color};font-weight:500">${formatPercent(changePercent)}</span></div>`;
          }
          
          if (data.turnoverRate !== undefined && data.turnoverRate !== null) {
            content += `<div style="display:flex;justify-content:space-between;gap:16px;margin-top:2px;"><span style="color:#8b949e">换手率</span><span>${(data.turnoverRate as number).toFixed(2)}%</span></div>`;
          }
          
          if (data.leadingStock) {
            const leadingChange = data.leadingStockChangePercent as number | null;
            const leadingColor = leadingChange != null && leadingChange > 0 ? '#ef4444' : leadingChange != null && leadingChange < 0 ? '#22c55e' : '#8b949e';
            content += `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #30363d;"><span style="color:#6e7681;font-size:11px">领涨</span><div style="margin-top:2px;display:flex;justify-content:space-between;"><span>${data.leadingStock}</span><span style="color:${leadingColor}">${leadingChange != null ? formatPercent(leadingChange) : ''}</span></div></div>`;
          }
          
          if (data.riseCount !== undefined && data.riseCount !== null) {
            content += `<div style="margin-top:6px;font-size:11px;color:#6e7681"><span style="color:#ef4444">${data.riseCount}↑</span> <span style="color:#22c55e">${data.fallCount ?? 0}↓</span></div>`;
          }
          
          if (data.price !== undefined && data.price !== null) {
            content += `<div style="display:flex;justify-content:space-between;gap:16px;margin-top:2px;"><span style="color:#8b949e">现价</span><span>${(data.price as number).toFixed(2)}</span></div>`;
            if (data.amount !== undefined && data.amount !== null) {
              content += `<div style="display:flex;justify-content:space-between;gap:16px;margin-top:2px;"><span style="color:#8b949e">成交额</span><span>${formatAmount(data.amount as number)}</span></div>`;
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
            borderColor: '#0d1117',
            borderWidth: 1,
            gapWidth: 1,
          },
          emphasis: {
            itemStyle: {
              borderColor: '#58a6ff',
              borderWidth: 2,
            },
            label: {
              show: true,
            },
          },
          levels: [
            {
              itemStyle: {
                borderColor: '#0d1117',
                borderWidth: 1,
                gapWidth: 1,
              },
            },
          ],
          data: treemapData,
        },
      ],
    };
  }, [treemapData]);

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
            items={COLOR_FIELD_OPTIONS}
            activeKey={config.colorField}
            onChange={(key) => updateConfig({ colorField: key as HeatmapConfig['colorField'] })}
            size="sm"
          />
        </div>

        <div className={styles.controlGroup}>
          <span className={styles.controlLabel}>面积</span>
          <Tabs
            items={SIZE_FIELD_OPTIONS}
            activeKey={config.sizeField}
            onChange={(key) => updateConfig({ sizeField: key as HeatmapConfig['sizeField'] })}
            size="sm"
          />
        </div>

        <div className={styles.controlGroup}>
          <button
            className={`${styles.colorModeBtn} ${config.colorMode === 'red-rise' ? styles.active : ''}`}
            onClick={() => updateConfig({ colorMode: config.colorMode === 'red-rise' ? 'green-rise' : 'red-rise' })}
          >
            {config.colorMode === 'red-rise' ? '红涨绿跌' : '绿涨红跌'}
          </button>
        </div>
      </motion.div>

      {/* 热力图 */}
      <div className={styles.chartCard}>
        <div className={styles.chartWrapper}>
          {treemapData.length > 0 ? (
            <ReactECharts
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
          <span className={styles.legendLabel}>
            {config.colorMode === 'red-rise' ? '跌' : '涨'}
          </span>
          <div className={styles.legendGradient} />
          <span className={styles.legendLabel}>
            {config.colorMode === 'red-rise' ? '涨' : '跌'}
          </span>
        </div>
      </div>
    </div>
  );
}
