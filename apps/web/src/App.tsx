import { Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/Layout';
import BookLoader from './components/BookLoader';
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

function AppShell() {
  const { user } = useApp();
  const [showLoader, setShowLoader] = useState(() => {
    return !sessionStorage.getItem('study-journal-loaded');
  });

  const handleLoaderComplete = () => {
    sessionStorage.setItem('study-journal-loaded', '1');
    setShowLoader(false);
  };

  // 会话判定中
  if (user === undefined) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'var(--paper)' }}>
        <span className="font-sans text-body text-[var(--ink-soft)]">正在初始化…</span>
      </div>
    );
  }

  if (user === null) {
    return <LoginPage />;
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
      <AppShell />
    </AppProvider>
  );
}
