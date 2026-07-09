import { NavLink, useNavigate } from 'react-router-dom';
import { Calendar, Clock, BarChart3, Sun, Moon, Settings, Download, Upload } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatDate } from '../lib/dateUtils';
import { exportAllData, importData } from '../lib/db';
import { useRef, useState } from 'react';
import type { DayRecord } from '../types';

const navItems = [
  { to: '/', label: '月历', icon: Calendar, end: true },
  { to: '/memory', label: '回忆', icon: Clock, end: false },
  { to: '/stats', label: '统计', icon: BarChart3, end: false },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const goToday = () => {
    navigate(`/day/${formatDate(new Date())}`);
  };

  const handleExport = async () => {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `study-journal-${formatDate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!Array.isArray(data)) {
        throw new Error('数据格式错误：需要 JSON 数组');
      }

      // Basic validation
      for (const item of data) {
        if (!item.date || typeof item.date !== 'string') {
          throw new Error('数据格式错误：缺少 date 字段');
        }
      }

      // Confirm before overwriting
      const confirmed = window.confirm(
        `即将导入 ${data.length} 条记录。现有数据将被覆盖，确认继续？`
      );
      if (!confirmed) return;

      await importData(data as DayRecord[]);
      setImportStatus('success');
      setTimeout(() => setImportStatus('idle'), 3000);
      window.location.reload(); // Refresh to reflect imported data
    } catch (err) {
      console.error('Import failed:', err);
      setImportStatus('error');
      setTimeout(() => setImportStatus('idle'), 3000);
      alert(err instanceof Error ? err.message : '导入失败，请检查文件格式');
    }

    // Reset the input so the same file can be re-imported
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
          onClick={handleImport}
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
        <button className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--color-text-soft)] transition-all hover:text-[var(--color-text)] hover:bg-[var(--color-card)]">
          <Settings size={18} />
          设置
        </button>
      </div>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="mt-3 px-3 text-center font-mono text-[10px] text-[var(--color-text-faint)]">
        v0.1.0 · 本地存储
      </div>
    </aside>
  );
}
