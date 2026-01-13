import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd(), '')
  
  const defaultBase = mode === 'production' ? '/stock-dashboard/' : '/'

  return {
    // 优先使用 VITE_BASE_URL 环境变量，否则根据环境设置基础路径
    base: env.VITE_BASE_URL || defaultBase,
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
