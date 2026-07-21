import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import { useMemo } from 'react';

export default function Layout() {
  const location = useLocation();

  // 内容区最大宽度按页型分档
  const maxWidth = useMemo(() => {
    const path = location.pathname;
    if (path === '/') return '1040px';        // 月历
    if (path.startsWith('/day/')) return '720px'; // 详情页
    return '880px';                           // 回忆/统计/搜索/设置/年度回顾
  }, [location.pathname]);

  return (
    <div className="relative z-10 flex min-h-screen">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        <div
          className="mx-auto px-5 py-7 md:px-7"
          style={{ maxWidth }}
        >
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  );
}
