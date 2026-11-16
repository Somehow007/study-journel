import { Outlet, useLocation } from 'react-router-dom';
import { TopNav, MobileHead } from './NotebookNav';
import BottomNav from './BottomNav';
import ToastHost from './ToastHost';
import ConfirmHost from './ui/ConfirmDialog';
import { useEffect, useRef } from 'react';

export default function Layout() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="relative z-10 min-h-screen">
      <TopNav />
      <main ref={mainRef} className="nb-mobile-paper flex-1 overflow-y-auto pb-[var(--journal-bottom-nav)] md:pb-0">
        <MobileHead />
        <div className="mx-auto" style={{ maxWidth: 1600 }}>
          <Outlet />
        </div>
      </main>

      <BottomNav />
      <ToastHost />
      <ConfirmHost />
    </div>
  );
}
