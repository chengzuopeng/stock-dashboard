/**
 * 加载状态组件
 */

import { RefreshCw } from 'lucide-react';
import styles from './Loading.module.css';

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullScreen?: boolean;
}

export function Loading({ size = 'md', text, fullScreen = false }: LoadingProps) {
  const sizeMap = { sm: 16, md: 24, lg: 32 };

  const content = (
    <div className={`${styles.loading} ${styles[size]}`}>
      <RefreshCw size={sizeMap[size]} className={styles.icon} />
      {text && <span className={styles.text}>{text}</span>}
    </div>
  );

  if (fullScreen) {
    return <div className={styles.fullScreen}>{content}</div>;
  }

  return content;
}

/**
 * 骨架屏
 */
interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  rounded?: boolean;
}

export function Skeleton({ width = '100%', height = 16, rounded = false }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${rounded ? styles.rounded : ''}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    />
  );
}

/**
 * 空状态
 */
interface EmptyProps {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export function Empty({
  icon,
  title = '暂无数据',
  description,
  action,
}: EmptyProps) {
  return (
    <div className={styles.empty}>
      {icon && <div className={styles.emptyIcon}>{icon}</div>}
      <p className={styles.emptyTitle}>{title}</p>
      {description && <p className={styles.emptyDesc}>{description}</p>}
      {action && <div className={styles.emptyAction}>{action}</div>}
    </div>
  );
}
