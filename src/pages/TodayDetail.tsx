import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getRecordByDate, upsertRecord } from '../lib/db';
import { formatFullDate } from '../lib/dateUtils';
import { MOOD_CONFIGS } from '../lib/constants';
import { useApp } from '../context/AppContext';
import { hexToRgba } from '../lib/colorUtils';
import { useMemo } from 'react';
import MoodSelector from '../components/MoodSelector';
import LearningRecordCard from '../components/LearningRecordCard';
import LearningFormModal from '../components/LearningFormModal';
import DiaryEditor from '../components/DiaryEditor';
import type { MoodType, LearningItem } from '../types';
import { useState, useCallback } from 'react';
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

  const moodConfig = mood ? MOOD_CONFIGS[mood] : null;

  const { theme } = useApp();

  const topGradient = useMemo(() => {
    if (!moodConfig) return null;
    // 浅色模式用 soft 色 35% 做水彩洇开，深色模式用 main 色 8% 做夜灯微光
    const color = theme === 'dark' ? moodConfig.main : moodConfig.soft;
    const alpha = theme === 'dark' ? 0.08 : 0.35;
    return `linear-gradient(180deg, ${hexToRgba(color, alpha)} 0%, transparent 100%)`;
  }, [moodConfig, theme]);

  const handleMoodSelect = useCallback(
    (moodType: MoodType) => {
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
    <div className="animate-fade-up relative">
      {/* 顶部心情渐变晕染 */}
      {topGradient && (
        <div
          className="pointer-events-none fixed left-0 top-0 z-0 h-[120px] w-full"
          style={{ background: topGradient }}
        />
      )}

      {/* 返回 + 日期 */}
      <div className="relative z-10 mb-6 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-soft)] transition-colors hover:text-[var(--color-text)]"
        >
          <ArrowLeft size={18} />
          返回月历
        </button>
        <h1 className="font-hand text-2xl font-semibold text-[var(--color-text)]">
          {formatFullDate(date)}
        </h1>
      </div>

      {/* 心情选择器 */}
      <section className="relative z-10 mb-8">
        <h2 className="mb-3 text-lg font-medium text-[var(--color-text-soft)]">今天心情如何？</h2>
        <MoodSelector selected={mood} onSelect={handleMoodSelect} />
      </section>

      {/* 学习记录区 */}
      <section className="relative z-10 mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium text-[var(--color-text)]">今日学习</h2>
          <button
            onClick={() => {
              setEditingItem(null);
              setShowForm(true);
            }}
            className="pill-dashed flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-[var(--color-text-soft)] transition-all hover:text-[var(--color-text)] hover:shadow-2"
          >
            + 添加记录
          </button>
        </div>

        {learnings.length === 0 ? (
          <button
            onClick={() => {
              setEditingItem(null);
              setShowForm(true);
            }}
            className="w-full rounded-lg border-2 border-dashed p-6 text-center transition-all hover:shadow-2"
            style={{
              borderColor: moodConfig ? moodConfig.glow.replace('0.20', '0.4').replace('0.18', '0.4') : 'rgba(255,185,56,0.3)',
              background: 'var(--color-card)',
            }}
          >
            <span className="font-hand text-base text-[var(--color-text-faint)]">
              ＋ 添加今天的第一段学习
            </span>
            <br />
            <span className="text-xs text-[var(--color-text-faint)]">比如 "React 组件设计"</span>
          </button>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {learnings.map((item) => (
                <LearningRecordCard
                  key={item.id}
                  item={item}
                  mood={mood}
                  onEdit={() => {
                    setEditingItem(item);
                    setShowForm(true);
                  }}
                  onDelete={() => handleDeleteLearning(item.id)}
                />
              ))}
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <span className="text-sm text-[var(--color-text-soft)]">总学习时长</span>
              <span className="font-mono text-lg font-medium text-[var(--color-text)]">
                {formatDuration(totalDuration(learnings))}
              </span>
            </div>
          </>
        )}
      </section>

      {/* 日记区 */}
      <section className="relative z-10">
        <h2 className="mb-3 text-lg font-medium text-[var(--color-text)]">今日想法</h2>
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
