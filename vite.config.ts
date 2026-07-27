import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 集成部署约定（见《网站集成与 MySQL 存储方案 v2.0》§7.3）：
// 手帐作为博客主站的子路径应用部署在 /journal/ 下。
// PWA 注册已移除（§7.4：子路径下 Service Worker 作用域易与主站冲突，稳定后再评估）。
export default defineConfig({
  base: '/journal/',
  plugins: [react()],
  server: {
    port: 5173,
    open: '/journal/',
  },
})
