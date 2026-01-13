/**
 * 卡片组件
 */

import type { ReactNode, CSSProperties } from 'react';
import { motion } from 'framer-motion';
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
  const Wrapper = animate ? motion.div : 'div';
  const animateProps = animate
    ? {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.25 },
      }
    : {};

  return (
    <Wrapper
      className={`${styles.card} ${styles[`padding-${padding}`]} ${className}`}
      style={style}
      {...animateProps}
    >
      {(title || extra) && (
        <div className={styles.header}>
          {title && <h3 className={styles.title}>{title}</h3>}
          {extra && <div className={styles.extra}>{extra}</div>}
        </div>
      )}
      <div className={styles.body}>{children}</div>
    </Wrapper>
  );
}
