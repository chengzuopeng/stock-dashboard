/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import faroUploader from '@grafana/faro-rollup-plugin'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import path from 'path'

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')) as { version: string }

const VENDOR_CHUNKS: Record<string, string> = {
  react: 'react-vendor',
  'react-dom': 'react-vendor',
  scheduler: 'react-vendor',
  'react-router': 'react-vendor',
  'react-router-dom': 'react-vendor',
  echarts: 'echarts-vendor',
  zrender: 'echarts-vendor',
  'framer-motion': 'motion-vendor',
  'motion-dom': 'motion-vendor',
  'motion-utils': 'motion-vendor',
}

function resolveCommit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'unknown'
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量 (loadEnv 加载 .env 文件，process.env 包含系统环境变量)
  const env = loadEnv(mode, process.cwd(), '')

  // API Key 优先从系统环境变量读取（GitHub Actions），其次从 .env 文件读取
  const grafanaApiKey = process.env.GRAFANA_FARO_API_KEY || env.GRAFANA_FARO_API_KEY

  // 默认根路径：GH Pages 的子路径由 workflow 显式注入 VITE_BASE_URL，
  // 缺省为 '/' 可让漏配的部署退化为根路径部署，而非资源全部 404
  const defaultBase = '/'

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
    base: process.env.VITE_BASE_URL || env.VITE_BASE_URL || defaultBase,
    plugins,
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __APP_COMMIT__: JSON.stringify(resolveCommit()),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    // 生产环境生成 source map
    build: {
      sourcemap: mode === 'production' && grafanaApiKey ? 'hidden' : false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            const match = id.match(/.*node_modules\/((?:@[^/]+\/)?[^/]+)\//)
            return match ? VENDOR_CHUNKS[match[1]] : undefined
          },
        },
      },
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  }
})
