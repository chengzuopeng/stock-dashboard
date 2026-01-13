/**
 * Tabs 组件
 */

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import styles from './Tabs.module.css';

interface TabItem {
  key: string;
  label: string;
  icon?: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  size?: 'sm' | 'md';
}

export function Tabs({ items, activeKey, onChange, size = 'md' }: TabsProps) {
  return (
    <div className={`${styles.tabs} ${styles[size]}`}>
      {items.map((item) => (
        <button
          key={item.key}
          className={`${styles.tab} ${activeKey === item.key ? styles.active : ''}`}
          onClick={() => onChange(item.key)}
        >
          {item.icon && <span className={styles.icon}>{item.icon}</span>}
          <span>{item.label}</span>
          {activeKey === item.key && (
            <motion.div
              className={styles.indicator}
              layoutId="tabIndicator"
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
