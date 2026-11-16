import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Sun, Moon, Download, Upload, RefreshCw, BookOpen, Check, LogOut } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { archiveState } from '../lib/api';
import { logout } from '../lib/auth';
import { useStates, invalidateAll } from '../lib/queries';
import StateEditModal from '../components/StateEditModal';
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
import type { JournalState } from '../lib/types/api';

export default function Settings() {
  const qc = useQueryClient();
  const { theme, setTheme, toggleTheme, isDark, dailyGoalMin, setDailyGoalMin, user } = useApp();
  const [showStateEdit, setShowStateEdit] = useState(false);
  const [editingState, setEditingState] = useState<JournalState | null>(null);
  const {
    importStatus,
    migrating,
    handleExport,
    triggerImport,
    handleFileChange,
    handleMigrateLocal,
    fileInputRef,
  } = useDataIO();

  const { data: states, isPending, error, refetch } = useStates();
  const customStates = (states ?? []).filter((s) => s.builtinKey == null && s.archivedAt == null);

  const handleEditState = (state: JournalState) => {
    setEditingState(state);
    setShowStateEdit(true);
  };

  const handleDeleteState = async (state: JournalState) => {
    const confirmed = await askConfirm({
      title: '删除状态',
      message: `确定要删除「${state.label}」吗？历史记录仍会保留该状态标记。`,
      confirmLabel: '删除',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await archiveState(state.id);
      invalidateAll(qc);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleLogout = async () => {
    const confirmed = await askConfirm({
      title: '退出登录',
      message: '退出后需要重新登录才能查看手帐。',
      confirmLabel: '退出',
    });
    if (!confirmed) return;
    await logout();
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
          主题保存在账号、跨设备同步（当前：{getThemeMeta(theme)?.name ?? theme}
          {isThemeDark(theme) ? ' · 暗色' : ''}）。
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
          <h2 className="font-sans text-h2 text-[var(--ink)]">自定义状态</h2>
          <Pressable
            variant="pill"
            onClick={() => {
              setEditingState(null);
              setShowStateEdit(true);
            }}
            className="pill-dashed inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-sans text-caption text-[var(--ink-soft)]"
          >
            <Plus size={14} strokeWidth={1.75} />
            添加状态
          </Pressable>
        </div>
        <p className="mb-4 font-sans text-small text-[var(--ink-faint)]">
          自定义状态会以色点显示在日历上；删除后历史记录保留原标记。
        </p>

        {isPending && !states ? (
          <QueryLoading />
        ) : error && !states ? (
          <QueryError message={error.message} onRetry={() => void refetch()} />
        ) : customStates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--hairline)] py-8 text-center">
            <p className="font-sans text-body text-[var(--ink-faint)]">还没有自定义状态</p>
            <p className="mt-1 font-sans text-caption text-[var(--ink-faint)]">点击「添加状态」创建属于自己的状态类型</p>
          </div>
        ) : (
          <div className="space-y-2">
            {customStates.map((state) => (
              <div
                key={state.id}
                className="flex items-center justify-between rounded-xl border border-[var(--hairline)] bg-[var(--card)] p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="h-4 w-4 rounded-full" style={{ background: state.color }} />
                  <div>
                    <div className="font-sans text-small text-[var(--ink)]">{state.label}</div>
                    <div className="font-mono text-caption text-[var(--ink-faint)]">
                      {state.polarity === 1 ? '积极' : state.polarity === -1 ? '消极' : '中性'} · {state.color}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Pressable
                    variant="icon"
                    onClick={() => handleEditState(state)}
                    className="flex items-center justify-center rounded-full text-[var(--ink-faint)]"
                    aria-label={`编辑 ${state.label}`}
                  >
                    <Pencil size={14} strokeWidth={1.75} />
                  </Pressable>
                  <Pressable
                    variant="icon"
                    onClick={() => void handleDeleteState(state)}
                    className="flex items-center justify-center rounded-full text-[var(--ink-faint)] hover:bg-[var(--danger-subtle)] hover:text-[var(--danger)]"
                    aria-label={`删除 ${state.label}`}
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
          数据保存在手帐服务器。「迁移本地旧数据」把本浏览器 IndexedDB 中的第一期历史数据
          合并上传一次，幂等可重复。
        </p>
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} className="hidden" aria-hidden="true" />
      </section>

      <section className="card mb-6 rounded-xl p-5">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text-inverse)]"
            style={{ background: 'var(--brand)' }}
          >
            <BookOpen size={18} />
          </span>
          <div>
            <h2 className="font-sans text-h2 text-[var(--ink)]">手帐</h2>
            <p className="font-sans text-small text-[var(--ink-soft)]">学习记录与状态台账</p>
            <p className="mt-1 font-mono text-caption text-[var(--ink-faint)]">
              v{APP_VERSION} · {user?.username ?? ''}
            </p>
          </div>
        </div>
      </section>

      <Pressable
        onClick={() => void handleLogout()}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--keyline)] px-4 py-3 font-sans text-small text-[var(--ink-soft)] hover:text-[var(--ink)]"
      >
        <LogOut size={16} strokeWidth={1.75} />
        退出登录
      </Pressable>

      {showStateEdit && (
        <StateEditModal
          onClose={() => {
            setShowStateEdit(false);
            setEditingState(null);
          }}
          editState={editingState}
        />
      )}
    </div>
  );
}
