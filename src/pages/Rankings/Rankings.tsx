/**
 * 榜单页面
 */

import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, BarChart2, RefreshCw } from 'lucide-react';
import { Card, Tabs, Loading } from '@/components/common';
import { usePolling } from '@/hooks';
import { getIndustryList, getConceptList } from '@/services/sdk';
import {
  formatPercent,
  formatTurnover,
  getChangeColorClass,
} from '@/utils/format';
import type { IndustryBoard, ConceptBoard } from 'stock-sdk';
import styles from './Rankings.module.css';

// 榜单类型
const RANKING_TYPES = [
  { key: 'rise', label: '涨幅榜', icon: <TrendingUp size={14} /> },
  { key: 'fall', label: '跌幅榜', icon: <TrendingDown size={14} /> },
  { key: 'amount', label: '成交额', icon: <BarChart2 size={14} /> },
  { key: 'turnover', label: '换手率', icon: <RefreshCw size={14} /> },
];

// 排序函数
type SortKey = 'rise' | 'fall' | 'amount' | 'turnover';

export function Rankings() {
  const navigate = useNavigate();

  // 状态
  const [rankType, setRankType] = useState<SortKey>('rise');
  const [industryList, setIndustryList] = useState<IndustryBoard[]>([]);
  const [conceptList, setConceptList] = useState<ConceptBoard[]>([]);
  const [loading, setLoading] = useState(true);

  // 加载数据
  const fetchData = useCallback(async () => {
    try {
      const [industry, concept] = await Promise.all([
        getIndustryList(),
        getConceptList(),
      ]);
      setIndustryList(industry);
      setConceptList(concept);
      setLoading(false);
    } catch (error) {
      console.error('Fetch rankings error:', error);
      setLoading(false);
    }
  }, []);

  // 轮询
  usePolling(fetchData, {
    interval: 5000,
    enabled: true,
    immediate: true,
  });

  // 排序后的板块数据
  const sortedIndustry = useMemo(() => {
    const sorted = [...industryList];
    switch (rankType) {
      case 'rise':
        sorted.sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0));
        break;
      case 'fall':
        sorted.sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0));
        break;
      case 'turnover':
        sorted.sort((a, b) => (b.turnoverRate ?? 0) - (a.turnoverRate ?? 0));
        break;
      default:
        break;
    }
    return sorted.slice(0, 50);
  }, [industryList, rankType]);

  const sortedConcept = useMemo(() => {
    const sorted = [...conceptList];
    switch (rankType) {
      case 'rise':
        sorted.sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0));
        break;
      case 'fall':
        sorted.sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0));
        break;
      case 'turnover':
        sorted.sort((a, b) => (b.turnoverRate ?? 0) - (a.turnoverRate ?? 0));
        break;
      default:
        break;
    }
    return sorted.slice(0, 50);
  }, [conceptList, rankType]);

  // 跳转板块详情
  const handleBoardClick = (code: string, type: 'industry' | 'concept') => {
    navigate(`/boards/${type}/${code}`);
  };

  if (loading) {
    return <Loading fullScreen text="加载榜单数据..." />;
  }

  return (
    <div className={styles.rankings}>
      {/* 控制栏 */}
      <div className={styles.controls}>
        <Tabs
          items={RANKING_TYPES}
          activeKey={rankType}
          onChange={(key) => setRankType(key as SortKey)}
        />
      </div>

      <div className={styles.content}>
        {/* 行业榜单 */}
        <Card title="行业板块" padding="sm">
          <div className={styles.rankTable}>
            <div className={styles.tableHeader}>
              <span className={styles.colRank}>排名</span>
              <span className={styles.colName}>名称</span>
              <span className={styles.colChange}>涨跌幅</span>
              <span className={styles.colLeader}>领涨股</span>
              <span className={styles.colStats}>涨/跌</span>
              <span className={styles.colTurnover}>换手</span>
            </div>
            <div className={styles.tableBody}>
              {sortedIndustry.map((item, index) => (
                <motion.div
                  key={item.code}
                  className={styles.tableRow}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  onClick={() => handleBoardClick(item.code, 'industry')}
                >
                  <span className={styles.colRank}>
                    <span className={`${styles.rankNum} ${index < 3 ? styles.top3 : ''}`}>
                      {index + 1}
                    </span>
                  </span>
                  <span className={styles.colName}>{item.name}</span>
                  <span className={`${styles.colChange} ${getChangeColorClass(item.changePercent)}`}>
                    {formatPercent(item.changePercent)}
                  </span>
                  <div className={styles.colLeader}>
                    <span className={styles.leaderName}>{item.leadingStock}</span>
                    <span className={getChangeColorClass(item.leadingStockChangePercent)}>
                      {formatPercent(item.leadingStockChangePercent)}
                    </span>
                  </div>
                  <span className={styles.colStats}>
                    <span className="text-rise">{item.riseCount}</span>
                    <span>/</span>
                    <span className="text-fall">{item.fallCount}</span>
                  </span>
                  <span className={styles.colTurnover}>
                    {formatTurnover(item.turnoverRate)}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </Card>

        {/* 概念榜单 */}
        <Card title="概念板块" padding="sm">
          <div className={styles.rankTable}>
            <div className={styles.tableHeader}>
              <span className={styles.colRank}>排名</span>
              <span className={styles.colName}>名称</span>
              <span className={styles.colChange}>涨跌幅</span>
              <span className={styles.colLeader}>领涨股</span>
              <span className={styles.colStats}>涨/跌</span>
              <span className={styles.colTurnover}>换手</span>
            </div>
            <div className={styles.tableBody}>
              {sortedConcept.map((item, index) => (
                <motion.div
                  key={item.code}
                  className={styles.tableRow}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  onClick={() => handleBoardClick(item.code, 'concept')}
                >
                  <span className={styles.colRank}>
                    <span className={`${styles.rankNum} ${index < 3 ? styles.top3 : ''}`}>
                      {index + 1}
                    </span>
                  </span>
                  <span className={styles.colName}>{item.name}</span>
                  <span className={`${styles.colChange} ${getChangeColorClass(item.changePercent)}`}>
                    {formatPercent(item.changePercent)}
                  </span>
                  <div className={styles.colLeader}>
                    <span className={styles.leaderName}>{item.leadingStock}</span>
                    <span className={getChangeColorClass(item.leadingStockChangePercent)}>
                      {formatPercent(item.leadingStockChangePercent)}
                    </span>
                  </div>
                  <span className={styles.colStats}>
                    <span className="text-rise">{item.riseCount}</span>
                    <span>/</span>
                    <span className="text-fall">{item.fallCount}</span>
                  </span>
                  <span className={styles.colTurnover}>
                    {formatTurnover(item.turnoverRate)}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
