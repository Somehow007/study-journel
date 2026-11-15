import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 401 已由 http.ts 全局处理；其余错误交给页面/组件展示
      retry: (count, err) => {
        const status = (err as { status?: number }).status;
        if (status === 401 || status === 403) return false;
        return count < 1;
      },
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* basename 与 vite.config.ts 的 base 保持一致：子路径 /journal 部署 */}
    <BrowserRouter basename="/journal">
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
