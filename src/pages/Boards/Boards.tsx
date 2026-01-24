/**
 * 板块页面
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, Lightbulb, Search } from 'lucide-react';
import { Card, Tabs, Loading, Empty } from '@/components/common';
import { useBoardData } from '@/contexts';
import {
  formatPercent,
  formatMarketCap,
  formatTurnover,
  getChangeColorClass,
} from '@/utils/format';
import styles from './Boards.module.css';

// 板块类型
const BOARD_TYPES = [
  { key: 'industry', label: '行业板块', icon: <Building2 size={14} /> },
  { key: 'concept', label: '概念板块', icon: <Lightbulb size={14} /> },
];

export function Boards() {
  const navigate = useNavigate();

  // 使用共享的板块数据（优化：避免重复请求）
  const { industryList, conceptList, loading } = useBoardData();

  // 本地 UI 状态
  const [boardType, setBoardType] = useState<'industry' | 'concept'>('industry');
  const [searchKeyword, setSearchKeyword] = useState('');

  // 过滤后的数据
  const filteredData = useMemo(() => {
    const list = boardType === 'industry' ? industryList : conceptList;
    if (!searchKeyword.trim()) return list;
    
    const keyword = searchKeyword.toLowerCase();
    return list.filter(
      (item) =>
        item.name.toLowerCase().includes(keyword) ||
        item.leadingStock?.toLowerCase().includes(keyword)
    );
  }, [boardType, industryList, conceptList, searchKeyword]);

  // 跳转详情
  const handleBoardClick = (code: string) => {
    navigate(`/boards/${boardType}/${code}`);
  };

  if (loading) {
    return <Loading fullScreen text="加载板块数据..." />;
  }

  return (
    <div className={styles.boards}>
      {/* 控制栏 */}
      <div className={styles.controls}>
        <Tabs
          items={BOARD_TYPES}
          activeKey={boardType}
          onChange={(key) => setBoardType(key as 'industry' | 'concept')}
        />

        <div className={styles.searchWrapper}>
          <Search size={14} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="搜索板块..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />
        </div>
      </div>

      {/* 板块列表 */}
      <Card padding="none">
        {filteredData.length === 0 ? (
          <Empty title="未找到匹配的板块" />
        ) : (
          <div className={styles.boardGrid}>
            {filteredData.map((item, index) => (
              <motion.div
                key={item.code}
                className={styles.boardCard}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.02 }}
                onClick={() => handleBoardClick(item.code)}
              >
                <div className={styles.boardHeader}>
                  <span className={styles.boardRank}>{item.rank}</span>
                  <h4 className={styles.boardName}>{item.name}</h4>
                </div>

                <div className={`${styles.boardChange} ${getChangeColorClass(item.changePercent)}`}>
                  {formatPercent(item.changePercent)}
                </div>

                <div className={styles.boardMeta}>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>总市值</span>
                    <span className={styles.metaValue}>
                      {formatMarketCap(item.totalMarketCap)}
                    </span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>换手率</span>
                    <span className={styles.metaValue}>
                      {formatTurnover(item.turnoverRate)}
                    </span>
                  </div>
                </div>

                <div className={styles.boardStats}>
                  <span className="text-rise">{item.riseCount} 涨</span>
                  <span className="text-fall">{item.fallCount} 跌</span>
                </div>

                <div className={styles.boardLeader}>
                  <span className={styles.leaderLabel}>领涨</span>
                  <span className={styles.leaderName}>{item.leadingStock || '--'}</span>
                  <span className={getChangeColorClass(item.leadingStockChangePercent)}>
                    {formatPercent(item.leadingStockChangePercent)}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
