/**
 * 应用主布局
 */

import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import styles from './Layout.module.css';

export function Layout() {
  return (
    <div className={styles.layout}>
      <Sidebar />
      <Header />
      <main className={styles.main}>
        <div className={styles.content}>
          <Outlet />
        </div>
        <footer className={styles.footer}>
          <span>数据来源：</span>
          <a
            href="https://stock-sdk.linkdiary.cn/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Stock SDK
          </a>
          <span className={styles.divider}>|</span>
          <span>仅供学习参考，不构成投资建议</span>
        </footer>
      </main>
    </div>
  );
}
