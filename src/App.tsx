import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
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
  const { theme, palette } = useApp();
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.palette = palette;
  }, [palette]);
  return <>{children}</>;
}

function AppShell() {
  const [showLoader, setShowLoader] = useState(() => {
    // Only show on first visit per session
    return !sessionStorage.getItem('study-journal-loaded');
  });

  const handleLoaderComplete = () => {
    sessionStorage.setItem('study-journal-loaded', '1');
    setShowLoader(false);
  };

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
