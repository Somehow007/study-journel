import { NavLink, useNavigate } from 'react-router-dom';
import { Calendar, Clock, BarChart3, Sun, Moon, Settings, Download, Upload, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatDate } from '../lib/dateUtils';
import { useDataIO } from '../lib/useDataIO';
import { APP_VERSION } from '../lib/version';

const navItems = [
  { to: '/', label: '月历', icon: Calendar, end: true },
  { to: '/memory', label: '回忆', icon: Clock, end: false },
  { to: '/stats', label: '统计', icon: BarChart3, end: false },
  { to: '/search', label: '搜索', icon: Search, end: false },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useApp();
  const { fileInputRef, importStatus, handleExport, triggerImport, handleFileChange } = useDataIO();

  const goToday = () => {
    navigate(`/day/${formatDate(new Date())}`);
  };

  return (
    <aside className="glass-nav sticky top-0 flex h-screen w-[200px] shrink-0 flex-col border-r border-[var(--color-line)] px-3 py-5">
      {/* Logo */}
      <div className="flex items-center gap-2 px-3 pb-5">
        <span className="text-2xl">📔</span>
        <div className="flex flex-col">
          <span className="font-hand text-xl font-semibold leading-none text-[var(--color-text)]">手帐</span>
          <span className="font-mono text-[10px] text-[var(--color-text-faint)]">Study Journal</span>
        </div>
      </div>

      <div className="mx-3 mb-4 h-px bg-[var(--color-line)]" />

      {/* 今日按钮 */}
      <button
        onClick={goToday}
        className="mx-2 mb-4 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--color-text)] transition-all hover:bg-[var(--color-card)] hover:shadow-2"
        aria-label="回到今天"
      >
        <Sun size={18} className="text-brand" />
        今日
      </button>

      {/* 主导航 */}
      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'glass text-[var(--color-text)] shadow-2'
                    : 'text-[var(--color-text-soft)] hover:text-[var(--color-text)] hover:bg-[var(--color-card)]'
                }`
              }
            >
              <Icon size={18} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="mx-3 my-3 h-px bg-[var(--color-line)]" />

      {/* 底部操作 */}
      <div className="flex flex-col gap-1">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--color-text-soft)] transition-all hover:text-[var(--color-text)] hover:bg-[var(--color-card)]"
          aria-label={theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          {theme === 'light' ? '深色模式' : '浅色模式'}
        </button>
        <button
          onClick={handleExport}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--color-text-soft)] transition-all hover:text-[var(--color-text)] hover:bg-[var(--color-card)]"
        >
          <Download size={18} />
          导出数据
        </button>
        <button
          onClick={triggerImport}
          className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all hover:text-[var(--color-text)] hover:bg-[var(--color-card)] ${
            importStatus === 'success'
              ? 'text-green-500'
              : importStatus === 'error'
                ? 'text-red-400'
                : 'text-[var(--color-text-soft)]'
          }`}
        >
          <Upload size={18} />
          {importStatus === 'success' ? '导入成功 ✓' : importStatus === 'error' ? '导入失败 ✕' : '导入数据'}
        </button>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              isActive
                ? 'glass text-[var(--color-text)] shadow-2'
                : 'text-[var(--color-text-soft)] hover:text-[var(--color-text)] hover:bg-[var(--color-card)]'
            }`
          }
        >
          <Settings size={18} />
          设置
        </NavLink>
      </div>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />

      <div className="mt-3 px-3 text-center font-mono text-[10px] text-[var(--color-text-faint)]">
        v{APP_VERSION} · 本地存储
      </div>
    </aside>
  );
}
