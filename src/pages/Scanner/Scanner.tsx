/**
 * 扫描页面
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ScanLine, Play, Plus, Check } from 'lucide-react';
import { Card, Button, Tabs, Empty, useToast } from '@/components/common';
import { addToWatchlist, getAllWatchlistCodes, isInWatchlist } from '@/services/storage';
import { getIndustryConstituents, getConceptConstituents, getKlineWithIndicators } from '@/services/sdk';
import styles from './Scanner.module.css';

// 信号模板
const SIGNAL_TEMPLATES = [
  { key: 'ma_golden', label: 'MA金叉', desc: '短期均线上穿长期均线' },
  { key: 'ma_death', label: 'MA死叉', desc: '短期均线下穿长期均线' },
  { key: 'macd_golden', label: 'MACD金叉', desc: 'DIF上穿DEA' },
  { key: 'macd_death', label: 'MACD死叉', desc: 'DIF下穿DEA' },
  { key: 'rsi_oversold', label: 'RSI超卖', desc: 'RSI低于30' },
  { key: 'rsi_overbought', label: 'RSI超买', desc: 'RSI高于70' },
  { key: 'boll_upper', label: 'BOLL突破上轨', desc: '价格突破布林带上轨' },
  { key: 'boll_lower', label: 'BOLL跌破下轨', desc: '价格跌破布林带下轨' },
];

// 股票池来源
const POOL_SOURCES = [
  { key: 'watchlist', label: '自选股' },
  { key: 'industry', label: '行业板块' },
  { key: 'concept', label: '概念板块' },
  { key: 'ranking', label: '榜单TopN' },
];

interface ScanResult {
  code: string;
  name: string;
  signal: string;
  time: string;
  added?: boolean;
}

export function Scanner() {
  const navigate = useNavigate();
  const toast = useToast();

  const [selectedSignals, setSelectedSignals] = useState<string[]>(['ma_golden']);
  const [poolSource, setPoolSource] = useState('watchlist');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<ScanResult[]>([]);

  // 切换信号
  const toggleSignal = (key: string) => {
    setSelectedSignals((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // 检测信号
  const detectSignals = useCallback((klineData: Array<{ ma?: Record<string, number>; macd?: Record<string, number>; rsi?: Record<string, number>; close: number; boll?: Record<string, number> }>, signals: string[]): string[] => {
    const detected: string[] = [];
    if (klineData.length < 3) return detected;
    
    const latest = klineData[klineData.length - 1];
    const prev = klineData[klineData.length - 2];
    
    // MA 金叉/死叉
    if (signals.includes('ma_golden') && latest.ma && prev.ma) {
      if (latest.ma.ma5 > latest.ma.ma10 && prev.ma.ma5 <= prev.ma.ma10) {
        detected.push('MA金叉');
      }
    }
    if (signals.includes('ma_death') && latest.ma && prev.ma) {
      if (latest.ma.ma5 < latest.ma.ma10 && prev.ma.ma5 >= prev.ma.ma10) {
        detected.push('MA死叉');
      }
    }
    
    // MACD 金叉/死叉
    if (signals.includes('macd_golden') && latest.macd && prev.macd) {
      if (latest.macd.dif > latest.macd.dea && prev.macd.dif <= prev.macd.dea) {
        detected.push('MACD金叉');
      }
    }
    if (signals.includes('macd_death') && latest.macd && prev.macd) {
      if (latest.macd.dif < latest.macd.dea && prev.macd.dif >= prev.macd.dea) {
        detected.push('MACD死叉');
      }
    }
    
    // RSI 超买/超卖
    if (signals.includes('rsi_oversold') && latest.rsi) {
      if (latest.rsi.rsi6 < 30 || latest.rsi.rsi12 < 30) {
        detected.push('RSI超卖');
      }
    }
    if (signals.includes('rsi_overbought') && latest.rsi) {
      if (latest.rsi.rsi6 > 70 || latest.rsi.rsi12 > 70) {
        detected.push('RSI超买');
      }
    }
    
    // BOLL 突破
    if (signals.includes('boll_upper') && latest.boll) {
      if (latest.close > latest.boll.upper) {
        detected.push('BOLL突破上轨');
      }
    }
    if (signals.includes('boll_lower') && latest.boll) {
      if (latest.close < latest.boll.lower) {
        detected.push('BOLL跌破下轨');
      }
    }
    
    return detected;
  }, []);

  // 开始扫描
  const handleScan = async () => {
    setIsScanning(true);
    setResults([]);
    setScanProgress({ current: 0, total: 0 });
    
    try {
      // 获取股票池
      let stockPool: Array<{ code: string; name: string }> = [];
      
      if (poolSource === 'watchlist') {
        const codes = getAllWatchlistCodes();
        stockPool = codes.map(code => ({ code, name: code }));
      } else if (poolSource === 'industry') {
        // 获取热门行业成分股
        const constituents = await getIndustryConstituents('BK0475'); // 软件开发
        stockPool = constituents.slice(0, 30).map(c => ({ code: c.code, name: c.name }));
      } else if (poolSource === 'concept') {
        const constituents = await getConceptConstituents('BK0891'); // AI概念
        stockPool = constituents.slice(0, 30).map(c => ({ code: c.code, name: c.name }));
      } else {
        // 榜单 TopN - 使用行业龙头
        const constituents = await getIndustryConstituents('BK0475');
        stockPool = constituents.slice(0, 20).map(c => ({ code: c.code, name: c.name }));
      }
      
      if (stockPool.length === 0) {
        setIsScanning(false);
        toast.info('股票池为空，请选择其他股票池或添加自选股');
        return;
      }
      
      setScanProgress({ current: 0, total: stockPool.length });
      const newResults: ScanResult[] = [];
      const now = new Date().toLocaleString('zh-CN', { hour12: false });
      
      // 逐个扫描
      for (let i = 0; i < stockPool.length; i++) {
        const stock = stockPool[i];
        setScanProgress({ current: i + 1, total: stockPool.length });
        
        try {
          // 获取 K 线数据
          const klineData = await getKlineWithIndicators(stock.code, {
            period: 'daily',
            adjust: 'qfq',
            indicators: {
              ma: selectedSignals.some(s => s.startsWith('ma_')),
              macd: selectedSignals.some(s => s.startsWith('macd_')),
              rsi: selectedSignals.some(s => s.startsWith('rsi_')),
              boll: selectedSignals.some(s => s.startsWith('boll_')),
            },
          });
          
          // 检测信号
          const detected = detectSignals(klineData as Array<{ ma?: Record<string, number>; macd?: Record<string, number>; rsi?: Record<string, number>; close: number; boll?: Record<string, number> }>, selectedSignals);
          
          if (detected.length > 0) {
            newResults.push({
              code: stock.code,
              name: stock.name,
              signal: detected.join(', '),
              time: now,
              added: isInWatchlist(stock.code),
            });
          }
        } catch (err) {
          console.error(`Scan error for ${stock.code}:`, err);
        }
        
        // 更新中间结果
        if (newResults.length > 0 && i % 5 === 0) {
          setResults([...newResults]);
        }
      }
      
      setResults(newResults);
    } catch (error) {
      console.error('Scan error:', error);
    }
    
    setIsScanning(false);
  };

  // 跳转详情
  const handleStockClick = (code: string) => {
    navigate(`/s/${code}`);
  };

  // 加入自选
  const handleAddWatchlist = (code: string, name: string, index: number) => {
    addToWatchlist(code);
    setResults(prev => prev.map((r, i) => i === index ? { ...r, added: true } : r));
    toast.success(`已将 ${name} 加入自选`);
  };

  return (
    <div className={styles.scanner}>
      <motion.div
        className={styles.header}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className={styles.title}>
          <ScanLine size={24} />
          信号扫描
        </h1>
        <p className={styles.subtitle}>
          使用技术指标规则从股票池中筛选触发信号的标的
        </p>
      </motion.div>

      <div className={styles.content}>
        {/* 配置区 */}
        <div className={styles.configSection}>
          {/* 股票池选择 */}
          <Card title="股票池来源">
            <Tabs
              items={POOL_SOURCES}
              activeKey={poolSource}
              onChange={setPoolSource}
            />
          </Card>

          {/* 信号选择 */}
          <Card title="信号模板">
            <div className={styles.signalGrid}>
              {SIGNAL_TEMPLATES.map((signal) => (
                <button
                  key={signal.key}
                  className={`${styles.signalCard} ${selectedSignals.includes(signal.key) ? styles.active : ''}`}
                  onClick={() => toggleSignal(signal.key)}
                >
                  <span className={styles.signalLabel}>{signal.label}</span>
                  <span className={styles.signalDesc}>{signal.desc}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* 扫描按钮 */}
          <Button
            variant="primary"
            size="lg"
            block
            icon={<Play size={18} />}
            loading={isScanning}
            onClick={handleScan}
            disabled={selectedSignals.length === 0}
          >
            {isScanning 
              ? `扫描中 (${scanProgress.current}/${scanProgress.total})...` 
              : '开始扫描'}
          </Button>
        </div>

        {/* 结果区 */}
        <div className={styles.resultSection}>
          <Card title="扫描结果" extra={<span className={styles.resultCount}>{results.length} 个触发</span>}>
            {results.length === 0 ? (
              <Empty
                icon={<ScanLine size={48} strokeWidth={1} />}
                title={isScanning ? '正在扫描...' : '暂无扫描结果'}
                description={isScanning ? `已扫描 ${scanProgress.current}/${scanProgress.total}` : '选择信号模板并点击开始扫描'}
              />
            ) : (
              <div className={styles.resultList}>
                {results.map((item, index) => (
                  <div
                    key={item.code}
                    className={styles.resultItem}
                    onClick={() => handleStockClick(item.code)}
                  >
                    <div className={styles.resultInfo}>
                      <span className={styles.resultName}>{item.name}</span>
                      <span className={styles.resultCode}>{item.code}</span>
                    </div>
                    <div className={styles.resultSignal}>
                      <span className={styles.signalTag}>{item.signal}</span>
                      <span className={styles.resultTime}>{item.time}</span>
                    </div>
                    <button
                      className={`${styles.addBtn} ${item.added ? styles.added : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!item.added) {
                          handleAddWatchlist(item.code, item.name, index);
                        }
                      }}
                      disabled={item.added}
                    >
                      {item.added ? <Check size={14} /> : <Plus size={14} />}
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
