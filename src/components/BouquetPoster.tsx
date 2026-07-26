import { useRef, useMemo, useState } from 'react';
import { Share2 } from 'lucide-react';
import type { DayRecord, MoodConfig } from '../types';
import Flower from './Flower';
import { totalDuration } from '../lib/dateUtils';

interface BouquetPosterProps {
  year: number;
  month: number;
  records: DayRecord[];
  moodMap: Map<string, MoodConfig>;
}

const W = 320;
const H = 460;

/** 对称花朵 SVG（用于导出） */
function FlowerSVG({
  x,
  y,
  size,
  color,
  petals = 6,
}: {
  x: number;
  y: number;
  size: number;
  color: string;
  petals?: number;
}) {
  const items = [];
  for (let i = 0; i < petals; i++) {
    const angle = (i * 360) / petals;
    items.push(
      <ellipse
        key={i}
        cx={x}
        cy={y - size * 0.23}
        rx={size * 0.15}
        ry={size * 0.46}
        fill={color}
        opacity={0.38}
        transform={`rotate(${angle} ${x} ${y})`}
      />,
    );
  }
  for (let i = 0; i < petals; i++) {
    const angle = (i * 360) / petals + 180 / petals;
    items.push(
      <ellipse
        key={`inner-${i}`}
        cx={x}
        cy={y - size * 0.15}
        rx={size * 0.1}
        ry={size * 0.3}
        fill={color}
        transform={`rotate(${angle} ${x} ${y})`}
      />,
    );
  }
  items.push(<circle key="center" cx={x} cy={y} r={size * 0.09} fill="#FFFFFF" />);
  return <>{items}</>;
}

