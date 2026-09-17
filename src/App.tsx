import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { FORBIDDEN_EVENT, getToken } from './lib/http';
import { isJournalAdmin } from './lib/auth';
import Layout from './components/Layout';
import BookLoader from './components/BookLoader';
import ForbiddenPage from './components/ForbiddenPage';
import LoginPage from './components/LoginPage';
import MonthView from './pages/MonthView';
import TodayDetail from './pages/TodayDetail';
import PlanView from './pages/PlanView';
import GoalDetail from './pages/GoalDetail';
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
  const [forbidden, setForbidden] = useState(false);
  const [showLoader, setShowLoader] = useState(() => {
    return !sessionStorage.getItem('study-journal-loaded');
  });

  useEffect(() => {
    const onForbidden = () => setForbidden(true);
    window.addEventListener(FORBIDDEN_EVENT, onForbidden);
    return () => window.removeEventListener(FORBIDDEN_EVENT, onForbidden);
  }, []);

  useEffect(() => {
    if (!getToken()) {
      setAuthReady(true);
      return;
    }
    const admin = isJournalAdmin();
    if (admin === false) {
      setForbidden(true);
      setAuthReady(true);
      return;
    }
    setAuthReady(true);
  }, []);

  const handleLoaderComplete = () => {
    sessionStorage.setItem('study-journal-loaded', '1');
    setShowLoader(false);
  };

  if (!authReady) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'var(--paper)' }}>
        <span className="font-sans text-body text-[var(--ink-soft)]">正在初始化…</span>
      </div>
    );
  }

  if (!getToken()) {
    return <LoginPage />;
  }

  if (forbidden) {
    return <ForbiddenPage />;
  }

  if (showLoader) {
    return <BookLoader onComplete={handleLoaderComplete} />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<MonthView />} />
        <Route path="/day/:date" element={<TodayDetail />} />
        <Route path="/plan" element={<PlanView />} />
        <Route path="/plan/:goalId" element={<GoalDetail />} />
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
