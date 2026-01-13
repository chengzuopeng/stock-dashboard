/**
 * 自选管理页
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  Edit3,
} from 'lucide-react';
import { Card, Button, Loading, Empty } from '@/components/common';
import { usePolling } from '@/hooks';
import { getAllQuotesByCodes } from '@/services/sdk';
import {
  getWatchlistGroups,
  createWatchlistGroup,
  deleteWatchlistGroup,
  renameWatchlistGroup,
  removeFromWatchlist,
} from '@/services/storage';
import {
  formatPrice,
  formatPercent,
  formatAmount,
  formatTurnover,
  getChangeColorClass,
  normalizeStockCode,
} from '@/utils/format';
import type { WatchlistGroup } from '@/types';
import type { FullQuote } from 'stock-sdk';
import styles from './Watchlist.module.css';

export function Watchlist() {
  const navigate = useNavigate();

  // 状态
  const [groups, setGroups] = useState<WatchlistGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState('default');
  const [quotes, setQuotes] = useState<Map<string, FullQuote>>(new Map());
  const [loading, setLoading] = useState(true);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');

  // 加载分组
  useEffect(() => {
    const loadedGroups = getWatchlistGroups();
    setGroups(loadedGroups);
    if (loadedGroups.length > 0 && !loadedGroups.find((g) => g.id === activeGroupId)) {
      setActiveGroupId(loadedGroups[0].id);
    }
    // 如果没有自选股，直接设置 loading 为 false
    const group = loadedGroups.find((g) => g.id === activeGroupId);
    if (!group || group.codes.length === 0) {
      setLoading(false);
    }
  }, [activeGroupId]);

  // 当前分组
  const activeGroup = groups.find((g) => g.id === activeGroupId);
  const activeCodes = useMemo(() => activeGroup?.codes || [], [activeGroup?.codes]);

  const normalizedActiveCodes = useMemo(() => {
    const codes = new Set<string>();
    activeCodes.forEach((code) => {
      const normalized = normalizeStockCode(code);
      if (normalized) {
        codes.add(normalized);
      }
    });
    return Array.from(codes);
  }, [activeCodes]);

  // 加载行情
  const fetchQuotes = useCallback(async () => {
    if (normalizedActiveCodes.length === 0) {
      setLoading(false);
      return;
    }

    try {
      const data = await getAllQuotesByCodes(normalizedActiveCodes);
      const map = new Map<string, FullQuote>();
      
      // 使用标准化后的代码作为 key
      data.forEach((q) => {
        if (q && q.code) {
          const normalized = normalizeStockCode(q.code);
          map.set(normalized, q);
          // 同时保存原始格式
          map.set(q.code, q);
          map.set(q.code.toLowerCase(), q);
        }
      });
      
      setQuotes(map);
      setLoading(false);
    } catch (error) {
      console.error('Fetch quotes error:', error);
      setLoading(false);
    }
  }, [normalizedActiveCodes]);

  // 轮询
  usePolling(fetchQuotes, {
    interval: 5000,
    enabled: normalizedActiveCodes.length > 0,
    immediate: true,
  });

  // 创建分组
  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    const newGroup = createWatchlistGroup(newGroupName.trim());
    setGroups(getWatchlistGroups());
    setActiveGroupId(newGroup.id);
    setNewGroupName('');
  };

  // 删除分组
  const handleDeleteGroup = (groupId: string) => {
    if (groupId === 'default') return;
    if (confirm('确定删除该分组？分组内的股票将被移除。')) {
      deleteWatchlistGroup(groupId);
      setGroups(getWatchlistGroups());
      if (activeGroupId === groupId) {
        setActiveGroupId('default');
      }
    }
  };

  // 重命名分组
  const handleRenameGroup = (groupId: string, name: string) => {
    renameWatchlistGroup(groupId, name);
    setGroups(getWatchlistGroups());
    setEditingGroup(null);
  };

  // 移除股票
  const handleRemoveStock = (code: string) => {
    removeFromWatchlist(code, activeGroupId);
    setGroups(getWatchlistGroups());
  };

  // 跳转详情
  const handleStockClick = (code: string) => {
    navigate(`/s/${code}`);
  };

  // 排序后的股票列表
  const sortedStocks = normalizedActiveCodes
    .map((code) => {
      return quotes.get(code) || quotes.get(code.toLowerCase());
    })
    .filter((q): q is FullQuote => !!q)
    .sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0));

  return (
    <div className={styles.watchlist}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h3>分组</h3>
        </div>

        <div className={styles.groupList}>
          {groups.map((group) => (
            <div
              key={group.id}
              className={`${styles.groupItem} ${activeGroupId === group.id ? styles.active : ''}`}
              onClick={() => setActiveGroupId(group.id)}
            >
              {editingGroup === group.id ? (
                <input
                  type="text"
                  className={styles.groupInput}
                  defaultValue={group.name}
                  autoFocus
                  onBlur={(e) => handleRenameGroup(group.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleRenameGroup(group.id, e.currentTarget.value);
                    }
                    if (e.key === 'Escape') {
                      setEditingGroup(null);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <span className={styles.groupName}>{group.name}</span>
                  <span className={styles.groupCount}>{group.codes.length}</span>
                  {group.id !== 'default' && (
                    <div className={styles.groupActions}>
                      <button
                        className={styles.actionBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingGroup(group.id);
                        }}
                      >
                        <Edit3 size={12} />
                      </button>
                      <button
                        className={styles.actionBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGroup(group.id);
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        <div className={styles.addGroup}>
          <input
            type="text"
            className={styles.addGroupInput}
            placeholder="新建分组..."
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateGroup();
            }}
          />
          <Button size="sm" icon={<Plus size={14} />} onClick={handleCreateGroup}>
            添加
          </Button>
        </div>
      </div>

      <div className={styles.main}>
        <Card
          title={activeGroup?.name || '自选股'}
          extra={
            <div className={styles.mainActions}>
              <span className={styles.stockCount}>
                共 {activeCodes.length} 只
              </span>
            </div>
          }
        >
          {loading ? (
            <Loading text="加载中..." />
          ) : activeCodes.length === 0 ? (
            <Empty
              title="暂无自选股"
              description="搜索添加股票到当前分组"
            />
          ) : (
            <div className={styles.stockTable}>
              <div className={styles.tableHeader}>
                <span className={styles.colName}>名称/代码</span>
                <span className={styles.colPrice}>现价</span>
                <span className={styles.colChange}>涨跌幅</span>
                <span className={styles.colAmount}>成交额</span>
                <span className={styles.colTurnover}>换手</span>
                <span className={styles.colAction}>操作</span>
              </div>

              <div className={styles.tableBody}>
                <AnimatePresence>
                  {sortedStocks.map((quote) => {
                    return (
                      <motion.div
                        key={quote.code}
                        className={styles.tableRow}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        onClick={() => handleStockClick(quote.code)}
                      >
                        <div className={styles.colName}>
                          <span className={styles.stockName}>{quote.name}</span>
                          <span className={styles.stockCode}>{quote.code}</span>
                        </div>
                        <span className={`${styles.colPrice} ${getChangeColorClass(quote.changePercent)}`}>
                          {formatPrice(quote.price)}
                        </span>
                        <span className={`${styles.colChange} ${getChangeColorClass(quote.changePercent)}`}>
                          {formatPercent(quote.changePercent)}
                        </span>
                        <span className={styles.colAmount}>
                          {formatAmount(quote.amount)}
                        </span>
                        <span className={styles.colTurnover}>
                          {formatTurnover(quote.turnoverRate)}
                        </span>
                        <div className={styles.colAction}>
                          <button
                            className={styles.removeBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveStock(quote.code);
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