export default function BouquetPoster({ year, month, records, moodMap }: BouquetPosterProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [sharing, setSharing] = useState(false);

  const summary = useMemo(() => {
    const totalMin = records.reduce((s, r) => s + totalDuration(r.learnings), 0);
    const count = records.filter((r) => r.mood || r.learnings.length > 0 || r.diary).length;
    const moodCounts: Record<string, number> = {};
    for (const r of records) {
      if (r.mood && moodMap.has(r.mood)) {
        moodCounts[r.mood] = (moodCounts[r.mood] || 0) + 1;
      }
    }
    const sorted = Object.entries(moodCounts)
      .map(([type, count]) => ({ type, count, cfg: moodMap.get(type)! }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
    return { totalMin, count, sorted };
  }, [records, moodMap]);

  const flowers = useMemo(() => {
    // 按频次分配 5~9 朵花，频次高的更大
    const list: { type: string; cfg: MoodConfig; size: number; angle: number }[] = [];
    const totalWeight = summary.sorted.reduce((s, it) => s + it.count, 0) || 1;
    let targetCount = 0;
    summary.sorted.forEach((_, idx) => {
      const n = idx === 0 ? 2 : 1;
      targetCount += n;
    });
    targetCount = Math.min(9, Math.max(5, targetCount));

    const angleSpan = 70;
    let i = 0;
    summary.sorted.forEach((it, idx) => {
      const n = idx === 0 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const size = 38 + (it.count / totalWeight) * 22;
        const t = targetCount === 1 ? 0.5 : i / (targetCount - 1);
        const angle = -angleSpan / 2 + t * angleSpan + (k === 1 ? -6 : 0);
        list.push({ type: it.type, cfg: it.cfg, size, angle });
        i++;
      }
    });
    return list;
  }, [summary]);

  const label = `${month + 1}月花束`;
  const engLabel = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long' });
  const footerText = `${summary.count} 天 · ${Math.floor(summary.totalMin / 60)}h ${String(
    summary.totalMin % 60,
  ).padStart(2, '0')}m · ${year}.${String(month + 1).padStart(2, '0')}`;

  const handleShare = async () => {
    if (!svgRef.current) return;
    setSharing(true);
    try {
      const svgData = new XMLSerializer().serializeToString(svgRef.current);
      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      const canvas = document.createElement('canvas');
      canvas.width = W * 2;
      canvas.height = H * 2;
      const ctx = canvas.getContext('2d')!;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0, W * 2, H * 2);
          resolve();
        };
        img.onerror = reject;
        img.src = url;
      });
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return;
        const pngUrl = URL.createObjectURL(pngBlob);
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `花期-${year}-${String(month + 1).padStart(2, '0')}-花束.png`;
        a.click();
        URL.revokeObjectURL(pngUrl);
        URL.revokeObjectURL(url);
      });
    } catch {
      const text = `我的${label}：${footerText}`;
      await navigator.clipboard.writeText(text);
      alert('已复制花束文案');
    } finally {
      setSharing(false);
    }
  };

  if (records.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center rounded-xl px-6 py-12 text-center">
        <FlowerSVG x={40} y={40} size={64} color="var(--ink-faint)" />
        <p className="mt-4 font-serif text-h2 text-[var(--ink-soft)]">这个月还没有开花</p>
        <p className="mt-1 font-sans text-small text-[var(--ink-faint)]">种下第一朵，月末就会有花束</p>
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-5 rounded-xl p-6 sm:flex-row sm:items-center">
      {/* 海报本体（视觉） */}
      <div
        className="relative shrink-0 overflow-hidden rounded-2xl border border-[var(--keyline)]"
        style={{
          width: W,
          height: H,
          background: 'linear-gradient(180deg, color-mix(in srgb, var(--pine) 8%, transparent) 0%, var(--card) 100%)',
        }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-between px-6 pb-5 pt-6">
          <div className="text-center">
            <h3 className="font-serif text-h1 text-[var(--ink)]">{label}</h3>
            <p className="font-displaylatin italic text-caption text-[var(--ink-faint)]">a bouquet of {engLabel}</p>
          </div>

          <div className="relative flex-1" style={{ width: '100%' }}>
            {flowers.map((f, idx) => {
              const rad = (f.angle * Math.PI) / 180;
              const cx = 160 + Math.sin(rad) * 70;
              const cy = 240 - Math.cos(rad) * 60 - (f.size - 40) * 0.4;
              return (
                <div
                  key={idx}
                  className="absolute"
                  style={{
                    left: cx,
                    top: cy,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <Flower mood={f.cfg} size={f.size} stem={0.55} />
                </div>
              );
            })}
            {/* 蝴蝶结 */}
            <svg className="absolute bottom-8 left-1/2 -translate-x-1/2" width="40" height="24" viewBox="0 0 40 24">
              <path
                d="M20 12 L8 4 Q4 2 4 8 Q4 14 8 12 L20 12 L32 20 Q36 22 36 16 Q36 10 32 12 L20 12"
                fill="var(--accent)"
                opacity="0.9"
              />
              <circle cx="20" cy="12" r="4" fill="var(--accent-ink)" />
            </svg>
          </div>

          <div className="text-center">
            <p className="font-mono text-caption text-[var(--ink-soft)]">{footerText}</p>
          </div>
        </div>

        {/* 隐藏导出 SVG */}
        <svg
          ref={svgRef}
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          xmlns="http://www.w3.org/2000/svg"
          className="pointer-events-none absolute -left-full top-0"
        >
          <defs>
            <linearGradient id={`grad-${year}-${month}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="color-mix(in srgb, #57A773 8%, #FFFFFF)" />
              <stop offset="100%" stopColor="#FFFFFF" />
            </linearGradient>
          </defs>
          <rect width={W} height={H} fill={`url(#grad-${year}-${month})`} />
          <text x={W / 2} y="58" textAnchor="middle" fontFamily="'Noto Serif SC', serif" fontSize="26" fill="#2C322A">
            {label}
          </text>
          <text
            x={W / 2}
            y="80"
            textAnchor="middle"
            fontFamily="Georgia, serif"
            fontStyle="italic"
            fontSize="12"
            fill="#A7AC9E"
          >
            a bouquet of {engLabel}
          </text>
          {flowers.map((f, idx) => {
            const rad = (f.angle * Math.PI) / 180;
            const cx = 160 + Math.sin(rad) * 70;
            const cy = 250 - Math.cos(rad) * 60 - (f.size - 40) * 0.4;
            return (
              <g key={idx}>
                <line x1="160" y1="420" x2={cx} y2={cy + f.size * 0.25} stroke="#57A773" strokeWidth="3" />
                <FlowerSVG x={cx} y={cy} size={f.size} color={f.cfg.solid} petals={6} />
              </g>
            );
          })}
          <path
            d="M160 405 L136 393 Q128 389 128 401 Q128 413 136 409 L160 405 L184 417 Q192 421 192 409 Q192 397 184 401 L160 405"
            fill="#E8845C"
          />
          <circle cx="160" cy="405" r="6" fill="#C9663F" />
          <text
            x={W / 2}
            y="436"
            textAnchor="middle"
            fontFamily="'IBM Plex Mono', monospace"
            fontSize="11"
            fill="#6D7466"
          >
            {footerText}
          </text>
        </svg>
      </div>

      {/* 右侧文案 */}
      <div className="flex flex-1 flex-col justify-center">
        <h2 className="mb-2 font-serif text-h2 text-[var(--ink)]">月末，把花田扎成一束</h2>
        <p className="mb-5 font-sans text-body leading-relaxed text-[var(--ink-soft)]">
          每月的最后一天，「花期」会把这个月开过的花自动扎成一束花束海报——心情是花色，时长是花茎。坚持得越久，花束越丰盛。
        </p>
        <p className="mb-5 font-sans text-body leading-relaxed text-[var(--ink-soft)]">
          这是一张可以保存、可以分享给朋友的「坚持证明」。记录的意义，在月末被看见。
        </p>

        <div className="mb-5 flex flex-wrap gap-2">
          {summary.sorted.map((it) => (
            <span
              key={it.type}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-sans text-caption"
              style={{ background: it.cfg.tint, color: it.cfg.ink }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: it.cfg.solid }} />
              {it.cfg.flower ?? it.cfg.label} × {it.count}
            </span>
          ))}
        </div>

        <button
          onClick={handleShare}
          disabled={sharing}
          className="inline-flex w-fit items-center gap-2 rounded-md bg-[var(--brand)] px-5 py-2.5 font-sans text-small text-white transition-all hover:bg-[var(--brand-ink)] disabled:opacity-60"
        >
          <Share2 size={16} strokeWidth={1.75} />
          {sharing ? '生成中…' : '分享本月花束'}
        </button>
      </div>
    </div>
  );
}
