import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sun, CalendarDays, Clock, MoreHorizontal, BarChart3, Search, TrendingUp, Settings, X, ListChecks } from 'lucide-react';
import { formatDate } from '../lib/dateUtils';
import Sheet, { useSheetClose } from './ui/Sheet';
import { Pressable, PressableLink } from './ui/Pressable';

const moreItems = [
  { to: '/plan', label: '计划', icon: ListChecks },
  { to: '/stats', label: '统计', icon: BarChart3 },
  { to: '/search', label: '搜索', icon: Search },
  { to: '/annual', label: '年度', icon: TrendingUp },
  { to: '/settings', label: '设置', icon: Settings },
];

const MORE_PREFIXES = ['/plan', '/stats', '/search', '/annual', '/settings'];

function MoreSheetBody({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate: (to: string) => void;
}) {
  const close = useSheetClose();
  return (
    <div className="px-4 pb-2 pt-1">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-sans text-title text-[var(--ink)]">更多</h3>
        <Pressable
          variant="icon"
          onClick={close}
          className="flex items-center justify-center rounded-full text-[var(--ink-faint)]"
          aria-label="关闭"
        >
          <X size={18} />
        </Pressable>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {moreItems.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.to);
          return (
            <Pressable
              key={item.to}
              onClick={() => {
                onNavigate(item.to);
                close();
              }}
              className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 py-3 text-left font-sans text-small ${
                active
                  ? 'border-transparent bg-[var(--brand-soft)] text-[var(--brand)]'
                  : 'border-[var(--keyline)] text-[var(--ink-soft)]'
              }`}
            >
              <Icon size={18} strokeWidth={1.75} />
              {item.label}
            </Pressable>
          );
        })}
      </div>
    </div>
  );
}

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE_PREFIXES.some((p) => location.pathname.startsWith(p));
  const todayTo = `/day/${formatDate(new Date())}`;

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  const tabs = [
    { to: todayTo, label: '今日', icon: Sun },
    { to: '/', label: '日历', icon: CalendarDays, end: true as const },
    { to: '/memory', label: '时光', icon: Clock },
  ];

  return (
    <>
      {moreOpen && (
        <div className="md:hidden">
          <Sheet title="更多" onClose={() => setMoreOpen(false)}>
            <MoreSheetBody pathname={location.pathname} onNavigate={(to) => navigate(to)} />
          </Sheet>
        </div>
      )}

      <nav
        className="journal-bottom-nav fixed bottom-0 left-0 right-0 z-50 border-t md:hidden"
        style={{
          background: 'var(--card)',
          borderColor: 'var(--keyline)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex items-center justify-around px-2 py-1">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <PressableLink
                key={item.label}
                to={item.to}
                end={'end' in item ? item.end : undefined}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1 font-sans text-caption ${
                    isActive ? 'text-[var(--brand)]' : 'text-[var(--ink-faint)]'
                  }`
                }
              >
                <Icon size={20} strokeWidth={1.75} />
                <span>{item.label}</span>
              </PressableLink>
            );
          })}
          <Pressable
            onClick={() => setMoreOpen(true)}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1 font-sans text-caption ${
              moreActive || moreOpen ? 'text-[var(--brand)]' : 'text-[var(--ink-faint)]'
            }`}
          >
            <MoreHorizontal size={20} strokeWidth={1.75} />
            <span>更多</span>
          </Pressable>
        </div>
      </nav>
    </>
  );
}
