import { Link, NavLink } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatDate } from '../lib/dateUtils';
import { examCountdown } from '../lib/domain';

const navClass = ({ isActive }: { isActive: boolean }) => `nb-navlink${isActive ? ' on' : ''}`;

function ExamStamp() {
  const { settings } = useApp();
  if (!settings?.examDate) return null;
  const days = examCountdown(settings.examDate, formatDate(new Date()));
  return (
    <span className="nb-stamp">
      {days >= 0 ? `D-${days}` : `D+${-days}`}
      {settings.examName ? <small>{settings.examName}</small> : null}
    </span>
  );
}

/** 桌面顶部导航（SPEC-B §3）：品牌 + 文字链接 + 搜索/设置 + 印章 */
export function TopNav() {
  const todayTo = `/day/${formatDate(new Date())}`;
  const items: { to: string; label: string; end?: boolean }[] = [
    { to: todayTo, label: '今日' },
    { to: '/plan', label: '计划' },
    { to: '/', label: '日历', end: true },
    { to: '/memory', label: '时光' },
    { to: '/stats', label: '统计' },
  ];

  return (
    <header className="nb-topnav">
      <Link to={todayTo} className="nb-brand">
        考研手记<small>STUDY LOG · VOL.{new Date().getFullYear()}</small>
      </Link>
      {items.map((item) => (
        <NavLink key={item.label} to={item.to} end={item.end} className={navClass}>
          {item.label}
        </NavLink>
      ))}
      <div className="nb-topnav-right">
        <NavLink to="/search" className={navClass}>
          搜索
        </NavLink>
        <NavLink to="/settings" className={navClass}>
          设置
        </NavLink>
        <ExamStamp />
      </div>
    </header>
  );
}

/** 手机页头（SPEC-B mTop 的外壳版）：品牌 + 搜索/设置 + 印章；P4 页面期换各页标题 */
export function MobileHead() {
  const todayTo = `/day/${formatDate(new Date())}`;
  return (
    <header className="nb-mhead">
      <Link to={todayTo} className="nb-brand">
        考研手记
      </Link>
      <div className="nb-mhead-right">
        <NavLink to="/search" className={navClass}>
          搜索
        </NavLink>
        <NavLink to="/settings" className={navClass}>
          设置
        </NavLink>
        <ExamStamp />
      </div>
    </header>
  );
}
