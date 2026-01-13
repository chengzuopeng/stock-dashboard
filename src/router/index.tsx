/**
 * 路由配置
 */

import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from '@/components/layout';
import { Dashboard } from '@/pages/Dashboard';
import { Heatmap } from '@/pages/Heatmap';
import { Rankings } from '@/pages/Rankings';
import { Boards, BoardDetail } from '@/pages/Boards';
import { Watchlist } from '@/pages/Watchlist';
import { Scanner } from '@/pages/Scanner';
import { Settings } from '@/pages/Settings';
import { StockDetail } from '@/pages/StockDetail';
import { EndOfDayPicker } from '@/pages/EndOfDayPicker';

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <Layout />,
      children: [
        {
          index: true,
          element: <Dashboard />,
        },
        {
          path: 'heatmap',
          element: <Heatmap />,
        },
        {
          path: 'rankings',
          element: <Rankings />,
        },
        {
          path: 'boards',
          element: <Boards />,
        },
        {
          path: 'boards/:type/:code',
          element: <BoardDetail />,
        },
        {
          path: 'watchlist',
          element: <Watchlist />,
        },
        {
          path: 'scanner',
          element: <Scanner />,
        },
        {
          path: 'eod-picker',
          element: <EndOfDayPicker />,
        },
        {
          path: 'settings',
          element: <Settings />,
        },
        {
          path: 's/:code',
          element: <StockDetail />,
        },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL }
);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
