import { NavLink } from 'react-router-dom';
import { formatDate } from '../lib/dateUtils';

const tabClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'on' : '');

export default function BottomNav() {
  const todayTo = `/day/${formatDate(new Date())}`;
  const tabs: { to: string; label: string; end?: boolean }[] = [
    { to: todayTo, label: '今日' },
    { to: '/plan', label: '计划' },
    { to: '/', label: '日历', end: true },
    { to: '/memory', label: '时光' },
    { to: '/stats', label: '统计' },
  ];

  return (
    <nav className="journal-bottom-nav nb-tabbar">
      {tabs.map((item) => (
        <NavLink key={item.label} to={item.to} end={item.end} className={tabClass}>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
