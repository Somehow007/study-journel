import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 集成部署约定（见《网站集成与 MySQL 存储方案 v2.0》§7.3）：
// 手帐作为博客主站的子路径应用部署在 /journal/ 下。
// PWA 注册已移除（§7.4：子路径下 Service Worker 作用域易与主站冲突，稳定后再评估）。
// 第二期后端化：数据层走同源 /api/journal（Spring Boot journal 模块）。
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
      // 开发环境把 /api 直连本地 Spring Boot（8081）；
      // 生产环境由 Nginx 的 location /api/ 同源反代，无需此配置。
      // 本地联调需先在 localStorage['mysite_access_token'] 放入博客登录 token（JSON 字符串）。
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
      '/v1': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
    },
  },
})
