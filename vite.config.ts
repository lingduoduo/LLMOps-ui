import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import vue from '@vitejs/plugin-vue'
import { mockApi } from './mock/api'

const DEFAULT_API_BASE = '/api'
const DEFAULT_PROXY_TARGET = 'http://localhost:5000'

// Two ways to reach the Flask backend during development:
// - Relative VITE_API_BASE_URL (default `/api`): requests stay same-origin and this
//   proxy forwards them to VITE_PROXY_TARGET with the prefix stripped, so no CORS applies.
// - Absolute VITE_API_BASE_URL (e.g. `http://localhost:5000`): no proxy is registered and
//   the browser sends real cross-origin requests, answered by the backend's Flask-CORS.
const createProxy = (env: Record<string, string>): Record<string, ProxyOptions> | undefined => {
  const apiBase = (env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE).replace(/\/+$/, '')
  if (!apiBase.startsWith('/')) return undefined
  const prefix = new RegExp(`^${apiBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
  return {
    [apiBase]: {
      target: env.VITE_PROXY_TARGET?.trim() || DEFAULT_PROXY_TARGET,
      changeOrigin: true,
      rewrite: (path) => path.replace(prefix, '') || '/',
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [vue(), mockApi()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      proxy: createProxy(env),
    },
  }
})
