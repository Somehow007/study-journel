import { NavLink, useNavigate } from 'react-router-dom';
import { Calendar, Clock, BarChart3, Search, Sun } from 'lucide-react';
import { formatDate } from '../lib/dateUtils';

const navItems = [
  { to: '/', label: '月历', icon: Calendar, end: true },
  { to: '/memory', label: '回忆', icon: Clock, end: false },
  { to: '/stats', label: '统计', icon: BarChart3, end: false },
  { to: '/search', label: '搜索', icon: Search, end: false },
];

export default function BottomNav() {
  const navigate = useNavigate();

  const goToday = () => {
    navigate(`/day/${formatDate(new Date())}`);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t md:hidden"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--keyline)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex items-center justify-around px-2 py-1.5">
        {/* Today quick button — vermillion icon */}
        <button
          onClick={goToday}
          className="flex flex-col items-center gap-0.5 px-2 py-1"
        >
          <Sun size={20} style={{ color: 'var(--brand)' }} />
          <span className="font-sans text-caption text-[var(--brand)]">今日</span>
        </button>

        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2 py-1 transition-colors font-sans text-caption ${
                  isActive
                    ? 'text-[var(--ink)]'
                    : 'text-[var(--ink-faint)]'
                }`
              }
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
