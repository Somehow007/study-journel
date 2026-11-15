import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import SiteTopBar from './SiteTopBar';
import ToastHost from './ToastHost';
import ConfirmHost from './ui/ConfirmDialog';
import { useEffect, useMemo, useRef } from 'react';

export default function Layout() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  const maxWidth = useMemo(() => {
    const path = location.pathname;
    if (path === '/') return '1040px';
    if (path.startsWith('/day/')) return '860px';
    if (path === '/memory') return '720px';
    return '880px';
  }, [location.pathname]);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="relative z-10 min-h-screen">
      <SiteTopBar />
      <div className="flex md:gap-10">
        <div className="hidden shrink-0 md:block md:py-6 md:pl-6">
          <Sidebar />
        </div>

        <main ref={mainRef} className="flex-1 overflow-y-auto pb-[var(--journal-bottom-nav)] md:pb-0">
          <div className="mx-auto px-5 py-7 md:px-7 md:pb-10" style={{ maxWidth }}>
            <Outlet />
          </div>
        </main>
      </div>

      <BottomNav />
      <ToastHost />
      <ConfirmHost />
    </div>
  );
}
