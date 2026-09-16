import { useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useState, useCallback, useMemo } from 'react';
import { getRecordByDate, getRecordsByYear, getStreak, upsertRecord } from '../lib/api';
import { useApiQuery } from '../lib/useApiQuery';
import { useMoodConfig } from '../lib/moodUtils';
import { showToast } from '../lib/toast';
import { computeStreak } from '../lib/streak';
import MoodSelector from '../components/MoodSelector';
import LearningRecordCard, { formatDurationHM } from '../components/LearningRecordCard';
import LearningFormModal from '../components/LearningFormModal';
import DiaryEditor from '../components/DiaryEditor';
import SproutBadge from '../components/SproutBadge';
import { QueryError, QueryLoading } from '../components/QueryState';
import { totalDuration } from '../lib/dateUtils';
import type { LearningItem } from '../types';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const QUOTES = [
  '记下今天，明天才有据可查。',
  '进度不靠感觉，靠一条条记录。',
  '短短几分钟，也值得写下来。',
  '连续比完美更重要。',
  '把心情和学习放在同一页。',
  '不必每天都盛满，写下来就好。',
  '台账属于愿意打开它的人。',
  '今天的一行字，是明天的线索。',
];

function dailyQuote(dateStr: string): string {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) hash = (hash * 31 + dateStr.charCodeAt(i)) >>> 0;
  return QUOTES[hash % QUOTES.length];
}

async function loadStreak(): Promise<number> {
  try {
    const res = await getStreak();
    if (typeof res?.days === 'number') return res.days;
  } catch {
    /* 主路径失败时回退：当年 + 跨年时上年记录，规则与后端一致（今天无记录 = 0） */
  }
  const year = new Date().getFullYear();
  const current = await getRecordsByYear(year);
  const needPrev = new Date().getMonth() === 0;
  const prev = needPrev ? await getRecordsByYear(year - 1) : [];
  return computeStreak([...current, ...prev].map((r) => r.date));
}

export default function TodayDetail() {
  const { date } = useParams<{ date: string }>();
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<LearningItem | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);

  const { data: record, loading, error, refresh } = useApiQuery(
    () => (date ? getRecordByDate(date) : Promise.resolve(undefined)),
    [date],
  );
  const { data: streakDays } = useApiQuery(loadStreak, []);

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
  const quote = date ? dailyQuote(date) : '';
  const totalMin = totalDuration(learnings);
  const streak = streakDays ?? 0;

  const savePatch = useCallback(
    async (patch: { mood?: string; learnings?: LearningItem[]; diary?: string }) => {
      if (!date) return;
      try {
        await upsertRecord(date, patch);
        setWriteError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : '保存失败';
        setWriteError(message);
        showToast(message);
        throw err;
      }
    },
    [date],
  );

  const handleMoodSelect = useCallback(
    async (moodType: string) => {
      try {
        await savePatch({ mood: moodType });
      } catch {
        /* toast already shown */
      }
    },
    [savePatch],
  );

  const handleAddLearning = useCallback(
    async (item: LearningItem) => {
      await savePatch({ learnings: [...learnings, item] });
      setShowForm(false);
    },
    [learnings, savePatch],
  );

  const handleUpdateLearning = useCallback(
    async (item: LearningItem) => {
      await savePatch({ learnings: learnings.map((l) => (l.id === item.id ? item : l)) });
      setEditingItem(null);
      setShowForm(false);
    },
    [learnings, savePatch],
  );

  const handleDeleteLearning = useCallback(
    async (id: string) => {
      try {
        await savePatch({ learnings: learnings.filter((l) => l.id !== id) });
      } catch {
        /* toast already shown */
      }
    },
    [learnings, savePatch],
  );

  const handleDiarySave = useCallback(
    (text: string) => savePatch({ diary: text }),
    [savePatch],
  );

  const openAdd = useCallback(() => {
    setEditingItem(null);
    setShowForm(true);
  }, []);

  if (!date) return null;
  if (loading && !record) return <QueryLoading />;
  if (error && !record) {
    return <QueryError message={error.message} onRetry={refresh} />;
  }

  return (
    <div className="animate-fade-up">
      <header className="mb-6">
        <div className="mb-1 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-sans text-h1 text-[var(--ink)]">{formattedDate}</h1>
            <p className="mt-2 font-sans text-caption text-[var(--ink-faint)]">{weekday}</p>
          </div>
          <SproutBadge days={streak} />
        </div>

        <div
          className="mt-4 border-l-[3px] py-1.5 pl-[22px] pr-3"
          style={{ borderColor: 'var(--brand)' }}
        >
          <p className="font-sans text-[17px] leading-relaxed text-[var(--ink-soft)]">「{quote}」</p>
          <p className="mt-1.5 font-sans text-caption text-[var(--ink-faint)]">每日一句</p>
        </div>
      </header>

      {writeError && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 font-sans text-small text-red-600 dark:bg-red-950/40 dark:text-red-300">
          {writeError}
        </p>
      )}

      <section className="card mb-6 rounded-xl p-6 sm:p-8">
        <h2 className="mb-3 font-sans text-h2 text-[var(--ink)]">今天是什么心情？</h2>
        <MoodSelector selected={mood} onSelect={handleMoodSelect} />
        <p className="mt-4 font-sans text-caption text-[var(--ink-faint)]">
          {moodConfig ? `已记：${moodConfig.label}` : '点选心情，记下今天'}
        </p>
      </section>

      <section className="card mb-6 rounded-xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-sans text-h2 text-[var(--ink)]">今日学习</h2>
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
            <span className="font-sans text-body text-[var(--ink-faint)]">＋ 记下今天的第一段学习</span>
          </button>
        ) : (
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
                  onDelete={() => {
                    void handleDeleteLearning(item.id);
                  }}
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

      <section>
        <h2 className="mb-3 font-sans text-h2 text-[var(--ink)]">今日想法</h2>
        <DiaryEditor value={diary} onSave={handleDiarySave} mood={mood} />
      </section>

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
