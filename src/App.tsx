import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { waitForDB } from './lib/db';
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
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [showLoader, setShowLoader] = useState(() => {
    return !sessionStorage.getItem('study-journal-loaded');
  });

  // 等待数据库就绪
  useEffect(() => {
    waitForDB()
      .then(() => setDbReady(true))
      .catch((err) => {
        console.error(err);
        setDbError('数据库初始化失败，请尝试清除站点数据后刷新页面');
      });
  }, []);

  const handleLoaderComplete = () => {
    sessionStorage.setItem('study-journal-loaded', '1');
    setShowLoader(false);
  };

  // DB 未就绪：显示加载状态
  if (!dbReady && !dbError) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'var(--paper)' }}>
        <div className="flex flex-col items-center gap-4">
          <Flower mood={MOOD_CONFIGS.happy} size={40} variant="head" className="animate-bloom-in" />
          <span className="font-serif text-body text-[var(--ink-soft)]">正在初始化…</span>
        </div>
      </div>
    );
  }

  // DB 错误
  if (dbError) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'var(--paper)' }}>
        <div className="flex flex-col items-center gap-3 text-center max-w-xs">
          <AlertTriangle size={32} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
          <p className="font-serif text-body text-[var(--ink)]">{dbError}</p>
          <button
            onClick={() => {
              // 清除 IndexedDB 并刷新
              indexedDB.deleteDatabase('StudyJournalDB');
              window.location.reload();
            }}
            className="rounded-full border border-[var(--brand)] px-4 py-2 font-sans text-small text-[var(--brand)]"
          >
            清除并刷新
          </button>
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
