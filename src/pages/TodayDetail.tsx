import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus } from 'lucide-react';
import { useState, useCallback, useMemo } from 'react';
import { db, getRecordByDate, upsertRecord } from '../lib/db';
import { useMoodConfig } from '../lib/moodUtils';
import MoodSelector from '../components/MoodSelector';
import LearningRecordCard, { formatDurationHM } from '../components/LearningRecordCard';
import LearningFormModal from '../components/LearningFormModal';
import DiaryEditor from '../components/DiaryEditor';
import SproutBadge from '../components/SproutBadge';
import Flower from '../components/Flower';
import { computeStreak } from '../lib/streak';
import { totalDuration } from '../lib/dateUtils';
import type { LearningItem } from '../types';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const QUOTES = [
  '把时间种下去，就会开花。',
  '疲惫的日子也要记录，花照样开。',
  '每天种一朵花，月末会有一束。',
  '学习是缓慢的园艺，急不来。',
  '今天的阳光，是昨天记录的回响。',
  '不必每天都盛满，种下就好。',
  '花田属于那些愿意弯下腰的人。',
  '把心情写下来，就像给花浇水。',
];

function dailyQuote(dateStr: string): string {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) hash = (hash * 31 + dateStr.charCodeAt(i)) >>> 0;
  return QUOTES[hash % QUOTES.length];
}

export default function TodayDetail() {
  const { date } = useParams<{ date: string }>();
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<LearningItem | null>(null);

  const record = useLiveQuery(() => (date ? getRecordByDate(date) : undefined), [date]);
  const allRecords = useLiveQuery(() => db.records.toArray(), []);

  const mood = record?.mood ?? null;
  const learnings = record?.learnings ?? [];
  const diary = record?.diary ?? '';

  const moodConfig = useMoodConfig(mood);

  const dateObj = useMemo(() => {
    if (!date) return null;
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [date]);

  const formattedDate = dateObj
    ? `${dateObj.getMonth() + 1}月${dateObj.getDate()}日`
    : date || '';
  const weekday = dateObj ? `星期${WEEKDAYS[dateObj.getDay()]}` : '';
  const latinDate = dateObj
    ? dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : '';

  const quote = date ? dailyQuote(date) : '';

  const totalMin = totalDuration(learnings);
  const stemNorm = useMemo(() => Math.min(1, Math.max(0.08, totalMin / 360)), [totalMin]);

  const streak = useMemo(() => {
    if (!allRecords) return 0;
    return computeStreak(allRecords.map((r) => r.date));
  }, [allRecords]);

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

  const openAdd = useCallback(() => {
    setEditingItem(null);
    setShowForm(true);
  }, []);

  if (!date) return null;

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <header className="mb-6">
        {/* mockup .page-head：大标题在上、星期小注在下，徽章底对齐（align-items:flex-end） */}
        <div className="mb-1 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-h1 text-[var(--ink)]">{formattedDate}</h1>
            <p className="mt-2 font-sans text-caption text-[var(--ink-faint)]">
              {weekday} · <span className="font-displaylatin italic">{latinDate}</span>
            </p>
          </div>
          <SproutBadge days={streak} />
        </div>

        {/* Daily quote（mockup .quote-card：无底色，3px 叶绿左边框） */}
        <div
          className="mt-4 border-l-[3px] py-1.5 pl-[22px] pr-3"
          style={{ borderColor: 'var(--pine)' }}
        >
          <p className="font-serif text-[17px] leading-relaxed text-[var(--ink-soft)]" style={{ letterSpacing: '0.03em' }}>「{quote}」</p>
          <p className="mt-1.5 font-sans text-caption text-[var(--ink-faint)]">每日一句</p>
        </div>
      </header>

      {/* Hero: flower + mood selector（mockup .hero-card：padding 40/44，gap 48） */}
      <section
        className="card mb-6 flex flex-col items-center gap-8 rounded-xl p-7 sm:flex-row sm:items-center sm:justify-between sm:gap-12 sm:p-10"
      >
        <div className="flex flex-col items-center gap-2 sm:w-56">
          <Flower
            mood={moodConfig}
            size={150}
            stem={stemNorm}
            variant="full"
            className={moodConfig ? 'animate-bloom-in' : ''}
          />
          {moodConfig && (
            <span className="font-sans text-caption" style={{ color: 'var(--ink-soft)' }}>
              {moodConfig.flower ?? moodConfig.label}
            </span>
          )}
        </div>

        <div className="flex-1">
          <h2 className="mb-1 text-center font-serif text-h2 text-[var(--ink)] sm:text-left">
            今天是什么心情？
          </h2>
          <MoodSelector selected={mood} onSelect={handleMoodSelect} />
          <p className="mt-4 text-center font-sans text-caption text-[var(--ink-faint)] sm:text-left">
            盖下一朵花，记录今天
          </p>
        </div>
      </section>

      {/* Learning records */}
      <section className="card mb-6 rounded-xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-h2 text-[var(--ink)]">今日学习</h2>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--keyline)] px-3 py-1.5 font-sans text-small text-[var(--ink-soft)] transition-all hover:border-[var(--brand)] hover:text-[var(--brand)]"
          >
            <Plus size={14} strokeWidth={1.75} />
            添加
          </button>
        </div>

        {learnings.length === 0 ? (
          <button
            onClick={openAdd}
            className="w-full rounded-lg border border-dashed border-[var(--hairline)] py-8 text-center transition-colors hover:bg-[var(--paper)]"
          >
            <span className="font-sans text-body text-[var(--ink-faint)]">
              ＋ 记下今天的第一段学习
            </span>
          </button>
        ) : (
          // mockup .study-card：无外框，行以 hairline 分隔，合计右对齐无底色
          <div>
            {learnings.map((item, idx) => (
              <div
                key={item.id}
                className={idx < learnings.length - 1 ? 'border-b border-[var(--hairline)]' : ''}
              >
                <LearningRecordCard
                  item={item}
                  onEdit={() => {
                    setEditingItem(item);
                    setShowForm(true);
                  }}
                  onDelete={() => handleDeleteLearning(item.id)}
                />
              </div>
            ))}
            <div className="flex items-center justify-end gap-2.5 pt-5">
              <span className="font-sans text-small text-[var(--ink-soft)]">合计</span>
              <span className="font-mono text-num-lg text-[var(--ink)]">{formatDurationHM(totalMin)}</span>
            </div>
          </div>
        )}
      </section>

      {/* Diary */}
      <section>
        <h2 className="mb-3 font-serif text-h2 text-[var(--ink)]">今日想法</h2>
        <DiaryEditor value={diary} onChange={handleDiaryChange} mood={mood} />
      </section>

      {/* Modal */}
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
