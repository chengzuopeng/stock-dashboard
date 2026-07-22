/**
 * 设置页面
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Palette, BarChart2, Info } from 'lucide-react';
import { Card, NumberField } from '@/components/common';
import { useAppSettings } from '@/contexts';
import styles from './Settings.module.css';

function parsePeriods(value: string, fallback: number[]) {
  const periods = value
    .split(/[，,\s]+/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);

  return periods.length > 0 ? periods : fallback;
}

function IndicatorNumberInput({
  value,
  min = 1,
  step,
  onChange,
}: {
  value: number;
  min?: number;
  step?: number | string;
  onChange: (value: number) => void;
}) {
  return (
    <NumberField
      className={styles.numberInput}
      value={value}
      min={min}
      step={step}
      onCommit={(v) => {
        if (v !== null) onChange(v);
      }}
    />
  );
}

export function Settings() {
  const { settings, updateSettings } = useAppSettings();
  const [maDraft, setMaDraft] = useState(settings.indicatorConfig.ma.join(', '));
  const [rsiDraft, setRsiDraft] = useState(settings.indicatorConfig.rsi.join(', '));

  const updateIndicatorConfig = (
    updates: Partial<typeof settings.indicatorConfig>
  ) => {
    updateSettings({
      indicatorConfig: {
        ...settings.indicatorConfig,
        ...updates,
      },
    });
  };

  return (
    <div className={styles.settings}>
      <motion.h1
        className={styles.title}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        设置
      </motion.h1>

      <Card>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <RefreshCw size={18} className={styles.sectionIcon} />
            <h3>刷新频率</h3>
          </div>
          <div className={styles.sectionContent}>
            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>列表 / 自选</span>
                <span className={styles.settingDesc}>总览、自选、扫描等列表数据刷新间隔</span>
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
                <option value={15000}>15秒</option>
                <option value={30000}>30秒</option>
              </select>
            </div>

            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>个股详情</span>
                <span className={styles.settingDesc}>详情页行情、分时、K 线相关刷新间隔</span>
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
                <span className={styles.settingDesc}>热力图个股数据刷新间隔</span>
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
                <span className={styles.settingDesc}>全局页面和热力图默认使用同一颜色模式</span>
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

      <Card>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <BarChart2 size={18} className={styles.sectionIcon} />
            <h3>指标参数</h3>
          </div>
          <div className={styles.sectionContent}>
            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>MA 周期</span>
                <span className={styles.settingDesc}>逗号分隔，默认用于详情页均线</span>
              </div>
              <input
                className={styles.textInput}
                value={maDraft}
                onChange={(e) => setMaDraft(e.target.value)}
                onBlur={() => {
                  const next = parsePeriods(maDraft, settings.indicatorConfig.ma);
                  setMaDraft(next.join(', '));
                  updateIndicatorConfig({ ma: next });
                }}
              />
            </div>

            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>MACD</span>
                <span className={styles.settingDesc}>短 / 长 / 信号</span>
              </div>
              <div className={styles.inlineInputs}>
                <IndicatorNumberInput
                  value={settings.indicatorConfig.macd.short}
                  onChange={(v) =>
                    updateIndicatorConfig({
                      macd: { ...settings.indicatorConfig.macd, short: v },
                    })
                  }
                />
                <IndicatorNumberInput
                  value={settings.indicatorConfig.macd.long}
                  onChange={(v) =>
                    updateIndicatorConfig({
                      macd: { ...settings.indicatorConfig.macd, long: v },
                    })
                  }
                />
                <IndicatorNumberInput
                  value={settings.indicatorConfig.macd.signal}
                  onChange={(v) =>
                    updateIndicatorConfig({
                      macd: { ...settings.indicatorConfig.macd, signal: v },
                    })
                  }
                />
              </div>
            </div>

            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>BOLL</span>
                <span className={styles.settingDesc}>周期 / 标准差</span>
              </div>
              <div className={styles.inlineInputs}>
                <IndicatorNumberInput
                  value={settings.indicatorConfig.boll.period}
                  onChange={(v) =>
                    updateIndicatorConfig({
                      boll: { ...settings.indicatorConfig.boll, period: v },
                    })
                  }
                />
                <IndicatorNumberInput
                  value={settings.indicatorConfig.boll.stdDev}
                  min={0.1}
                  step="0.1"
                  onChange={(v) =>
                    updateIndicatorConfig({
                      boll: { ...settings.indicatorConfig.boll, stdDev: v },
                    })
                  }
                />
              </div>
            </div>

            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>KDJ</span>
                <span className={styles.settingDesc}>周期 / K / D</span>
              </div>
              <div className={styles.inlineInputs}>
                <IndicatorNumberInput
                  value={settings.indicatorConfig.kdj.period}
                  onChange={(v) =>
                    updateIndicatorConfig({
                      kdj: { ...settings.indicatorConfig.kdj, period: v },
                    })
                  }
                />
                <IndicatorNumberInput
                  value={settings.indicatorConfig.kdj.kPeriod}
                  onChange={(v) =>
                    updateIndicatorConfig({
                      kdj: { ...settings.indicatorConfig.kdj, kPeriod: v },
                    })
                  }
                />
                <IndicatorNumberInput
                  value={settings.indicatorConfig.kdj.dPeriod}
                  onChange={(v) =>
                    updateIndicatorConfig({
                      kdj: { ...settings.indicatorConfig.kdj, dPeriod: v },
                    })
                  }
                />
              </div>
            </div>

            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>RSI 周期</span>
                <span className={styles.settingDesc}>逗号分隔，默认用于详情页 RSI</span>
              </div>
              <input
                className={styles.textInput}
                value={rsiDraft}
                onChange={(e) => setRsiDraft(e.target.value)}
                onBlur={() => {
                  const next = parsePeriods(rsiDraft, settings.indicatorConfig.rsi);
                  setRsiDraft(next.join(', '));
                  updateIndicatorConfig({ rsi: next });
                }}
              />
            </div>

            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>DMI / ADX</span>
                <span className={styles.settingDesc}>默认趋势强度参数</span>
              </div>
              <div className={styles.inlineInputs}>
                <IndicatorNumberInput
                  value={settings.indicatorConfig.dmi.period}
                  onChange={(v) =>
                    updateIndicatorConfig({
                      dmi: { ...settings.indicatorConfig.dmi, period: v },
                    })
                  }
                />
                <IndicatorNumberInput
                  value={settings.indicatorConfig.dmi.adxPeriod}
                  onChange={(v) =>
                    updateIndicatorConfig({
                      dmi: { ...settings.indicatorConfig.dmi, adxPeriod: v },
                    })
                  }
                />
              </div>
            </div>

            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>SAR</span>
                <span className={styles.settingDesc}>起始 / 增量 / 最大加速</span>
              </div>
              <div className={styles.inlineInputs}>
                <IndicatorNumberInput
                  value={settings.indicatorConfig.sar.afStart}
                  min={0.01}
                  step="0.01"
                  onChange={(v) =>
                    updateIndicatorConfig({
                      sar: { ...settings.indicatorConfig.sar, afStart: v },
                    })
                  }
                />
                <IndicatorNumberInput
                  value={settings.indicatorConfig.sar.afIncrement}
                  min={0.01}
                  step="0.01"
                  onChange={(v) =>
                    updateIndicatorConfig({
                      sar: { ...settings.indicatorConfig.sar, afIncrement: v },
                    })
                  }
                />
                <IndicatorNumberInput
                  value={settings.indicatorConfig.sar.afMax}
                  min={0.01}
                  step="0.01"
                  onChange={(v) =>
                    updateIndicatorConfig({
                      sar: { ...settings.indicatorConfig.sar, afMax: v },
                    })
                  }
                />
              </div>
            </div>

            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>KC</span>
                <span className={styles.settingDesc}>EMA / ATR / 倍数</span>
              </div>
              <div className={styles.inlineInputs}>
                <IndicatorNumberInput
                  value={settings.indicatorConfig.kc.emaPeriod}
                  onChange={(v) =>
                    updateIndicatorConfig({
                      kc: { ...settings.indicatorConfig.kc, emaPeriod: v },
                    })
                  }
                />
                <IndicatorNumberInput
                  value={settings.indicatorConfig.kc.atrPeriod}
                  onChange={(v) =>
                    updateIndicatorConfig({
                      kc: { ...settings.indicatorConfig.kc, atrPeriod: v },
                    })
                  }
                />
                <IndicatorNumberInput
                  value={settings.indicatorConfig.kc.multiplier}
                  min={0.1}
                  step="0.1"
                  onChange={(v) =>
                    updateIndicatorConfig({
                      kc: { ...settings.indicatorConfig.kc, multiplier: v },
                    })
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <Info size={18} className={styles.sectionIcon} />
            <h3>关于</h3>
          </div>
          <div className={styles.sectionContent}>
            <div className={styles.aboutInfo}>
              <p><strong>A 股看板</strong> v1.1.0</p>
              <p className={styles.aboutDesc}>
                纯前端行情看板，核心数据能力来自 <strong>stock-sdk v2</strong>。
              </p>
              <p className={styles.aboutNote}>
                <strong>数据说明：</strong>
              </p>
              <ul className={styles.noteList}>
                <li>成交量单位：手（1手=100股）</li>
                <li>成交额单位：万元</li>
                <li>资金流、北向、龙虎榜等新增数据默认使用元级展示</li>
                <li>市值单位：亿元</li>
                <li>仅 A 股详情页已完全接入，港股 / 美股 / 基金结果暂不跳详情</li>
              </ul>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
