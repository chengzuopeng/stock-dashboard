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
      </main>
    </div>
  );
}
