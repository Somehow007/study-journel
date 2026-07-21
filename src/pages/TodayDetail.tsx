import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getRecordByDate, upsertRecord } from '../lib/db';

import { useMoodConfig } from '../lib/moodUtils';
import { useApp } from '../context/AppContext';
import MoodSeal from '../assets/moods';
import MoodSelector from '../components/MoodSelector';
import LearningRecordCard from '../components/LearningRecordCard';
import LearningFormModal from '../components/LearningFormModal';
import DiaryEditor from '../components/DiaryEditor';
import type { LearningItem } from '../types';
import { useState, useCallback, useMemo } from 'react';
import { totalDuration, formatDuration } from '../lib/dateUtils';

export default function TodayDetail() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<LearningItem | null>(null);

  const record = useLiveQuery(() => (date ? getRecordByDate(date) : undefined), [date]);

  const mood = record?.mood ?? null;
  const learnings = record?.learnings ?? [];
  const diary = record?.diary ?? '';

  const moodConfig = useMoodConfig(mood);
  const { theme } = useApp();
  const isDark = theme === 'dark';

  // Washi tape color: mood tint or hairline if no mood
  const washiColor = moodConfig
    ? (isDark ? moodConfig.dark.tint : moodConfig.tint)
    : 'var(--hairline)';

  // Parse date for display
  const dateObj = useMemo(() => {
    if (!date) return null;
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [date]);

  const formattedDate = dateObj
    ? `${dateObj.getMonth() + 1}月${dateObj.getDate()}日 星期${['日', '一', '二', '三', '四', '五', '六'][dateObj.getDay()]}`
    : date || '';

  // Latin date for washi tape (e.g., "Fri, Jul 18")
  const latinDate = dateObj
    ? dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : '';

  const totalMin = totalDuration(learnings);

  const handleMoodSelect = useCallback(
    (moodType: string) => {
      if (date) upsertRecord(date, { mood: moodType });
    },
    [date],
  );

  const handleAddLearning = useCallback(
    (item: LearningItem) => {
      if (!date) return;
      const newLearnings = [...learnings, item];
      upsertRecord(date, { learnings: newLearnings });
      setShowForm(false);
    },
    [date, learnings],
  );

  const handleUpdateLearning = useCallback(
    (item: LearningItem) => {
      if (!date) return;
      const newLearnings = learnings.map((l) => (l.id === item.id ? item : l));
      upsertRecord(date, { learnings: newLearnings });
      setEditingItem(null);
      setShowForm(false);
    },
    [date, learnings],
  );

  const handleDeleteLearning = useCallback(
    (id: string) => {
      if (!date) return;
      const newLearnings = learnings.filter((l) => l.id !== id);
      upsertRecord(date, { learnings: newLearnings });
    },
    [date, learnings],
  );

  const handleDiaryChange = useCallback(
    (text: string) => {
      if (date) upsertRecord(date, { diary: text });
    },
    [date],
  );

  if (!date) return null;

  return (
    <div className="animate-fade-up relative" style={{ maxWidth: '720px', margin: '0 auto' }}>
      {/* 和纸胶带 — 页眉顶部 */}
      <div className="mb-4 flex justify-center">
        <div
          className="washi flex items-center justify-center font-hand text-caption"
          style={{ background: washiColor, width: '120px', color: 'var(--ink-soft)' }}
        >
          {latinDate}
        </div>
      </div>

      {/* 返回 + 日期标题 */}
      <div className="relative z-10 mb-2 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 font-sans text-small text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
        >
          <ArrowLeft size={18} />
          返回月历
        </button>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <h1 className="font-serif text-h1 text-[var(--ink)]">
          {formattedDate}
        </h1>
        {mood && moodConfig && <MoodSeal moodType={mood} size={32} tone="seal" />}
      </div>

      {/* 缝线分隔 */}
      <div className="stitched mb-6" />

      {/* 心情选择区 */}
      <section className="relative z-10 mb-6">
        <h2 className="mb-4 flex items-center font-serif text-h2 text-[var(--ink)]">
          <span className="title-tick" />
          今天的心情
        </h2>
        <MoodSelector selected={mood} onSelect={handleMoodSelect} />
      </section>

      {/* 缝线分隔 */}
      <div className="stitched mb-6" />

      {/* 学习记录区 — 账簿清单 */}
      <section className="relative z-10 mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center font-serif text-h2 text-[var(--ink)]">
            <span className="title-tick" />
            今日学习
          </h2>
          <button
            onClick={() => {
              setEditingItem(null);
              setShowForm(true);
            }}
            className="rounded-full border border-[var(--brand)] px-3 py-1.5 font-sans text-small text-[var(--brand)] transition-all hover:bg-[var(--brand)] hover:text-white"
          >
            + 添加
          </button>
        </div>

        {learnings.length === 0 ? (
          <button
            onClick={() => {
              setEditingItem(null);
              setShowForm(true);
            }}
            className="w-full rounded-lg border border-dashed border-[var(--hairline)] py-8 text-center transition-colors hover:bg-[var(--paper)]"
          >
            <span className="font-sans text-body text-[var(--ink-faint)]">
              ＋ 记下今天的第一段学习
            </span>
          </button>
        ) : (
          <div className="card rounded-lg overflow-hidden">
            {/* Header row */}
            <div
              className="flex items-center gap-3 px-2 py-2"
              style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--paper)' }}
            >
              <span className="w-[10px] shrink-0" />
              <span className="flex-1 font-sans text-caption text-[var(--ink-faint)]">学科</span>
              <span className="shrink-0 font-sans text-caption text-[var(--ink-faint)]">时长</span>
              <span className="w-14 shrink-0" />
            </div>
            {learnings.map((item) => (
              <LearningRecordCard
                key={item.id}
                item={item}
                onEdit={() => {
                  setEditingItem(item);
                  setShowForm(true);
                }}
                onDelete={() => handleDeleteLearning(item.id)}
              />
            ))}
            {/* 合计行 */}
            <div
              className="flex items-center justify-end gap-3 px-2 py-3"
              style={{ background: 'var(--paper)' }}
            >
              <span className="font-sans text-caption text-[var(--ink-soft)]">合计</span>
              <span className="font-mono text-num-lg text-[var(--ink)]">
                {formatDuration(totalMin)}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* 缝线分隔 */}
      <div className="stitched mb-6" />

      {/* 日记区 — 衬线信纸 */}
      <section className="relative z-10">
        <h2 className="mb-4 flex items-center font-serif text-h2 text-[var(--ink)]">
          <span className="title-tick" />
          今日想法
        </h2>
        <DiaryEditor value={diary} onChange={handleDiaryChange} mood={mood} />
      </section>

      {/* 添加/编辑学习记录弹窗 */}
      {showForm && (
        <LearningFormModal
          item={editingItem}
          onConfirm={editingItem ? handleUpdateLearning : handleAddLearning}
          onClose={() => {
            setShowForm(false);
            setEditingItem(null);
          }}
        />
      )}
    </div>
  );
}
