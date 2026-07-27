import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* basename 与 vite.config.ts 的 base 保持一致：子路径 /journal 部署 */}
    <BrowserRouter basename="/journal">
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
