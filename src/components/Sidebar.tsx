import { NavLink } from 'react-router-dom';
import { CalendarDays, Clock, BarChart3, Settings, Search, Download, Upload, Moon, Sun, BookOpen, ListChecks } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatDate } from '../lib/dateUtils';
import { useDataIO } from '../lib/useDataIO';
import { APP_VERSION } from '../lib/version';

const mainNav = [
  { to: `/day/${formatDate(new Date())}`, label: '今日', icon: Sun, end: false },
  { to: '/plan', label: '计划', icon: ListChecks, end: false },
  { to: '/', label: '日历', icon: CalendarDays, end: true },
  { to: '/memory', label: '时光', icon: Clock, end: false },
  { to: '/stats', label: '统计', icon: BarChart3, end: false },
];

export default function Sidebar() {
  const { isDark, toggleTheme } = useApp();
  const { fileInputRef, importStatus, handleExport, triggerImport, handleFileChange } = useDataIO();

  return (
    <aside className="card sticky top-6 z-20 flex w-[220px] flex-col rounded-[20px] px-4 pb-5 pt-7">
      <div className="flex items-center gap-2.5 px-3 pb-6">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-inverse)]"
          style={{ background: 'var(--brand)' }}
        >
          <BookOpen size={16} strokeWidth={2} />
        </span>
        <div className="flex flex-col">
          <span className="font-sans text-h2 leading-none text-[var(--ink)]">手帐</span>
          <span className="font-sans text-caption text-[var(--ink-faint)]">学习台账</span>
        </div>
      </div>

      <nav className="flex flex-col gap-1 px-3">
        {mainNav.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 font-sans text-small transition-all ${
                  isActive
                    ? 'bg-[var(--brand-soft)] font-medium text-[var(--brand)]'
                    : 'text-[var(--ink-soft)] hover:bg-[var(--paper)] hover:text-[var(--ink)]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full"
                      style={{ background: 'var(--brand)' }}
                    />
                  )}
                  <Icon size={18} strokeWidth={1.75} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="mx-5 mb-3 h-px bg-[var(--hairline)]" />

      <div className="flex flex-col gap-1 px-3 pb-4">
        <NavLink
          to="/search"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3.5 py-2.5 font-sans text-small transition-all ${
              isActive
                ? 'bg-[var(--brand-soft)] font-medium text-[var(--brand)]'
                : 'text-[var(--ink-soft)] hover:bg-[var(--paper)] hover:text-[var(--ink)]'
            }`
          }
        >
          <Search size={18} strokeWidth={1.75} />
          搜索
        </NavLink>

        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-sans text-small text-[var(--ink-soft)] transition-all hover:bg-[var(--paper)] hover:text-[var(--ink)]"
        >
          {isDark ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
          {isDark ? '浅色模式' : '深色模式'}
        </button>

        <button
          onClick={handleExport}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-sans text-small text-[var(--ink-soft)] transition-all hover:bg-[var(--paper)] hover:text-[var(--ink)]"
        >
          <Download size={18} strokeWidth={1.75} />
          导出数据
        </button>

        <button
          onClick={triggerImport}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 font-sans text-small transition-all hover:bg-[var(--paper)] ${
            importStatus === 'success'
              ? 'text-[var(--pine)]'
                : importStatus === 'error'
                ? 'text-[var(--danger)]'
                : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
          }`}
        >
          <Upload size={18} strokeWidth={1.75} />
          {importStatus === 'success' ? '导入成功' : importStatus === 'error' ? '导入失败' : '导入数据'}
        </button>

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3.5 py-2.5 font-sans text-small transition-all ${
              isActive
                ? 'bg-[var(--brand-soft)] font-medium text-[var(--brand)]'
                : 'text-[var(--ink-soft)] hover:bg-[var(--paper)] hover:text-[var(--ink)]'
            }`
          }
        >
          <Settings size={18} strokeWidth={1.75} />
          设置
        </NavLink>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />

      <div className="px-5 pb-5 text-center font-mono text-caption text-[var(--ink-faint)]">
        v{APP_VERSION} · 已同步
      </div>
    </aside>
  );
}
