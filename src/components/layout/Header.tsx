/**
 * 顶部导航栏组件
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  Clock,
  TrendingUp,
  Building2,
  Lightbulb,
  RefreshCw,
  Star,
  Check,
  Sun,
  Moon,
  Github,
  Database,
} from 'lucide-react';
import { search as searchApi, resolveSearchRoute } from '@/services/sdk';
import {
  getSearchHistory,
  addSearchHistory,
  clearSearchHistory,
} from '@/services/storage';
import { watchlistActions } from '@/services/watchlistStore';
import { useToast } from '@/components/common';
import { useIsInWatchlist, useTheme } from '@/hooks';
import type { SearchHistoryItem } from '@/types';
import type { AppSearchResult } from '@/services/sdk';
import styles from './Header.module.css';

function getHistoryRoute(item: SearchHistoryItem): string | null {
  return resolveSearchRoute(item).route;
}

export function Header() {
  const navigate = useNavigate();
  const toast = useToast();
  const { theme, toggleTheme } = useTheme();
  const [keyword, setKeyword] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<AppSearchResult[]>([]);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);
  // 请求序号：旧关键词的慢响应后到会覆盖新结果，回车就会跳错股票
  const searchSeqRef = useRef(0);

  const cancelPendingSearch = useCallback(() => {
    searchSeqRef.current += 1;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  useEffect(() => cancelPendingSearch, [cancelPendingSearch]);

  // 快速加自选
  const handleQuickAdd = (e: React.MouseEvent, item: AppSearchResult) => {
    e.stopPropagation();
    if (!item.isSupported || item.entityType !== 'stock') {
      toast.info('当前结果暂不支持加入自选');
      return;
    }
    if (checkIsInWatchlist(item.code)) {
      toast.info('已在自选中');
      return;
    }
    watchlistActions.add(item.code);
    toast.success(`已将 ${item.name} 加入自选`);
  };

  // 检查是否已在自选
  const checkIsInWatchlist = useIsInWatchlist();

  // 加载搜索历史
  useEffect(() => {
    setHistory(getSearchHistory());
  }, []);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const doSearch = useCallback(async (kw: string) => {
    if (!kw.trim()) {
      setResults([]);
      return;
    }

    const seq = ++searchSeqRef.current;
    setIsLoading(true);
    try {
      const data = await searchApi(kw);
      if (searchSeqRef.current !== seq) return;
      setResults(data);
    } catch (error) {
      if (searchSeqRef.current !== seq) return;
      console.error('Search error:', error);
      setResults([]);
    } finally {
      if (searchSeqRef.current === seq) {
        setIsLoading(false);
      }
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setKeyword(value);
    setActiveIndex(-1);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      doSearch(value);
    }, 300);
  };

  // 选择结果
  const handleSelect = (item: AppSearchResult) => {
    if (!item.isSupported || !item.route) {
      toast.info(`${item.name} 暂未接入当前看板详情页`);
      return;
    }

    addSearchHistory({
      code: item.code,
      name: item.name,
      market: item.market,
      type: item.type,
    });
    setHistory(getSearchHistory());
    cancelPendingSearch();
    setKeyword('');
    setIsOpen(false);
    setResults([]);
    navigate(item.route);
  };

  // 选择历史
  const handleSelectHistory = (item: SearchHistoryItem) => {
    const route = getHistoryRoute(item);
    if (!route) {
      toast.info(`${item.name} 暂未接入当前看板详情页`);
      return;
    }

    setKeyword('');
    setIsOpen(false);
    setResults([]);
    navigate(route);
  };

  // 清除历史
  const handleClearHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearSearchHistory();
    setHistory([]);
  };

  // 键盘导航
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const items = keyword ? results : history;
    const maxIndex = items.length - 1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < maxIndex ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : maxIndex));
    } else if (e.key === 'Enter') {
      e.preventDefault();
        if (activeIndex >= 0 && items[activeIndex]) {
          if (keyword) {
            handleSelect(items[activeIndex] as AppSearchResult);
          } else {
            handleSelectHistory(items[activeIndex] as SearchHistoryItem);
          }
      } else if (results.length > 0) {
        handleSelect(results[0]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  // 获取图标
  const getTypeIcon = (type: string) => {
    switch (type) {
      case '行业板块':
        return <Building2 size={14} />;
      case '概念板块':
        return <Lightbulb size={14} />;
      default:
        return <TrendingUp size={14} />;
    }
  };

  const showDropdown = isOpen && (keyword ? results.length > 0 : history.length > 0);

  return (
    <header className={styles.header}>
      <div className={styles.searchContainer} ref={containerRef}>
        <div className={styles.searchInputWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input
            ref={inputRef}
            type="text"
            className={styles.searchInput}
            placeholder="搜索股票、板块..."
            value={keyword}
            onChange={handleInputChange}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
          />
          {keyword && (
            <button
              className={styles.clearBtn}
              onClick={() => {
                cancelPendingSearch();
                setKeyword('');
                setResults([]);
                inputRef.current?.focus();
              }}
            >
              <X size={14} />
            </button>
          )}
          {isLoading && <RefreshCw size={14} className={styles.loadingIcon} />}
        </div>

        <AnimatePresence>
          {showDropdown && (
            <motion.div
              className={styles.dropdown}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {keyword ? (
                // 搜索结果
                <div className={styles.resultList}>
                  {results.map((item, index) => (
                    <div
                      key={item.code}
                      className={`${styles.resultItem} ${
                        !item.isSupported ? styles.unsupported : ''
                      } ${
                        index === activeIndex ? styles.active : ''
                      }`}
                      onClick={() => handleSelect(item)}
                    >
                      <span className={styles.typeIcon}>
                        {getTypeIcon(item.type)}
                      </span>
                      <span className={styles.itemName}>{item.name}</span>
                      <span className={styles.itemCode}>{item.code}</span>
                      <span className={styles.itemType}>
                        {item.isSupported ? item.typeLabel : '暂不支持'}
                      </span>
                      {/* 股票类型显示快速加自选按钮 */}
                      {item.entityType === 'stock' && item.isSupported && (
                        <button
                          className={`${styles.quickAddBtn} ${checkIsInWatchlist(item.code) ? styles.added : ''}`}
                          onClick={(e) => handleQuickAdd(e, item)}
                          title={checkIsInWatchlist(item.code) ? '已在自选' : '加入自选'}
                        >
                          {checkIsInWatchlist(item.code) ? <Check size={14} /> : <Star size={14} />}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                // 搜索历史
                <div className={styles.historyList}>
                  <div className={styles.historyHeader}>
                    <span className={styles.historyTitle}>
                      <Clock size={12} />
                      最近搜索
                    </span>
                    <button
                      className={styles.clearHistoryBtn}
                      onClick={handleClearHistory}
                    >
                      清除
                    </button>
                  </div>
                  {history.map((item, index) => (
                    <div
                      key={item.code}
                      className={`${styles.resultItem} ${
                        index === activeIndex ? styles.active : ''
                      }`}
                      onClick={() => handleSelectHistory(item)}
                    >
                      <span className={styles.typeIcon}>
                        {getTypeIcon(item.type)}
                      </span>
                      <span className={styles.itemName}>{item.name}</span>
                      <span className={styles.itemCode}>{item.code}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className={styles.right}>
        <button
          className={styles.themeBtn}
          onClick={toggleTheme}
          title={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <a
          href="https://stock-sdk.linkdiary.cn/"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.sdkLink}
          title="Stock SDK"
        >
          <Database size={18} />
        </a>
        <a
          href="https://github.com/chengzuopeng/stock-dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.githubLink}
          title="GitHub"
        >
          <Github size={18} />
        </a>
      </div>
    </header>
  );
}
