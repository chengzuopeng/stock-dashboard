/**
 * 自选管理页
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  Edit3,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Square,
  X,
  Download,
  Upload,
  GripVertical,
  Columns3,
  Bell,
} from 'lucide-react';
import { Card, Button, Loading, Empty, useToast } from '@/components/common';
import { usePolling, useWatchlistState } from '@/hooks';
import { useAppSettings } from '@/contexts';
import { getAllQuotesByCodes } from '@/services/sdk';
import { getTableColumns, saveTableColumns } from '@/services/storage';
import { watchlistActions, watchlistStore } from '@/services/watchlistStore';
import {
  formatPrice,
  formatPercent,
  formatAmount,
  formatTurnover,
  getChangeColorClass,
  normalizeStockCode,
} from '@/utils/format';
import type { AlertRule, ColumnConfig } from '@/types';
import type { FullQuote } from 'stock-sdk';
import styles from './Watchlist.module.css';

// 排序类型
type SortField = 'default' | 'changePercent' | 'amount' | 'turnoverRate' | 'totalMarketCap';
type SortOrder = 'asc' | 'desc';

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'default', label: '默认' },
  { field: 'changePercent', label: '涨幅' },
  { field: 'amount', label: '成交额' },
  { field: 'turnoverRate', label: '换手率' },
  { field: 'totalMarketCap', label: '市值' },
];

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: 'name', label: '名称/代码', visible: true },
  { key: 'price', label: '现价', visible: true },
  { key: 'change', label: '涨跌幅', visible: true },
  { key: 'amount', label: '成交额', visible: true },
  { key: 'turnover', label: '换手', visible: true },
];

function createInitialColumns() {
  const storedColumns = getTableColumns('watchlist');
  if (!storedColumns) {
    return DEFAULT_COLUMNS;
  }

  return DEFAULT_COLUMNS.map((column) => ({
    ...column,
    ...storedColumns.find((item) => item.key === column.key),
  }));
}

function matchesAlertRule(rule: AlertRule, quote: FullQuote) {
  // SDK 对空行情字段一律填 0，price=0 的行触发的告警全是误报（停牌/退市/脏数据）
  if (!quote.price) {
    return false;
  }
  switch (rule.type) {
    case 'price_gte':
      return quote.price >= rule.value;
    case 'price_lte':
      return quote.price <= rule.value;
    case 'change_percent_gte':
      return quote.changePercent >= rule.value;
    case 'change_percent_lte':
      return quote.changePercent <= rule.value;
    case 'amount_gte':
      return (quote.amount ?? 0) >= rule.value;
    case 'near_limit_up':
      return quote.limitUp !== null && quote.price >= quote.limitUp * (1 - rule.value / 100);
    case 'near_limit_down':
      return (
        quote.limitDown !== null && quote.price <= quote.limitDown * (1 + rule.value / 100)
      );
    default:
      return false;
  }
}

function formatAlertRule(rule: AlertRule) {
  switch (rule.type) {
    case 'price_gte':
      return `价格 >= ${rule.value}`;
    case 'price_lte':
      return `价格 <= ${rule.value}`;
    case 'change_percent_gte':
      return `涨幅 >= ${rule.value}%`;
    case 'change_percent_lte':
      return `涨幅 <= ${rule.value}%`;
    case 'amount_gte':
      return `成交额 >= ${rule.value}`;
    case 'near_limit_up':
      return `接近涨停 ${rule.value}%`;
    case 'near_limit_down':
      return `接近跌停 ${rule.value}%`;
    default:
      return rule.type;
  }
}

export function Watchlist() {
  const navigate = useNavigate();
  const toast = useToast();
  const { getRefreshInterval } = useAppSettings();

  // 初始化分组数据
  const { groups, alerts } = useWatchlistState();

  // 状态
  const [activeGroupId, setActiveGroupId] = useState(() => groups[0]?.id ?? 'default');
  const [quotes, setQuotes] = useState<Map<string, FullQuote>>(new Map());
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');

  // 排序
  const [sortField, setSortField] = useState<SortField>('default');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // 批量选择
  const [selectedStocks, setSelectedStocks] = useState<Set<string>>(new Set());
  const [showSelectMode, setShowSelectMode] = useState(false);

  // 导入导出
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [columns, setColumns] = useState<ColumnConfig[]>(createInitialColumns);
  const [showColumnPanel, setShowColumnPanel] = useState(false);
  const [showAlertPanel, setShowAlertPanel] = useState(false);

  // 拖拽：dragover 只改本地预览，drop 才持久化——Esc 取消的拖拽不能落库
  const [draggedCode, setDraggedCode] = useState<string | null>(null);
  const [dragPreviewCodes, setDragPreviewCodes] = useState<string[] | null>(null);
  const [quotesError, setQuotesError] = useState(false);

  // 当前分组
  const activeGroup = groups.find((g) => g.id === activeGroupId);
  const activeCodes = useMemo(() => activeGroup?.codes || [], [activeGroup?.codes]);
  const visibleColumns = useMemo(
    () => columns.filter((column) => column.visible).map((column) => column.key),
    [columns]
  );

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
  const groupAlerts = useMemo(
    () =>
      alerts.filter((rule) =>
        normalizedActiveCodes.includes(normalizeStockCode(rule.code))
      ),
    [alerts, normalizedActiveCodes]
  );

  // 计算加载状态
  const isEmptyGroup = useMemo(() => {
    const group = groups.find((g) => g.id === activeGroupId);
    return !group || group.codes.length === 0;
  }, [groups, activeGroupId]);

  // 加载行情
  const fetchQuotes = useCallback(async () => {
    if (normalizedActiveCodes.length === 0) {
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
      setQuotesError(false);

      const now = Date.now();
      const triggered: AlertRule[] = [];

      watchlistStore
        .getSnapshot()
        .alerts.filter((rule) => rule.enabled)
        .forEach((rule) => {
          const normalized = normalizeStockCode(rule.code);
          const currentQuote = map.get(normalized);
          if (!currentQuote) {
            return;
          }

          if (now - rule.lastTriggeredAt < rule.cooldownSec * 1000) {
            return;
          }

          if (!matchesAlertRule(rule, currentQuote)) {
            return;
          }

          watchlistActions.updateAlert(rule.id, { lastTriggeredAt: now });
          triggered.push(rule);
        });

      // 超限聚合成一条：全部规则都已写 lastTriggeredAt（冷却语义一致），不逐条轰炸
      const MAX_ALERT_TOASTS = 2;
      triggered.slice(0, MAX_ALERT_TOASTS).forEach((rule) => {
        toast.info(`${rule.name} 触发告警: ${formatAlertRule(rule)}`);
      });
      if (triggered.length > MAX_ALERT_TOASTS) {
        toast.info(`另有 ${triggered.length - MAX_ALERT_TOASTS} 条告警触发，详见告警面板`);
      }
    } catch (error) {
      console.error('Fetch quotes error:', error);
      setQuotesError(true);
    }
  }, [normalizedActiveCodes, toast]);

  // 轮询（优化：从 5s 改为 10s，减少 API 请求）
  const { refresh: refreshQuotes } = usePolling(fetchQuotes, {
    interval: getRefreshInterval('list'),
    enabled: normalizedActiveCodes.length > 0,
    immediate: true,
  });

  // 非空组之间切换不触发轮询 effect（enabled 不变），需主动刷新，否则表格空白到下个 tick
  const activeCodesKey = normalizedActiveCodes.join(',');
  const groupSwitchInitRef = useRef(false);
  useEffect(() => {
    if (!groupSwitchInitRef.current) {
      groupSwitchInitRef.current = true;
      return;
    }
    refreshQuotes();
  }, [activeGroupId, activeCodesKey, refreshQuotes]);

  // 创建分组
  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    const newGroup = watchlistActions.createGroup(newGroupName.trim());
    setActiveGroupId(newGroup.id);
    setNewGroupName('');
  };

  // 删除分组
  const handleDeleteGroup = (groupId: string) => {
    if (groupId === 'default') return;
    if (confirm('确定删除该分组？分组内的股票将被移除。')) {
      watchlistActions.deleteGroup(groupId);
      if (activeGroupId === groupId) {
        setActiveGroupId('default');
      }
    }
  };

  // 重命名分组
  const handleRenameGroup = (groupId: string, name: string) => {
    watchlistActions.renameGroup(groupId, name);
    setEditingGroup(null);
  };

  // 移除股票
  const handleRemoveStock = (code: string) => {
    watchlistActions.remove(code, activeGroupId);
  };

  // 跳转详情
  const handleStockClick = (code: string) => {
    navigate(`/s/${code}`);
  };

  // 切换排序
  const handleSortChange = useCallback((field: SortField) => {
    if (field === sortField) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  }, [sortField]);

  // 切换选择
  const handleToggleSelect = useCallback((code: string) => {
    setSelectedStocks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(code)) {
        newSet.delete(code);
      } else {
        newSet.add(code);
      }
      return newSet;
    });
  }, []);

  // 全选/取消全选
  const handleSelectAll = useCallback(() => {
    if (selectedStocks.size === normalizedActiveCodes.length) {
      setSelectedStocks(new Set());
    } else {
      setSelectedStocks(new Set(normalizedActiveCodes));
    }
  }, [selectedStocks.size, normalizedActiveCodes]);

  // 批量删除
  const handleBatchDelete = useCallback(() => {
    if (selectedStocks.size === 0) return;
    watchlistActions.batchRemove(Array.from(selectedStocks), activeGroupId);
    toast.success(`已删除 ${selectedStocks.size} 只股票`);
    setSelectedStocks(new Set());
    setShowSelectMode(false);
  }, [selectedStocks, activeGroupId, toast]);

  // 导出自选
  const handleExport = useCallback(() => {
    const codes = normalizedActiveCodes.join('\n');
    navigator.clipboard.writeText(codes).then(() => {
      toast.success(`已复制 ${normalizedActiveCodes.length} 只股票代码到剪贴板`);
    }).catch(() => {
      // 降级处理：创建下载文件
      const blob = new Blob([codes], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `watchlist_${activeGroup?.name || 'default'}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('已导出股票代码');
    });
  }, [normalizedActiveCodes, activeGroup?.name, toast]);

  // 导入自选
  const handleImport = useCallback(() => {
    if (!importText.trim()) {
      toast.info('请输入股票代码');
      return;
    }
    // 解析输入的代码，支持逗号、空格、换行分隔
    const codes = importText
      .split(/[\s,;，；\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (codes.length === 0) {
      toast.info('未识别到有效的股票代码');
      return;
    }

    const validCodes = new Set<string>();
    const invalidCodes = new Set<string>();

    codes.forEach((code) => {
      const normalized = normalizeStockCode(code);
      if (/^(sh|sz|bj)\d{6}$/i.test(normalized)) {
        validCodes.add(normalized);
      } else {
        invalidCodes.add(code);
      }
    });

    if (validCodes.size === 0) {
      toast.warning('未识别到有效的 A 股代码');
      return;
    }

    const addedCount = watchlistActions.batchAdd(Array.from(validCodes), activeGroupId);
    setImportText('');
    setShowImportModal(false);

    if (addedCount > 0) {
      const suffix =
        invalidCodes.size > 0 ? `，已跳过 ${invalidCodes.size} 个无效代码` : '';
      toast.success(`已导入 ${addedCount} 只股票${suffix}`);
    } else {
      if (invalidCodes.size > 0) {
        toast.warning(`未导入新股票，且跳过了 ${invalidCodes.size} 个无效代码`);
      } else {
        toast.info('所有股票已在自选中');
      }
    }
  }, [importText, activeGroupId, toast]);

  // 拖拽排序处理
  const handleDragStart = useCallback((code: string) => {
    setDraggedCode(code);
    setDragPreviewCodes(normalizedActiveCodes);
  }, [normalizedActiveCodes]);

  const handleDragOver = useCallback((e: React.DragEvent, targetCode: string) => {
    e.preventDefault();
    if (!draggedCode || draggedCode === targetCode) return;

    setDragPreviewCodes((prev) => {
      const currentCodes = [...(prev ?? normalizedActiveCodes)];
      const dragIndex = currentCodes.indexOf(draggedCode);
      const targetIndex = currentCodes.indexOf(targetCode);
      if (dragIndex === -1 || targetIndex === -1) return prev;

      currentCodes.splice(dragIndex, 1);
      currentCodes.splice(targetIndex, 0, draggedCode);
      return currentCodes;
    });
  }, [draggedCode, normalizedActiveCodes]);

  const handleDrop = useCallback(() => {
    const draggedIndex =
      draggedCode && dragPreviewCodes ? dragPreviewCodes.indexOf(draggedCode) : -1;
    if (draggedCode && dragPreviewCodes && draggedIndex !== -1) {
      watchlistActions.move(activeGroupId, draggedCode, dragPreviewCodes[draggedIndex + 1] ?? null);
    }
    setDraggedCode(null);
    setDragPreviewCodes(null);
  }, [draggedCode, dragPreviewCodes, activeGroupId]);

  // dragend 在 drop 之后触发；未 drop（Esc/拖出去）则丢弃预览，持久化顺序不变
  const handleDragEnd = useCallback(() => {
    setDraggedCode(null);
    setDragPreviewCodes(null);
  }, []);

  const handleToggleColumn = useCallback((columnKey: string) => {
    setColumns((prev) => {
      const next = prev.map((column) =>
        column.key === columnKey ? { ...column, visible: !column.visible } : column
      );
      saveTableColumns('watchlist', next);
      return next;
    });
  }, []);

  // 排序后的股票列表
  const sortedStocks = useMemo(() => {
    const orderedCodes = dragPreviewCodes ?? normalizedActiveCodes;
    const stockList = orderedCodes
      .map((code) => {
        return quotes.get(code) || quotes.get(code.toLowerCase());
      })
      .filter((q): q is FullQuote => !!q);

    if (sortField === 'default') {
      return stockList; // 保持原始顺序
    }

    return [...stockList].sort((a, b) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      return sortOrder === 'desc' ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
    });
  }, [dragPreviewCodes, normalizedActiveCodes, quotes, sortField, sortOrder]);

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
              {activeCodes.length > 0 && (
                <>
                  <button
                    className={styles.toolBtn}
                    onClick={() => setShowImportModal(true)}
                    title="导入"
                  >
                    <Upload size={14} />
                  </button>
                  <button
                    className={styles.toolBtn}
                    onClick={handleExport}
                    title="导出"
                  >
                    <Download size={14} />
                  </button>
                  <button
                    className={`${styles.toolBtn} ${showSelectMode ? styles.active : ''}`}
                    onClick={() => {
                      setShowSelectMode(!showSelectMode);
                      if (showSelectMode) {
                        setSelectedStocks(new Set());
                      }
                    }}
                    title={showSelectMode ? '取消选择' : '批量选择'}
                  >
                    {showSelectMode ? <X size={14} /> : <CheckSquare size={14} />}
                  </button>
                  <button
                    className={`${styles.toolBtn} ${showColumnPanel ? styles.active : ''}`}
                    onClick={() => setShowColumnPanel((prev) => !prev)}
                    title="列设置"
                  >
                    <Columns3 size={14} />
                  </button>
                  <button
                    className={`${styles.toolBtn} ${showAlertPanel ? styles.active : ''}`}
                    onClick={() => setShowAlertPanel((prev) => !prev)}
                    title="告警中心"
                  >
                    <Bell size={14} />
                  </button>
                </>
              )}
            </div>
          }
        >
          {!isEmptyGroup && quotes.size === 0 ? (
            quotesError ? (
              <Empty title="行情加载失败" description="网络异常，将按刷新间隔自动重试" />
            ) : (
              <Loading text="加载中..." />
            )
          ) : activeCodes.length === 0 ? (
            <Empty
              title="暂无自选股"
              description="搜索添加股票到当前分组"
              action={
                <Button size="sm" onClick={() => setShowImportModal(true)}>
                  <Upload size={14} />
                  导入股票
                </Button>
              }
            />
          ) : (
            <>
              {showColumnPanel && (
                <div className={styles.columnPanel}>
                  {columns.map((column) => (
                    <label key={column.key} className={styles.columnOption}>
                      <input
                        type="checkbox"
                        checked={column.visible}
                        onChange={() => handleToggleColumn(column.key)}
                      />
                      <span>{column.label}</span>
                    </label>
                  ))}
                </div>
              )}

              {showAlertPanel && (
                <div className={styles.alertPanel}>
                  {groupAlerts.length === 0 ? (
                    <span className={styles.alertEmpty}>当前分组暂无本地告警</span>
                  ) : (
                    groupAlerts.map((rule) => (
                      <div key={rule.id} className={styles.alertRow}>
                        <div className={styles.alertInfo}>
                          <span className={styles.alertName}>{rule.name}</span>
                          <span className={styles.alertDesc}>{formatAlertRule(rule)}</span>
                        </div>
                        <button
                          className={styles.alertRemoveBtn}
                          onClick={() => watchlistActions.deleteAlert(rule.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* 排序栏 */}
              <div className={styles.sortBar}>
                <div className={styles.sortSection}>
                  <ArrowUpDown size={14} />
                  <span className={styles.sortLabel}>排序：</span>
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.field}
                      className={`${styles.sortOption} ${sortField === option.field ? styles.active : ''}`}
                      onClick={() => handleSortChange(option.field)}
                    >
                      {option.label}
                      {sortField === option.field && option.field !== 'default' && (
                        sortOrder === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />
                      )}
                    </button>
                  ))}
                </div>
                {showSelectMode && (
                  <div className={styles.batchSection}>
                    <button className={styles.selectAllBtn} onClick={handleSelectAll}>
                      {selectedStocks.size === normalizedActiveCodes.length ? '取消全选' : '全选'}
                    </button>
                    <button
                      className={styles.batchDeleteBtn}
                      onClick={handleBatchDelete}
                      disabled={selectedStocks.size === 0}
                    >
                      <Trash2 size={14} />
                      删除 ({selectedStocks.size})
                    </button>
                  </div>
                )}
              </div>

              <div className={styles.stockTable}>
                <div className={styles.tableHeader}>
                  {showSelectMode && <span className={styles.colSelect}></span>}
                  {sortField === 'default' && <span className={styles.colDrag}></span>}
                  {visibleColumns.includes('name') && (
                    <span className={styles.colName}>名称/代码</span>
                  )}
                  {visibleColumns.includes('price') && (
                    <span className={styles.colPrice}>现价</span>
                  )}
                  {visibleColumns.includes('change') && (
                    <span className={styles.colChange}>涨跌幅</span>
                  )}
                  {visibleColumns.includes('amount') && (
                    <span className={styles.colAmount}>成交额</span>
                  )}
                  {visibleColumns.includes('turnover') && (
                    <span className={styles.colTurnover}>换手</span>
                  )}
                  <span className={styles.colAction}>操作</span>
                </div>

                <div className={styles.tableBody}>
                  <AnimatePresence>
                    {sortedStocks.map((quote) => {
                      const rowCode = normalizeStockCode(quote.code);
                      const isSelected = selectedStocks.has(rowCode);
                      return (
                        <motion.div
                          key={quote.code}
                          className={`${styles.tableRow} ${isSelected ? styles.selected : ''} ${draggedCode === rowCode ? styles.dragging : ''}`}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          onClick={() => !showSelectMode && handleStockClick(quote.code)}
                          draggable={sortField === 'default' && !showSelectMode}
                          onDragStart={() => handleDragStart(rowCode)}
                          onDragOver={(e) => handleDragOver(e, rowCode)}
                          onDrop={handleDrop}
                          onDragEnd={handleDragEnd}
                        >
                          {showSelectMode && (
                            <div className={styles.colSelect}>
                              <button
                                className={styles.selectBtn}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleSelect(rowCode);
                                }}
                              >
                                {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                              </button>
                            </div>
                          )}
                          {sortField === 'default' && !showSelectMode && (
                            <div className={styles.colDrag}>
                              <GripVertical size={14} className={styles.dragHandle} />
                            </div>
                          )}
                          {visibleColumns.includes('name') && (
                            <div className={styles.colName}>
                              <span className={styles.stockName}>{quote.name}</span>
                              <span className={styles.stockCode}>{quote.code}</span>
                            </div>
                          )}
                          {visibleColumns.includes('price') && (
                            <span className={`${styles.colPrice} ${getChangeColorClass(quote.changePercent)}`}>
                              {formatPrice(quote.price)}
                            </span>
                          )}
                          {visibleColumns.includes('change') && (
                            <span className={`${styles.colChange} ${getChangeColorClass(quote.changePercent)}`}>
                              {formatPercent(quote.changePercent)}
                            </span>
                          )}
                          {visibleColumns.includes('amount') && (
                            <span className={styles.colAmount}>
                              {formatAmount(quote.amount)}
                            </span>
                          )}
                          {visibleColumns.includes('turnover') && (
                            <span className={styles.colTurnover}>
                              {formatTurnover(quote.turnoverRate)}
                            </span>
                          )}
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
            </>
          )}
        </Card>

        {/* 导入弹窗 */}
        <AnimatePresence>
          {showImportModal && (
            <motion.div
              className={styles.modalOverlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowImportModal(false)}
            >
              <motion.div
                className={styles.modal}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={styles.modalHeader}>
                  <h3>导入股票</h3>
                  <button className={styles.modalClose} onClick={() => setShowImportModal(false)}>
                    <X size={18} />
                  </button>
                </div>
                <div className={styles.modalBody}>
                  <p className={styles.modalHint}>
                    输入股票代码，支持以下格式：
                    <br />
                    • 纯代码：000001, 600000
                    <br />
                    • 带市场：sh600000, sz000001
                    <br />
                    • 多个代码用逗号、空格或换行分隔
                  </p>
                  <textarea
                    className={styles.importTextarea}
                    placeholder="请输入股票代码..."
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    rows={6}
                  />
                </div>
                <div className={styles.modalFooter}>
                  <Button variant="ghost" onClick={() => setShowImportModal(false)}>
                    取消
                  </Button>
                  <Button variant="primary" onClick={handleImport}>
                    导入
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
