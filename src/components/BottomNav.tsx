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
      className="glass-nav fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--color-line)] md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around px-2 py-1.5">
        {/* Today quick button */}
        <button
          onClick={goToday}
          className="flex flex-col items-center gap-0.5 px-2 py-1 text-[var(--color-text-soft)]"
        >
          <Sun size={20} className="text-brand" />
          <span className="text-[10px] font-medium">今日</span>
        </button>

        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2 py-1 transition-colors ${
                  isActive
                    ? 'text-[var(--color-text)]'
                    : 'text-[var(--color-text-faint)]'
                }`
              }
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
