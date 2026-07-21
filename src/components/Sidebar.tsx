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
    <aside
      className="sticky top-0 flex h-screen w-[208px] shrink-0 flex-col px-3 py-5"
      style={{
        background: 'var(--card)',
        borderRight: '1px solid var(--keyline)',
      }}
    >
      {/* Logo — 📔 + 衬线 "手帐" + Caveat Latin */}
      <div className="flex items-center gap-2 px-3 pb-5">
        <span className="text-2xl">📔</span>
        <div className="flex flex-col">
          <span className="font-serif text-h2 leading-none text-[var(--ink)]">手帐</span>
          <span className="font-hand text-caption text-[var(--ink-faint)]">Study Journal</span>
        </div>
      </div>

      {/* 缝线分隔 */}
      <div className="stitched mx-3 mb-4" />

      {/* 今日按钮 */}
      <button
        onClick={goToday}
        className="mx-2 mb-4 flex items-center gap-2.5 rounded-md px-3 py-2.5 font-sans text-small text-[var(--ink)] transition-all hover:bg-[var(--paper)]"
        aria-label="回到今天"
      >
        <Sun size={18} style={{ color: 'var(--brand)' }} />
        今日
      </button>

      {/* 主导航 — 激活态：左侧 3px 朱红竖条 + paper 底 + ink 文字 */}
      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `relative flex items-center gap-2.5 rounded-md px-3 py-2.5 font-sans text-small transition-all ${
                  isActive
                    ? 'text-[var(--ink)] bg-[var(--paper)]'
                    : 'text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--paper)]'
                }`
              }
              style={({ isActive }) =>
                isActive
                  ? { borderLeft: '3px solid var(--brand)', paddingLeft: '9px' }
                  : { borderLeft: '3px solid transparent', paddingLeft: '9px' }
              }
            >
              <Icon size={18} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* 缝线分隔 */}
      <div className="stitched mx-3 my-3" />

      {/* 底部操作 */}
      <div className="flex flex-col gap-1">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2.5 rounded-md px-3 py-2.5 font-sans text-small text-[var(--ink-soft)] transition-all hover:text-[var(--ink)] hover:bg-[var(--paper)]"
          aria-label={theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          {theme === 'light' ? '深色模式' : '浅色模式'}
        </button>
        <button
          onClick={handleExport}
          className="flex items-center gap-2.5 rounded-md px-3 py-2.5 font-sans text-small text-[var(--ink-soft)] transition-all hover:text-[var(--ink)] hover:bg-[var(--paper)]"
        >
          <Download size={18} />
          导出数据
        </button>
        <button
          onClick={triggerImport}
          className={`flex items-center gap-2.5 rounded-md px-3 py-2.5 font-sans text-small transition-all hover:bg-[var(--paper)] ${
            importStatus === 'success'
              ? 'text-[var(--pine)]'
              : importStatus === 'error'
                ? 'text-red-400'
                : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
          }`}
        >
          <Upload size={18} />
          {importStatus === 'success' ? '导入成功 ✓' : importStatus === 'error' ? '导入失败 ✕' : '导入数据'}
        </button>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-md px-3 py-2.5 font-sans text-small transition-all ${
              isActive
                ? 'text-[var(--ink)] bg-[var(--paper)]'
                : 'text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--paper)]'
            }`
          }
          style={({ isActive }) =>
            isActive
              ? { borderLeft: '3px solid var(--brand)', paddingLeft: '9px' }
              : { borderLeft: '3px solid transparent', paddingLeft: '9px' }
          }
        >
          <Settings size={18} />
          设置
        </NavLink>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />

      <div className="mt-3 px-3 text-center font-mono text-caption text-[var(--ink-faint)]">
        v{APP_VERSION} · 本地存储
      </div>
    </aside>
  );
}
