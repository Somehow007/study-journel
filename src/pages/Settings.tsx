import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, Sun, Moon, Download, Upload } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteCustomMood } from '../lib/db';
import MoodEditModal from '../components/MoodEditModal';
import { useDataIO } from '../lib/useDataIO';
import { APP_VERSION } from '../lib/version';
import { PALETTES } from '../lib/constants';
import type { CustomMoodConfig } from '../types';

export default function Settings() {
  const navigate = useNavigate();
  const { theme, toggleTheme, palette, setPalette } = useApp();
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
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-soft)] transition-all hover:bg-[var(--paper)] hover:text-[var(--ink)]"
          aria-label="返回"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-serif text-h1 text-[var(--ink)]">设置</h1>
      </div>

      {/* Theme */}
      <section className="mb-8">
        <h2 className="mb-3 font-sans text-small text-[var(--ink-soft)]">外观</h2>
        <div className="card inline-flex items-center gap-1 rounded-lg p-1">
          <button
            onClick={() => { if (theme !== 'light') toggleTheme(); }}
            className={`flex items-center gap-2 rounded-md px-4 py-2 font-sans text-small transition-all ${
              theme === 'light'
                ? 'bg-[var(--paper)] text-[var(--ink)]'
                : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
            }`}
          >
            <Sun size={16} />
            浅色
          </button>
          <button
            onClick={() => { if (theme !== 'dark') toggleTheme(); }}
            className={`flex items-center gap-2 rounded-md px-4 py-2 font-sans text-small transition-all ${
              theme === 'dark'
                ? 'bg-[var(--paper)] text-[var(--ink)]'
                : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
            }`}
          >
            <Moon size={16} />
            深色
          </button>
        </div>
      </section>

      {/* Color Palette */}
      <section className="mb-8">
        <h2 className="mb-3 font-sans text-small text-[var(--ink-soft)]">配色主题</h2>
        <div className="flex flex-wrap gap-3">
          {PALETTES.map((p) => {
            const active = palette === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setPalette(p.id)}
                className={`card flex w-36 flex-col items-start gap-2 rounded-lg p-3 text-left transition-all ${
                  active ? 'border-[var(--brand)]' : 'hover:border-[var(--ink-faint)]'
                }`}
                style={active ? { boxShadow: '0 0 0 3px color-mix(in srgb, var(--brand) 15%, transparent)' } : undefined}
                aria-pressed={active}
              >
                <span
                  className="flex h-8 w-full items-center justify-center rounded-md border"
                  style={{ background: p.swatch.paper, borderColor: 'var(--hairline)' }}
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full"
                    style={{ background: p.swatch.brand }}
                  />
                </span>
                <span className="font-sans text-small font-semibold text-[var(--ink)]">{p.label}</span>
                <span className="font-sans text-caption text-[var(--ink-faint)]">{p.hint}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Custom Moods */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-sans text-small text-[var(--ink-soft)]">自定义心情</h2>
          <button
            onClick={() => { setEditingMood(null); setShowMoodEdit(true); }}
            className="pill-dashed flex items-center gap-1 px-3 py-1.5 font-sans text-caption text-[var(--ink-soft)] transition-all hover:text-[var(--ink)]"
          >
            <Plus size={14} />
            添加心情
          </button>
        </div>

        {customMoodList.length === 0 ? (
          <div className="card rounded-lg p-8 text-center">
            <p className="font-serif text-body text-[var(--ink-faint)]">
              还没有自定义心情
            </p>
            <p className="mt-1 font-sans text-caption text-[var(--ink-faint)]">
              点击"添加心情"创建属于自己的心情类型
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {customMoodList.map((mood) => (
              <div
                key={mood.id}
                className="card flex items-center justify-between rounded-lg p-4"
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
                    <div className="font-mono text-caption text-[var(--ink-faint)]">
                      {mood.solid}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEditMood(mood)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-faint)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)]"
                    aria-label={`编辑 ${mood.label}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteMood(mood)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-faint)] transition-colors hover:bg-red-500/10 hover:text-red-400"
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
        <h2 className="mb-3 font-sans text-small text-[var(--ink-soft)]">数据管理</h2>
        <div className="card rounded-lg divide-y" style={{ borderColor: 'var(--hairline)' }}>
          <button
            onClick={handleExport}
            className="flex w-full items-center gap-3 px-4 py-3 font-sans text-small text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
          >
            <Download size={18} />
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
            <Upload size={18} />
            {importStatus === 'success' ? '导入成功 ✓' : importStatus === 'error' ? '导入失败 ✕' : '导入数据'}
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
      <section>
        <h2 className="mb-3 font-sans text-small text-[var(--ink-soft)]">关于</h2>
        <div className="card rounded-lg p-4">
          <p className="font-sans text-small text-[var(--ink)]">学习手帐 Study Journal</p>
          <p className="mt-1 font-mono text-caption text-[var(--ink-faint)]">
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
