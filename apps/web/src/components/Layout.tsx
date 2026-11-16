import { Outlet, useLocation } from 'react-router-dom';
import { TopNav, MobileHead } from './NotebookNav';
import BottomNav from './BottomNav';
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
      <TopNav />
      <main ref={mainRef} className="flex-1 overflow-y-auto pb-[var(--journal-bottom-nav)] md:pb-0">
        <MobileHead />
        <div className="mx-auto px-5 py-7 md:px-7 md:pb-10" style={{ maxWidth }}>
          <Outlet />
        </div>
      </main>

      <BottomNav />
      <ToastHost />
      <ConfirmHost />
    </div>
  );
}
