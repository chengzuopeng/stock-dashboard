import { defineConfig, loadEnv, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import faroUploader from '@grafana/faro-rollup-plugin'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量 (loadEnv 加载 .env 文件，process.env 包含系统环境变量)
  const env = loadEnv(mode, process.cwd(), '')
  
  // API Key 优先从系统环境变量读取（GitHub Actions），其次从 .env 文件读取
  const grafanaApiKey = process.env.GRAFANA_FARO_API_KEY || env.GRAFANA_FARO_API_KEY
  
  const defaultBase = mode === 'production' ? '/stock-dashboard/' : '/'

  // 构建插件列表
  const plugins: PluginOption[] = [react()]
  
  // Grafana Faro source map uploader (仅在生产构建且有 API Key 时启用)
  if (mode === 'production' && grafanaApiKey) {
    plugins.push(
      faroUploader({
        appName: 'stock-dashboard',
        endpoint: 'https://faro-api-prod-ap-southeast-1.grafana.net/faro/api/v1',
        appId: '970',
        stackId: '1494323',
        verbose: true,
        apiKey: grafanaApiKey,
        gzipContents: true,
      })
    )
  }

  return {
    // 优先使用 VITE_BASE_URL 环境变量，否则根据环境设置基础路径
    base: process.env.VITE_BASE_URL || env.VITE_BASE_URL || defaultBase,
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    // 生产环境生成 source map
    build: {
      sourcemap: mode === 'production',
    },
  }
})
