/**
 * 设置页面
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Palette, BarChart2, Info } from 'lucide-react';
import { Card } from '@/components/common';
import { getSettings, saveSettings } from '@/services/storage';
import type { AppSettings } from '@/types';
import styles from './Settings.module.css';

export function Settings() {
  const [settings, setSettings] = useState<AppSettings>(getSettings);

  // 更新设置
  const updateSettings = (updates: Partial<AppSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    saveSettings(newSettings);

    // 应用颜色模式
    if (updates.colorMode) {
      document.documentElement.setAttribute(
        'data-color-mode',
        updates.colorMode === 'green-rise' ? 'green-rise' : ''
      );
    }
  };

  // 初始化颜色模式
  useEffect(() => {
    if (settings.colorMode === 'green-rise') {
      document.documentElement.setAttribute('data-color-mode', 'green-rise');
    }
  }, [settings.colorMode]);

  return (
    <div className={styles.settings}>
      <motion.h1
        className={styles.title}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        设置
      </motion.h1>

      {/* 刷新频率 */}
      <Card>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <RefreshCw size={18} className={styles.sectionIcon} />
            <h3>刷新频率</h3>
          </div>
          <div className={styles.sectionContent}>
            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>列表/自选</span>
                <span className={styles.settingDesc}>自选股、榜单等列表数据的刷新间隔</span>
              </div>
              <select
                className={styles.select}
                value={settings.refreshInterval.list}
                onChange={(e) =>
                  updateSettings({
                    refreshInterval: {
                      ...settings.refreshInterval,
                      list: Number(e.target.value),
                    },
                  })
                }
              >
                <option value={0}>默认</option>
                <option value={5000}>5秒</option>
                <option value={10000}>10秒</option>
                <option value={30000}>30秒</option>
              </select>
            </div>

            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>个股详情</span>
                <span className={styles.settingDesc}>行情报价、盘口等实时数据的刷新间隔</span>
              </div>
              <select
                className={styles.select}
                value={settings.refreshInterval.detail}
                onChange={(e) =>
                  updateSettings({
                    refreshInterval: {
                      ...settings.refreshInterval,
                      detail: Number(e.target.value),
                    },
                  })
                }
              >
                <option value={5000}>5秒</option>
                <option value={10000}>10秒</option>
                <option value={15000}>15秒</option>
                <option value={30000}>30秒</option>
              </select>
            </div>

            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>热力图</span>
                <span className={styles.settingDesc}>板块/个股热力图的刷新间隔</span>
              </div>
              <select
                className={styles.select}
                value={settings.refreshInterval.heatmap}
                onChange={(e) =>
                  updateSettings({
                    refreshInterval: {
                      ...settings.refreshInterval,
                      heatmap: Number(e.target.value),
                    },
                  })
                }
              >
                <option value={5000}>5秒</option>
                <option value={10000}>10秒</option>
                <option value={15000}>15秒</option>
                <option value={30000}>30秒</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* 色彩模式 */}
      <Card>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <Palette size={18} className={styles.sectionIcon} />
            <h3>色彩模式</h3>
          </div>
          <div className={styles.sectionContent}>
            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>涨跌颜色</span>
                <span className={styles.settingDesc}>设置涨跌所使用的颜色方案</span>
              </div>
              <div className={styles.colorModeOptions}>
                <button
                  className={`${styles.colorModeBtn} ${settings.colorMode === 'red-rise' ? styles.active : ''}`}
                  onClick={() => updateSettings({ colorMode: 'red-rise' })}
                >
                  <span className={styles.riseRed}>涨</span>
                  <span className={styles.fallGreen}>跌</span>
                  红涨绿跌
                </button>
                <button
                  className={`${styles.colorModeBtn} ${settings.colorMode === 'green-rise' ? styles.active : ''}`}
                  onClick={() => updateSettings({ colorMode: 'green-rise' })}
                >
                  <span className={styles.riseGreen}>涨</span>
                  <span className={styles.fallRed}>跌</span>
                  绿涨红跌
                </button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 指标默认参数 */}
      <Card>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <BarChart2 size={18} className={styles.sectionIcon} />
            <h3>指标参数</h3>
          </div>
          <div className={styles.sectionContent}>
            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>MA 均线</span>
                <span className={styles.settingDesc}>移动平均线周期设置</span>
              </div>
              <span className={styles.paramValue}>
                {settings.indicatorConfig.ma.join(', ')}
              </span>
            </div>

            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>MACD</span>
                <span className={styles.settingDesc}>MACD 指标参数</span>
              </div>
              <span className={styles.paramValue}>
                {settings.indicatorConfig.macd.short}, {settings.indicatorConfig.macd.long}, {settings.indicatorConfig.macd.signal}
              </span>
            </div>

            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>BOLL</span>
                <span className={styles.settingDesc}>布林带参数</span>
              </div>
              <span className={styles.paramValue}>
                周期: {settings.indicatorConfig.boll.period}, 标准差: {settings.indicatorConfig.boll.stdDev}
              </span>
            </div>

            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>RSI</span>
                <span className={styles.settingDesc}>相对强弱指标周期</span>
              </div>
              <span className={styles.paramValue}>
                {settings.indicatorConfig.rsi.join(', ')}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* 关于 */}
      <Card>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <Info size={18} className={styles.sectionIcon} />
            <h3>关于</h3>
          </div>
          <div className={styles.sectionContent}>
            <div className={styles.aboutInfo}>
              <p><strong>A股看板</strong> v1.0.0</p>
              <p className={styles.aboutDesc}>
                纯前端 A 股行情看板，数据来源于腾讯财经与东方财富。
              </p>
              <p className={styles.aboutNote}>
                <strong>数据说明：</strong>
              </p>
              <ul className={styles.noteList}>
                <li>成交量单位：手（1手=100股）</li>
                <li>成交额单位：万元</li>
                <li>市值单位：亿元</li>
                <li>分时图成交量/额为累计值</li>
              </ul>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
