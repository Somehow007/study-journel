import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import { useMemo } from 'react';

export default function Layout() {
  const location = useLocation();

  // 内容区最大宽度按页型分档
  const maxWidth = useMemo(() => {
    const path = location.pathname;
    if (path === '/') return '1040px';        // 日历
    if (path.startsWith('/day/')) return '860px'; // 今日页
    return '880px';                           // 时光/统计/搜索/设置/年度回顾
  }, [location.pathname]);

  return (
    <div className="relative z-10 flex min-h-screen md:gap-10">
      {/* Desktop sidebar — hidden on mobile（浮动卡片，与内容区留白） */}
      <div className="hidden shrink-0 md:block md:py-6 md:pl-6">
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
