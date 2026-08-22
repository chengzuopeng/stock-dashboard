/**
 * Toast 提示组件
 */

import { useState, useCallback, useMemo, type ReactNode } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { ToastContext, type ToastType, type ToastContextValue } from './toastContext';
import styles from './Toast.module.css';

interface ToastMessage {
  id: number;
  type: ToastType;
  message: string;
}

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, type, message }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // context value 不 memo 的话，每条 toast 的出现/消失都会重渲染所有 useToast 消费页
  const value: ToastContextValue = useMemo(
    () => ({
      success: (message: string) => addToast('success', message),
      error: (message: string) => addToast('error', message),
      info: (message: string) => addToast('info', message),
      warning: (message: string) => addToast('warning', message),
    }),
    [addToast]
  );

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={18} />;
      case 'error':
        return <AlertCircle size={18} />;
      case 'warning':
        return <AlertTriangle size={18} />;
      case 'info':
        return <Info size={18} />;
    }
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.container}>
        {toasts.map((toast) => (
          <div key={toast.id} className={`${styles.toast} ${styles[toast.type]}`}>
            <span className={styles.icon}>{getIcon(toast.type)}</span>
            <span className={styles.message}>{toast.message}</span>
            <button
              className={styles.closeBtn}
              onClick={() => removeToast(toast.id)}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
