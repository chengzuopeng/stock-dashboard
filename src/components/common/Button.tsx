/**
 * 按钮组件
 */

import type { ReactNode, MouseEventHandler } from 'react';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  loading?: boolean;
  block?: boolean;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  icon,
  loading = false,
  block = false,
  className = '',
  disabled,
  type = 'button',
  onClick,
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${styles.button} ${styles[variant]} ${styles[size]} ${block ? styles.block : ''} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? (
        <span className={styles.loadingIcon} />
      ) : icon ? (
        <span className={styles.icon}>{icon}</span>
      ) : null}
      {children && <span className={styles.text}>{children}</span>}
    </button>
  );
}
