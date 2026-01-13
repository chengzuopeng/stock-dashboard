/**
 * 热力图页面
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { motion } from 'framer-motion';
import { Grid3X3, Building2, Lightbulb, Star } from 'lucide-react';
import { Card, Tabs, Loading } from '@/components/common';
import { usePolling } from '@/hooks';
import {
  getIndustryList,
  getConceptList,
  getAllQuotesByCodes,
} from '@/services/sdk';
import { getAllWatchlistCodes, getHeatmapConfig, saveHeatmapConfig } from '@/services/storage';
import { formatPercent, formatAmount } from '@/utils/format';
import type { IndustryBoard, ConceptBoard, FullQuote } from 'stock-sdk';
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
  
  // 配置状态
  const [config, setConfig] = useState<HeatmapConfig>(getHeatmapConfig);
  const [loading, setLoading] = useState(true);

  // 数据状态
  const [industryList, setIndustryList] = useState<IndustryBoard[]>([]);
  const [conceptList, setConceptList] = useState<ConceptBoard[]>([]);
  const [stockQuotes, setStockQuotes] = useState<FullQuote[]>([]);

  // 更新配置
  const updateConfig = (updates: Partial<HeatmapConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    saveHeatmapConfig(newConfig);
  };

  // 加载板块数据
  const fetchBoardData = useCallback(async () => {
    try {
      const [industry, concept] = await Promise.all([
        getIndustryList(),
        getConceptList(),
      ]);
      setIndustryList(industry);
      setConceptList(concept);
      setLoading(false);
    } catch (error) {
      console.error('Fetch board data error:', error);
      setLoading(false);
    }
  }, []);

  // 加载个股数据
  const fetchStockData = useCallback(async () => {
    if (config.dimension !== 'stock' && config.dimension !== 'watchlist') return;

    try {
      let codes: string[] = [];
      if (config.dimension === 'watchlist') {
        codes = getAllWatchlistCodes();
        if (codes.length > 0) {
          const quotes = await getAllQuotesByCodes(codes.slice(0, config.topK));
          setStockQuotes(quotes);
        } else {
          setStockQuotes([]);
        }
      } else {
        // 个股模式：从行业板块的成分股中获取（取前几个行业的领涨股）
        // 首先获取行业成分股中的代码
        const { getIndustryConstituents } = await import('@/services/sdk');
        const allStocks: FullQuote[] = [];
        
        // 获取前3个行业的成分股
        const topIndustries = industryList.slice(0, 3);
        for (const industry of topIndustries) {
          try {
            const constituents = await getIndustryConstituents(industry.code);
            // 获取成分股代码
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

  // 初始加载
  useEffect(() => {
     
    fetchBoardData();
  }, [fetchBoardData]);

  // 维度变化时加载数据
  useEffect(() => {
    if (config.dimension === 'stock' || config.dimension === 'watchlist') {
       
      fetchStockData();
    }
  }, [config.dimension, fetchStockData]);

  // 轮询
  usePolling(
    config.dimension === 'industry' || config.dimension === 'concept'
      ? fetchBoardData
      : fetchStockData,
    {
      interval: config.dimension === 'stock' ? 5000 : 15000,
      enabled: !loading,
    }
  );

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
        backgroundColor: '#1c2128',
        borderColor: '#30363d',
        textStyle: { color: '#e6edf3', fontSize: 12 },
        formatter: (params: { data: Record<string, unknown> }) => {
          const data = params.data;
          if (!data || !data.name) return '';
          
          let content = `<div style="font-weight:500;margin-bottom:4px;">${data.name}</div>`;
          
          if (data.changePercent !== undefined && data.changePercent !== null) {
            const changePercent = data.changePercent as number;
            const color = changePercent > 0 ? '#ef4444' : changePercent < 0 ? '#22c55e' : '#8b949e';
            content += `<div style="color:${color}">涨跌幅: ${formatPercent(changePercent)}</div>`;
          }
          
          if (data.turnoverRate !== undefined && data.turnoverRate !== null) {
            content += `<div>换手率: ${(data.turnoverRate as number).toFixed(2)}%</div>`;
          }
          
          if (data.leadingStock) {
            const leadingChange = data.leadingStockChangePercent as number | null;
            content += `<div style="margin-top:4px;color:#8b949e">领涨: ${data.leadingStock} ${leadingChange != null ? formatPercent(leadingChange) : ''}</div>`;
          }
          
          if (data.riseCount !== undefined && data.riseCount !== null) {
            content += `<div style="color:#8b949e">${data.riseCount}↑ ${data.fallCount ?? 0}↓</div>`;
          }
          
          if (data.price !== undefined && data.price !== null) {
            content += `<div>现价: ${(data.price as number).toFixed(2)}</div>`;
            if (data.amount !== undefined && data.amount !== null) {
              content += `<div>成交额: ${formatAmount(data.amount as number)}</div>`;
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
                fontSize: 12,
                color: '#e6edf3',
                fontWeight: 500,
              },
              change: {
                fontSize: 11,
                color: '#e6edf3',
                padding: [4, 0, 0, 0],
              },
            },
          },
          itemStyle: {
            borderColor: '#0d1117',
            borderWidth: 2,
            gapWidth: 2,
          },
          emphasis: {
            itemStyle: {
              borderColor: '#388bfd',
              borderWidth: 2,
            },
          },
          levels: [
            {
              itemStyle: {
                borderColor: '#0d1117',
                borderWidth: 2,
                gapWidth: 2,
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
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className={styles.controlGroup}>
          <span className={styles.controlLabel}>维度</span>
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
          <span className={styles.controlLabel}>色彩</span>
          <button
            className={`${styles.colorModeBtn} ${config.colorMode === 'red-rise' ? styles.active : ''}`}
            onClick={() => updateConfig({ colorMode: config.colorMode === 'red-rise' ? 'green-rise' : 'red-rise' })}
          >
            {config.colorMode === 'red-rise' ? '红涨绿跌' : '绿涨红跌'}
          </button>
        </div>
      </motion.div>

      {/* 热力图 */}
      <Card padding="none" className={styles.chartCard}>
        <div className={styles.chartWrapper}>
          {treemapData.length > 0 ? (
            <ReactECharts
              option={chartOption}
              style={{ height: '100%', width: '100%', minHeight: '500px' }}
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
      </Card>

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
