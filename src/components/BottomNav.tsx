import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Sun, CalendarDays, Clock, MoreHorizontal, BarChart3, Search, TrendingUp, Settings, X } from 'lucide-react';
import { formatDate } from '../lib/dateUtils';

const tabs = [
  { to: `/day/${formatDate(new Date())}`, label: '今日', icon: Sun },
  { to: '/', label: '日历', icon: CalendarDays, end: true },
  { to: '/memory', label: '时光', icon: Clock },
];

const moreItems = [
  { to: '/stats', label: '统计', icon: BarChart3 },
  { to: '/search', label: '搜索', icon: Search },
  { to: '/annual', label: '年度', icon: TrendingUp },
  { to: '/settings', label: '设置', icon: Settings },
];

const MORE_PREFIXES = ['/stats', '/search', '/annual', '/settings'];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE_PREFIXES.some((p) => location.pathname.startsWith(p));

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMoreOpen(false)} />
          <div
            className="overlay absolute inset-x-0 bottom-0 rounded-t-2xl px-4 pt-3"
            style={{
              paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
              boxShadow: 'var(--shadow-4)',
            }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--keyline)]" />
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-sans text-title text-[var(--ink)]">更多</h3>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-faint)]"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 pb-2">
              {moreItems.map((item) => {
                const Icon = item.icon;
                const active = location.pathname.startsWith(item.to);
                return (
                  <button
                    key={item.to}
                    type="button"
                    onClick={() => navigate(item.to)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left font-sans text-small ${
                      active
                        ? 'border-transparent bg-[var(--brand-soft)] text-[var(--brand)]'
                        : 'border-[var(--keyline)] text-[var(--ink-soft)]'
                    }`}
                  >
                    <Icon size={18} strokeWidth={1.75} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`flex flex-1 flex-col items-center gap-0.5 px-1 py-1 font-sans text-caption transition-colors ${
              moreActive || moreOpen ? 'text-[var(--brand)]' : 'text-[var(--ink-faint)]'
            }`}
          >
            <MoreHorizontal size={20} strokeWidth={1.75} />
            <span>更多</span>
          </button>
        </div>
      </nav>
    </>
  );
}
