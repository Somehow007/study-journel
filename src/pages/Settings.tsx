import { useState } from 'react';
import { Plus, Pencil, Trash2, Sun, Moon, Download, Upload, RefreshCw, BookOpen, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { deleteCustomMood, getCustomMoods } from '../lib/api';
import { useApiQuery } from '../lib/useApiQuery';
import MoodEditModal from '../components/MoodEditModal';
import { QueryError, QueryLoading } from '../components/QueryState';
import { Pressable } from '../components/ui/Pressable';
import { useDataIO } from '../lib/useDataIO';
import { APP_VERSION } from '../lib/version';
import { showToast } from '../lib/toast';
import { askConfirm } from '../lib/confirm';
import {
  THEME_PICKER_ITEMS,
  getThemeMeta,
  isPickerThemeActive,
  isThemeDark,
} from '../lib/theme';
import type { CustomMoodConfig } from '../types';

export default function Settings() {
  const { theme, setTheme, toggleTheme, isDark, dailyGoalMin, setDailyGoalMin } = useApp();
  const [showMoodEdit, setShowMoodEdit] = useState(false);
  const [editingMood, setEditingMood] = useState<CustomMoodConfig | null>(null);
  const {
    importStatus,
    migrating,
    handleExport,
    triggerImport,
    handleFileChange,
    handleMigrateLocal,
    fileInputRef,
  } = useDataIO();

  const { data: customMoods, loading, error, refresh } = useApiQuery(getCustomMoods, []);
  const customMoodList = customMoods ?? [];

  const handleEditMood = (mood: CustomMoodConfig) => {
    setEditingMood(mood);
    setShowMoodEdit(true);
  };

  const handleDeleteMood = async (mood: CustomMoodConfig) => {
    const confirmed = await askConfirm({
      title: '删除心情',
      message: `确定要删除「${mood.label}」心情吗？`,
      confirmLabel: '删除',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await deleteCustomMood(mood.id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '删除失败');
    }
  };

  return (
    <div className="max-w-2xl">
      <header className="mb-6">
        <h1 className="font-sans text-h1 text-[var(--ink)]">设置</h1>
        <p className="mt-1 font-sans text-caption text-[var(--ink-faint)]">外观、目标与数据</p>
      </header>

      <section className="card mb-6 rounded-xl p-5">
        <h2 className="mb-3 font-sans text-h2 text-[var(--ink)]">外观</h2>
        <Pressable
          onClick={toggleTheme}
          className="mb-4 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 font-sans text-small text-[var(--ink-soft)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
        >
          {isDark ? <Moon size={16} strokeWidth={1.75} /> : <Sun size={16} strokeWidth={1.75} />}
          {isDark ? '切换亮色' : '切换暗色'}
        </Pressable>
        <div className="grid grid-cols-2 gap-2">
          {THEME_PICKER_ITEMS.map((item) => {
            const active = isPickerThemeActive(theme, item);
            return (
              <Pressable
                key={item.id}
                onClick={() => setTheme(item.id)}
                aria-current={active ? 'true' : undefined}
                className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 ${
                  active
                    ? 'border-[var(--brand)] bg-[var(--brand-soft)]'
                    : 'border-[var(--keyline)] hover:border-[var(--brand)]'
                }`}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--hairline)]"
                  style={{ backgroundColor: item.preview.bg }}
                >
                  <div className="h-5 w-5 rounded-md" style={{ backgroundColor: item.preview.accent }} />
                </div>
                <span className="w-full truncate text-center font-sans text-caption text-[var(--ink-soft)]">
                  {item.name}
                </span>
                {active && <Check size={12} className="text-[var(--brand)]" />}
              </Pressable>
            );
          })}
        </div>
        <p className="mt-3 font-sans text-caption text-[var(--ink-faint)]">
          与博客共用主题（当前：{getThemeMeta(theme)?.name ?? theme}
          {isThemeDark(theme) ? ' · 暗色' : ''}）。同域下两边会一起变。
        </p>
      </section>

      <section className="card mb-6 rounded-xl p-5">
        <h2 className="font-sans text-h2 text-[var(--ink)]">每日学习目标</h2>
        <p className="mt-1 mb-4 font-sans text-small text-[var(--ink-faint)]">
          日历里每天的学习进度条以它为满格；达成目标的日子会标满。
        </p>
        <div className="flex flex-wrap gap-2">
          {[60, 120, 180, 240, 360, 480].map((min) => (
            <Pressable
              key={min}
              variant="pill"
              onClick={() => setDailyGoalMin(min)}
              className={`rounded-full border px-4 py-1.5 font-mono text-small ${
                dailyGoalMin === min
                  ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]'
                  : 'border-[var(--hairline)] text-[var(--ink-soft)]'
              }`}
            >
              {min / 60}h
            </Pressable>
          ))}
        </div>
      </section>

      <section className="card mb-6 rounded-xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-sans text-h2 text-[var(--ink)]">自定义心情</h2>
          <Pressable
            variant="pill"
            onClick={() => {
              setEditingMood(null);
              setShowMoodEdit(true);
            }}
            className="pill-dashed inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-sans text-caption text-[var(--ink-soft)]"
          >
            <Plus size={14} strokeWidth={1.75} />
            添加心情
          </Pressable>
        </div>
        <p className="mb-4 font-sans text-small text-[var(--ink-faint)]">自定义心情会以色点显示在日历上。</p>

        {loading && !customMoods ? (
          <QueryLoading />
        ) : error && !customMoods ? (
          <QueryError message={error.message} onRetry={refresh} />
        ) : customMoodList.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--hairline)] py-8 text-center">
            <p className="font-sans text-body text-[var(--ink-faint)]">还没有自定义心情</p>
            <p className="mt-1 font-sans text-caption text-[var(--ink-faint)]">点击「添加心情」创建属于自己的心情类型</p>
          </div>
        ) : (
          <div className="space-y-2">
            {customMoodList.map((mood) => (
              <div
                key={mood.id}
                className="flex items-center justify-between rounded-xl border border-[var(--hairline)] bg-[var(--card)] p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: mood.solid }}>
                    <span className="text-base" style={{ color: 'white' }}>
                      {mood.emoji}
                    </span>
                  </div>
                  <div>
                    <div className="font-sans text-small text-[var(--ink)]">{mood.label}</div>
                    <div className="font-mono text-caption text-[var(--ink-faint)]">{mood.solid}</div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Pressable
                    variant="icon"
                    onClick={() => handleEditMood(mood)}
                    className="flex items-center justify-center rounded-full text-[var(--ink-faint)]"
                    aria-label={`编辑 ${mood.label}`}
                  >
                    <Pencil size={14} strokeWidth={1.75} />
                  </Pressable>
                  <Pressable
                    variant="icon"
                    onClick={() => void handleDeleteMood(mood)}
                    className="flex items-center justify-center rounded-full text-[var(--ink-faint)] hover:bg-[var(--danger-subtle)] hover:text-[var(--danger)]"
                    aria-label={`删除 ${mood.label}`}
                  >
                    <Trash2 size={14} strokeWidth={1.75} />
                  </Pressable>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card mb-6 rounded-xl p-5">
        <h2 className="mb-3 font-sans text-h2 text-[var(--ink)]">数据管理</h2>
        <div className="divide-y rounded-xl border border-[var(--hairline)]">
          <Pressable
            onClick={() => void handleExport()}
            className="flex w-full items-center gap-3 px-4 py-3 font-sans text-small text-[var(--ink-soft)]"
          >
            <Download size={18} strokeWidth={1.75} />
            导出全部数据
            <span className="ml-auto font-mono text-caption text-[var(--ink-faint)]">JSON</span>
          </Pressable>
          <Pressable
            onClick={triggerImport}
            className={`flex w-full items-center gap-3 px-4 py-3 font-sans text-small ${
              importStatus === 'success'
                ? 'text-[var(--pine)]'
                : importStatus === 'error'
                  ? 'text-[var(--danger)]'
                  : 'text-[var(--ink-soft)]'
            }`}
          >
            <Upload size={18} strokeWidth={1.75} />
            {importStatus === 'success' ? '导入成功' : importStatus === 'error' ? '导入失败' : '导入数据'}
            <span className="ml-auto font-mono text-caption text-[var(--ink-faint)]">JSON</span>
          </Pressable>
          <Pressable
            onClick={() => void handleMigrateLocal()}
            disabled={migrating}
            className="flex w-full items-center gap-3 px-4 py-3 font-sans text-small text-[var(--ink-soft)]"
          >
            <RefreshCw size={18} strokeWidth={1.75} className={migrating ? 'animate-spin' : ''} />
            {migrating ? '迁移中…' : '迁移本地旧数据'}
            <span className="ml-auto font-mono text-caption text-[var(--ink-faint)]">IndexedDB → 服务器</span>
          </Pressable>
        </div>
        <p className="mt-3 font-sans text-caption text-[var(--ink-faint)]">
          数据已存储在服务器（与博客同源，跨设备同步）。「迁移本地旧数据」用于把本浏览器 IndexedDB
          中的第一期历史数据合并上传，幂等可重复。
        </p>
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} className="hidden" aria-hidden="true" />
      </section>

      <section className="card rounded-xl p-5">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text-inverse)]"
            style={{ background: 'var(--brand)' }}
          >
            <BookOpen size={18} />
          </span>
          <div>
            <h2 className="font-sans text-h2 text-[var(--ink)]">手帐</h2>
            <p className="font-sans text-small text-[var(--ink-soft)]">学习记录与心情台账</p>
            <p className="mt-1 font-mono text-caption text-[var(--ink-faint)]">
              v{APP_VERSION} · 已同步
            </p>
          </div>
        </div>
      </section>

      {showMoodEdit && (
        <MoodEditModal
          onClose={() => {
            setShowMoodEdit(false);
            setEditingMood(null);
          }}
          editMood={editingMood}
        />
      )}
    </div>
  );
}
