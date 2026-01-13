/**
 * 侧边栏导航组件
 */

import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Grid3X3,
  BarChart3,
  Layers,
  Star,
  Settings,
  TrendingUp,
} from 'lucide-react';
import { Logo } from '@/components/common';
import styles from './Sidebar.module.css';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { path: '/', label: '总览', icon: <LayoutDashboard size={18} /> },
  { path: '/heatmap', label: '热力图', icon: <Grid3X3 size={18} /> },
  { path: '/rankings', label: '榜单', icon: <BarChart3 size={18} /> },
  { path: '/boards', label: '板块', icon: <Layers size={18} /> },
  { path: '/watchlist', label: '自选', icon: <Star size={18} /> },
  { path: '/eod-picker', label: '尾盘选股', icon: <TrendingUp size={18} /> },
];

const bottomItems: NavItem[] = [
  { path: '/settings', label: '设置', icon: <Settings size={18} /> },
];

export function Sidebar() {
  const location = useLocation();

  const renderNavItem = (item: NavItem) => {
    const isActive =
      item.path === '/'
        ? location.pathname === '/'
        : location.pathname.startsWith(item.path);

    return (
      <NavLink
        key={item.path}
        to={item.path}
        className={`${styles.navItem} ${isActive ? styles.active : ''}`}
      >
        {isActive && (
          <motion.div
            className={styles.activeIndicator}
            layoutId="activeIndicator"
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          />
        )}
        <span className={styles.icon}>{item.icon}</span>
        <span className={styles.label}>{item.label}</span>
      </NavLink>
    );
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <Logo size={36} />
        <span className={styles.logoText}>A股看板</span>
      </div>

      <nav className={styles.nav}>
        <div className={styles.navGroup}>
          {navItems.map(renderNavItem)}
        </div>

        <div className={styles.navGroup}>
          {bottomItems.map(renderNavItem)}
        </div>
      </nav>
    </aside>
  );
}
