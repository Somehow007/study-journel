import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, Sun, Moon, Download, Upload } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteCustomMood } from '../lib/db';
import MoodEditModal from '../components/MoodEditModal';
import { useDataIO } from '../lib/useDataIO';
import { APP_VERSION } from '../lib/version';
import type { CustomMoodConfig } from '../types';

export default function Settings() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useApp();
  const [showMoodEdit, setShowMoodEdit] = useState(false);
  const [editingMood, setEditingMood] = useState<CustomMoodConfig | null>(null);
  const { importStatus, handleExport, triggerImport, handleFileChange, fileInputRef } = useDataIO();

  const customMoods = useLiveQuery(
    () => db.customMoods.orderBy('createdAt').toArray(),
    [],
  );

  const customMoodList = customMoods ?? [];

  const handleEditMood = (mood: CustomMoodConfig) => {
    setEditingMood(mood);
    setShowMoodEdit(true);
  };

  const handleDeleteMood = async (mood: CustomMoodConfig) => {
    const confirmed = window.confirm(
      `确定要删除"${mood.label}"心情吗？`
    );
    if (!confirmed) return;
    await deleteCustomMood(mood.id);
  };

  return (
    <div className="animate-fade-up max-w-2xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-soft)] transition-all hover:bg-[var(--color-card)] hover:text-[var(--color-text)]"
          aria-label="返回"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-hand text-2xl font-semibold text-[var(--color-text)]">设置</h1>
      </div>

      {/* Theme */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-[var(--color-text-soft)]">外观</h2>
        <div className="glass rounded-xl p-1 shadow-2 inline-flex items-center gap-1">
          <button
            onClick={() => { if (theme !== 'light') toggleTheme(); }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              theme === 'light'
                ? 'glass text-[var(--color-text)] shadow-2'
                : 'text-[var(--color-text-soft)] hover:text-[var(--color-text)]'
            }`}
          >
            <Sun size={16} />
            浅色
          </button>
          <button
            onClick={() => { if (theme !== 'dark') toggleTheme(); }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              theme === 'dark'
                ? 'glass text-[var(--color-text)] shadow-2'
                : 'text-[var(--color-text-soft)] hover:text-[var(--color-text)]'
            }`}
          >
            <Moon size={16} />
            深色
          </button>
        </div>
      </section>

      {/* Custom Moods */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-[var(--color-text-soft)]">自定义心情</h2>
          <button
            onClick={() => { setEditingMood(null); setShowMoodEdit(true); }}
            className="pill-dashed flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[var(--color-text-soft)] transition-all hover:text-[var(--color-text)] hover:shadow-2"
          >
            <Plus size={14} />
            添加心情
          </button>
        </div>

        {customMoodList.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center shadow-2">
            <p className="font-hand text-base text-[var(--color-text-faint)]">
              还没有自定义心情
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-faint)]">
              点击"添加心情"创建属于自己的心情类型
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {customMoodList.map((mood) => (
              <div
                key={mood.id}
                className="glass flex items-center justify-between rounded-xl p-4 shadow-2"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full"
                    style={{
                      background: mood.gradient,
                      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 0 10px ${mood.glow}`,
                    }}
                  >
                    <span className="text-base" style={{ filter: 'brightness(0) invert(1)' }}>{mood.emoji}</span>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-[var(--color-text)]">{mood.label}</div>
                    <div className="font-mono text-[10px] text-[var(--color-text-faint)]">
                      {mood.main}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEditMood(mood)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-text-faint)] transition-colors hover:bg-[var(--color-card)] hover:text-[var(--color-text)]"
                    aria-label={`编辑 ${mood.label}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteMood(mood)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-text-faint)] transition-colors hover:bg-red-500/10 hover:text-red-400"
                    aria-label={`删除 ${mood.label}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Data Management */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-[var(--color-text-soft)]">数据管理</h2>
        <div className="glass rounded-xl shadow-2 divide-y divide-[var(--color-line)]">
          <button
            onClick={handleExport}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-[var(--color-text-soft)] transition-colors hover:text-[var(--color-text)]"
          >
            <Download size={18} />
            导出全部数据
            <span className="ml-auto font-mono text-xs text-[var(--color-text-faint)]">JSON</span>
          </button>
          <button
            onClick={triggerImport}
            className={`flex w-full items-center gap-3 px-4 py-3 text-sm font-medium transition-colors hover:text-[var(--color-text)] ${
              importStatus === 'success'
                ? 'text-green-500'
                : importStatus === 'error'
                  ? 'text-red-400'
                  : 'text-[var(--color-text-soft)]'
            }`}
          >
            <Upload size={18} />
            {importStatus === 'success' ? '导入成功 ✓' : importStatus === 'error' ? '导入失败 ✕' : '导入数据'}
            <span className="ml-auto font-mono text-xs text-[var(--color-text-faint)]">JSON</span>
          </button>
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
      </section>

      {/* About */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-[var(--color-text-soft)]">关于</h2>
        <div className="glass rounded-xl p-4 shadow-2">
          <p className="text-sm text-[var(--color-text)]">学习手帐 Study Journal</p>
          <p className="mt-1 text-xs text-[var(--color-text-faint)]">
            v{APP_VERSION} · 所有数据存储于浏览器本地
          </p>
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
