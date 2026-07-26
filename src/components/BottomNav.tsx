import { NavLink } from 'react-router-dom';
import { Sun, CalendarDays, Clock, User } from 'lucide-react';
import { formatDate } from '../lib/dateUtils';

const tabs = [
  { to: `/day/${formatDate(new Date())}`, label: '今日', icon: Sun },
  { to: '/', label: '日历', icon: CalendarDays, end: true },
  { to: '/memory', label: '时光', icon: Clock },
  { to: '/settings', label: '我的', icon: User },
];

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t md:hidden"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--keyline)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex items-center justify-around px-2 py-2">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.label}
              to={item.to}
              end={(item as { end?: boolean }).end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 px-1 py-1 font-sans text-caption transition-colors ${
                  isActive ? 'text-[var(--brand)]' : 'text-[var(--ink-faint)]'
                }`
              }
            >
              <Icon size={20} strokeWidth={1.75} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
