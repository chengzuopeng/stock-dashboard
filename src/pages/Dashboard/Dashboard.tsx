/**
 * 总览页面
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { Card, Tabs, Loading, Empty, Button } from '@/components/common';
import { usePolling } from '@/hooks';
import {
  getFullQuotes,
  getIndustryList,
  getConceptList,
} from '@/services/sdk';
import { getAllWatchlistCodes } from '@/services/storage';
import {
  formatPrice,
  formatPercent,
  formatAmount,
  getChangeColorClass,
} from '@/utils/format';
import type { FullQuote, IndustryBoard, ConceptBoard } from 'stock-sdk';
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

export function Dashboard() {
  const navigate = useNavigate();

  // 数据状态
  const [indices, setIndices] = useState<FullQuote[]>([]);
  const [watchlistQuotes, setWatchlistQuotes] = useState<FullQuote[]>([]);
  const [industryList, setIndustryList] = useState<IndustryBoard[]>([]);
  const [conceptList, setConceptList] = useState<ConceptBoard[]>([]);
  const [rankingTab, setRankingTab] = useState('rise');
  const [boardTab, setBoardTab] = useState<'industry' | 'concept'>('industry');
  const [loading, setLoading] = useState(true);

  // 获取自选代码
  const watchlistCodes = getAllWatchlistCodes();

  // 加载数据
  const fetchData = useCallback(async () => {
    try {
      const [indicesData, boardIndustry, boardConcept] = await Promise.all([
        getFullQuotes(MAIN_INDICES),
        getIndustryList(),
        getConceptList(),
      ]);

      setIndices(indicesData);
      setIndustryList(boardIndustry);
      setConceptList(boardConcept);

      // 如果有自选，获取自选行情
      if (watchlistCodes.length > 0) {
        const watchlistData = await getFullQuotes(watchlistCodes.slice(0, 50));
        setWatchlistQuotes(watchlistData);
      }

      // 获取榜单数据（从行业成分取部分）
      // 这里简化处理，实际应调用 getAllAShareQuotes
      const topStocks = boardIndustry
        .slice(0, 10)
        .map((b) => b.leadingStock)
        .filter(Boolean);
      if (topStocks.length > 0) {
      // 暂时使用模拟数据
    }

    setLoading(false);
  } catch (error) {
    console.error('Dashboard fetch error:', error);
    setLoading(false);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [watchlistCodes.length]);

  // 轮询
  usePolling(fetchData, {
    interval: 5000,
    enabled: true,
    immediate: true,
  });

  // 跳转详情
  const handleStockClick = (code: string) => {
    navigate(`/s/${code}`);
  };

  // 跳转板块
  const handleBoardClick = (code: string, type: 'industry' | 'concept') => {
    navigate(`/boards/${type}/${code}`);
  };

  if (loading) {
    return <Loading fullScreen text="加载中..." />;
  }

  const currentBoards = boardTab === 'industry' ? industryList : conceptList;

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
            {industryList.length === 0 ? (
              <Loading size="md" />
            ) : (
              <div className={styles.rankingList}>
                {industryList.slice(0, 10).map((item, index) => (
                  <div
                    key={item.code}
                    className={styles.rankingItem}
                    onClick={() => handleBoardClick(item.code, 'industry')}
                  >
                    <span className={styles.rankNum}>{index + 1}</span>
                    <div className={styles.stockInfo}>
                      <span className={styles.stockName}>{item.leadingStock}</span>
                    </div>
                    <div className={`${styles.stockChange} ${getChangeColorClass(item.leadingStockChangePercent)}`}>
                      {formatPercent(item.leadingStockChangePercent)}
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
        </div>
      </div>
    </div>
  );
}
