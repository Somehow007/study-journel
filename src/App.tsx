import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { getToken } from './lib/http';
import { MOOD_CONFIGS } from './lib/constants';
import Flower from './components/Flower';
import Layout from './components/Layout';
import BookLoader from './components/BookLoader';
import MonthView from './pages/MonthView';
import TodayDetail from './pages/TodayDetail';
import Memory from './pages/Memory';
import Stats from './pages/Stats';
import Search from './pages/Search';
import Settings from './pages/Settings';
import AnnualReview from './pages/AnnualReview';

function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const { theme } = useApp();
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);
  return <>{children}</>;
}

function AppShell() {
  const [authReady, setAuthReady] = useState(false);
  const [showLoader, setShowLoader] = useState(() => {
    return !sessionStorage.getItem('study-journal-loaded');
  });

  // 登录态检查：手帐接口仅 ADMIN 可访问，token 与博客共享（同源 localStorage）。
  // 未登录直接回网站登录页；接口层 401 也会跳 /login，这里是进入前的快速通道。
  useEffect(() => {
    if (!getToken()) {
      window.location.href = '/login';
      return;
    }
    setAuthReady(true);
  }, []);

  const handleLoaderComplete = () => {
    sessionStorage.setItem('study-journal-loaded', '1');
    setShowLoader(false);
  };

  // 登录态未就绪：显示加载状态
  if (!authReady) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'var(--paper)' }}>
        <div className="flex flex-col items-center gap-4">
          <Flower mood={MOOD_CONFIGS.happy} size={40} variant="head" className="animate-bloom-in" />
          <span className="font-serif text-body text-[var(--ink-soft)]">正在初始化…</span>
        </div>
      </div>
    );
  }

  if (showLoader) {
    return <BookLoader onComplete={handleLoaderComplete} />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<MonthView />} />
        <Route path="/day/:date" element={<TodayDetail />} />
        <Route path="/memory" element={<Memory />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/annual" element={<AnnualReview />} />
        <Route path="/search" element={<Search />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ThemeWrapper>
        <AppShell />
      </ThemeWrapper>
    </AppProvider>
  );
}
