/**
 * 卡片组件
 */

import type { ReactNode, CSSProperties } from 'react';
import styles from './Card.module.css';

interface CardProps {
  children: ReactNode;
  title?: string;
  extra?: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
  style?: CSSProperties;
  animate?: boolean;
}

export function Card({
  children,
  title,
  extra,
  padding = 'md',
  className = '',
  style,
  animate = true,
}: CardProps) {
  return (
    <div
      className={`${styles.card} ${styles[`padding-${padding}`]} ${animate ? styles.enter : ''} ${className}`}
      style={style}
    >
      {(title || extra) && (
        <div className={styles.header}>
          {title && <h3 className={styles.title}>{title}</h3>}
          {extra && <div className={styles.extra}>{extra}</div>}
        </div>
      )}
      <div className={styles.body}>{children}</div>
    </div>
  );
}
