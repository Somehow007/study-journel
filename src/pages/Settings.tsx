import { useState } from 'react';
import { Plus, Pencil, Trash2, Sun, Moon, Download, Upload } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteCustomMood } from '../lib/db';
import MoodEditModal from '../components/MoodEditModal';
import { useDataIO } from '../lib/useDataIO';
import { APP_VERSION } from '../lib/version';
import Flower from '../components/Flower';
import type { CustomMoodConfig } from '../types';

export default function Settings() {
  const { theme, toggleTheme, dailyGoalMin, setDailyGoalMin } = useApp();
  const [showMoodEdit, setShowMoodEdit] = useState(false);
  const [editingMood, setEditingMood] = useState<CustomMoodConfig | null>(null);
  const { importStatus, handleExport, triggerImport, handleFileChange, fileInputRef } = useDataIO();

  const customMoods = useLiveQuery(() => db.customMoods.orderBy('createdAt').toArray(), []);
  const customMoodList = customMoods ?? [];

  const handleEditMood = (mood: CustomMoodConfig) => {
    setEditingMood(mood);
    setShowMoodEdit(true);
  };

  const handleDeleteMood = async (mood: CustomMoodConfig) => {
    const confirmed = window.confirm(`确定要删除"${mood.label}"心情吗？`);
    if (!confirmed) return;
    await deleteCustomMood(mood.id);
  };

  return (
    <div className="animate-fade-up max-w-2xl">
      <header className="mb-6">
        <h1 className="font-serif text-h1 text-[var(--ink)]">设置</h1>
        <p className="mt-1 font-displaylatin italic text-caption text-[var(--ink-faint)]">preferences.</p>
      </header>

      {/* Theme */}
      <section className="card mb-6 rounded-xl p-5">
        <h2 className="mb-3 font-serif text-h2 text-[var(--ink)]">外观</h2>
        <div className="inline-flex items-center gap-1 rounded-xl border border-[var(--hairline)] p-1">
          <button
            onClick={() => { if (theme !== 'light') toggleTheme(); }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 font-sans text-small transition-all ${
              theme === 'light'
                ? 'bg-[var(--paper)] text-[var(--ink)]'
                : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
            }`}
          >
            <Sun size={16} strokeWidth={1.75} />
            浅色
          </button>
          <button
            onClick={() => { if (theme !== 'dark') toggleTheme(); }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 font-sans text-small transition-all ${
              theme === 'dark'
                ? 'bg-[var(--paper)] text-[var(--ink)]'
                : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
            }`}
          >
            <Moon size={16} strokeWidth={1.75} />
            深色
          </button>
        </div>
      </section>

      {/* Daily learning goal */}
      <section className="card mb-6 rounded-xl p-5">
        <h2 className="font-serif text-h2 text-[var(--ink)]">每日学习目标</h2>
        <p className="mt-1 mb-4 font-sans text-small text-[var(--ink-faint)]">
          日历里每天的学习进度条以它为满格；达成目标的日子会在格子里结一枚杏橙小果实。
        </p>
        <div className="flex flex-wrap gap-2">
          {[60, 120, 180, 240, 360, 480].map((min) => (
            <button
              key={min}
              onClick={() => setDailyGoalMin(min)}
              className={`rounded-full border px-4 py-1.5 font-mono text-small transition-all ${
                dailyGoalMin === min
                  ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]'
                  : 'border-[var(--hairline)] text-[var(--ink-soft)] hover:border-[var(--ink)] hover:text-[var(--ink)]'
              }`}
            >
              {min / 60}h
            </button>
          ))}
        </div>
      </section>

      {/* Custom Moods */}
      <section className="card mb-6 rounded-xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-h2 text-[var(--ink)]">自定义心情</h2>
          <button
            onClick={() => { setEditingMood(null); setShowMoodEdit(true); }}
            className="pill-dashed inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-sans text-caption text-[var(--ink-soft)] transition-all hover:text-[var(--ink)]"
          >
            <Plus size={14} strokeWidth={1.75} />
            添加心情
          </button>
        </div>
        <p className="mb-4 font-sans text-small text-[var(--ink-faint)]">
          自定义心情会以通用花型渲染，保留你选择的图标与颜色。
        </p>

        {customMoodList.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--hairline)] py-8 text-center">
            <p className="font-serif text-body text-[var(--ink-faint)]">还没有自定义心情</p>
            <p className="mt-1 font-sans text-caption text-[var(--ink-faint)]">
              点击"添加心情"创建属于自己的心情类型
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {customMoodList.map((mood) => (
              <div
                key={mood.id}
                className="flex items-center justify-between rounded-xl border border-[var(--hairline)] bg-[var(--card)] p-3 transition-shadow hover:shadow-2"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full"
                    style={{ background: mood.solid }}
                  >
                    <span className="text-base" style={{ color: 'white' }}>{mood.emoji}</span>
                  </div>
                  <div>
                    <div className="font-sans text-small text-[var(--ink)]">{mood.label}</div>
                    <div className="font-mono text-caption text-[var(--ink-faint)]">{mood.solid}</div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEditMood(mood)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-faint)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)]"
                    aria-label={`编辑 ${mood.label}`}
                  >
                    <Pencil size={14} strokeWidth={1.75} />
                  </button>
                  <button
                    onClick={() => handleDeleteMood(mood)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-faint)] transition-colors hover:bg-red-500/10 hover:text-red-400"
                    aria-label={`删除 ${mood.label}`}
                  >
                    <Trash2 size={14} strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Data Management */}
      <section className="card mb-6 rounded-xl p-5">
        <h2 className="mb-3 font-serif text-h2 text-[var(--ink)]">数据管理</h2>
        <div className="divide-y rounded-xl border border-[var(--hairline)]" style={{ borderColor: 'var(--hairline)' }}>
          <button
            onClick={handleExport}
            className="flex w-full items-center gap-3 px-4 py-3 font-sans text-small text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
          >
            <Download size={18} strokeWidth={1.75} />
            导出全部数据
            <span className="ml-auto font-mono text-caption text-[var(--ink-faint)]">JSON</span>
          </button>
          <button
            onClick={triggerImport}
            className={`flex w-full items-center gap-3 px-4 py-3 font-sans text-small transition-colors hover:text-[var(--ink)] ${
              importStatus === 'success'
                ? 'text-[var(--pine)]'
                : importStatus === 'error'
                  ? 'text-red-400'
                  : 'text-[var(--ink-soft)]'
            }`}
          >
            <Upload size={18} strokeWidth={1.75} />
            {importStatus === 'success' ? '导入成功' : importStatus === 'error' ? '导入失败' : '导入数据'}
            <span className="ml-auto font-mono text-caption text-[var(--ink-faint)]">JSON</span>
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
          aria-hidden="true"
        />
      </section>

      {/* About */}
      <section className="card rounded-xl p-5">
        <div className="flex items-center gap-3">
          <Flower mood={null} size={40} variant="head" />
          <div>
            <h2 className="font-serif text-h2 text-[var(--ink)]">花期 Blossom</h2>
            <p className="font-sans text-small text-[var(--ink-soft)]">每一天，开一朵花。</p>
            <p className="mt-1 font-mono text-caption text-[var(--ink-faint)]">
              v{APP_VERSION} · 所有数据存储于浏览器本地
            </p>
          </div>
        </div>
      </section>

      {/* Mood Edit Modal */}
      {showMoodEdit && (
        <MoodEditModal
          onClose={() => { setShowMoodEdit(false); setEditingMood(null); }}
          editMood={editingMood}
        />
      )}
    </div>
  );
}
