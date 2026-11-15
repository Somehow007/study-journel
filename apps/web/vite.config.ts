import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 集成部署约定：手帐作为独立应用部署在 /journal/ 下。
// M3 起数据层走 Go 服务 /api/v1（Cookie 会话）；生产由 Nginx 将
// /journal/api/ 反代到 Go 服务。PWA 注册已移除（子路径 SW 作用域易冲突）。
export default defineConfig({
  base: '/journal/',
  plugins: [
    react(),
    {
      name: 'journal-base-redirect',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const path = String((req as { url?: string }).url ?? '').split('?')[0]
          if (path === '/' || path === '/login' || path === '/index.html') {
            res.statusCode = 302
            res.setHeader('Location', '/journal/')
            res.end()
            return
          }
          next()
        })
      },
    },
  ],
  server: {
    // 5174：避让博客前端的 5173（博客 CORS 白名单本就包含 5174）
    port: 5174,
    open: '/journal/',
    proxy: {
      // 开发环境把 /api 直连本地 Go 服务（8090）；/api/v1/* + /api/health 均由其处理。
      // 生产环境由 Nginx 的 location /journal/api/ 同源反代，无需此配置。
      '/api': {
        target: 'http://localhost:8090',
        changeOrigin: true,
      },
      // 顶栏博客站点名仍走旧博客后端（可选，失败回退默认标题）
      '/v1': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
    },
  },
})
