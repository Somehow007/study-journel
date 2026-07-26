import type { MoodConfig } from '../types';
import { useIsDark } from '../lib/useIsDark';

/**
 * 花朵生成器（Flower）— v5.0 花期 · 全应用唯一花卉来源（设计文档 §4.1）
 *
 * - 双层花瓣：外层大花瓣 solid 38% 透明（深色模式改用浅色 tint 提亮），
 *   内层小花瓣 solid 实色；白色花心 + ink 小点
 * - 可选花茎：--pine 色微弯二次贝塞尔 + 两片小叶，stem(0~1) 映射茎高（学习时长归一化）
 * - mood 与 color 二选一：内置/自定义心情传 mood（三档色 + 深色档），学科色等场景传 color
 * - mood=null 且无 color：渲染「待种下」虚线空圆环（1px dashed ink-faint）
 * - 确定性伪随机（petals+size 种子）：同一 props 多次渲染完全一致，但花朵不至于正圆呆板
 */

export interface FlowerProps {
  mood?: MoodConfig | null;
  color?: string;
  size?: number;
  /** 茎高归一化 0~1（0~6h 学习时长）；未传、为 0 或 variant='head' 时不画茎 */
  stem?: number;
  /** 花瓣数 5~8；内置心情有默认花型，自定义心情默认通用 6 瓣 */
  petals?: number;
  variant?: 'full' | 'head';
  /** 选中态：白色花瓣，适合 solid 实底 */
  selected?: boolean;
  className?: string;
}

/** 内置心情默认花瓣数（花型即花语） */
const MOOD_PETALS: Record<string, number> = {
  happy: 7,     // 向日葵
  calm: 6,      // 绣球
  sad: 6,       // 薰衣草
  inspired: 8,  // 樱
  anxious: 5,   // 虞美人
  tired: 6,     // 鼠尾草
};

/** 确定性伪随机（mulberry32），种子 = petals + size */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface PetalSpec {
  angle: number;
  len: number;
  wid: number;
}

/** 绕花心一圈的花瓣参数（带确定性抖动） */
function ringSpecs(n: number, len: number, wid: number, rand: () => number, offsetDeg: number): PetalSpec[] {
  const specs: PetalSpec[] = [];
  for (let i = 0; i < n; i++) {
    specs.push({
      angle: offsetDeg + (i * 360) / n + (rand() - 0.5) * 5,
      len: len * (0.94 + rand() * 0.12),
      wid: wid * (0.95 + rand() * 0.10),
    });
  }
  return specs;
}

export default function Flower({
  mood,
  color,
  size = 32,
  stem,
  petals,
  variant = 'full',
  selected = false,
  className = '',
}: FlowerProps) {
  const isDark = useIsDark();

  /* ── 空花：待种下（虚线空圆环） ── */
  if (!mood && !color) {
    return (
      <span
        className={`inline-block leading-none ${className}`}
        style={{ width: size, height: size }}
        role="img"
        aria-label="未记录"
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - 1}
            fill="none"
            stroke="var(--ink-faint)"
            strokeWidth="1"
            strokeDasharray="3 3"
            opacity="0.55"
          />
        </svg>
      </span>
    );
  }

  /* ── 取色：mood 三档（感知深色）或单色 color ── */
  const solid = mood ? (isDark ? mood.dark.solid : mood.solid) : color!;
  // 花心小点：始终用浅调 deep（mood.ink），落在白色花心上对比清晰（mockup 深色花同此理）
  const ink = mood ? mood.ink : color!;
  // 外层大花瓣：用浅色 tint（= mockup soft@1）。白底上呈柔和 pastel 光晕；
  // tint 磁贴上与底同色自然隐形（仅留 solid 内瓣，等同 mockup 心情磁贴观感）；
  // 深色近黑磁贴上则等同 boost 提亮。选中态在 solid 实底上渲染白花瓣。
  const outerFill = selected ? '#FFFFFF' : mood ? mood.tint : solid;
  const outerOpacity = selected ? 0.45 : mood ? 1 : 0.38;

  const n = petals ?? (mood ? MOOD_PETALS[mood.type] : undefined) ?? 6;

  const stemH =
    variant === 'full' && typeof stem === 'number' && stem > 0
      ? Math.round(stem * size * 0.9)
      : 0;
  const withStem = stemH > 0;

  const cx = size / 2;
  const cy = size / 2;
  const rand = seededRandom(n * 7919 + size * 131);

  const outer = ringSpecs(n, size * 0.46, size * 0.30, rand, 0);
  const inner = ringSpecs(n, size * 0.295, size * 0.21, rand, 180 / n);
  const rc = size * 0.095;

  const petalEls = (specs: PetalSpec[], fill: string, opacity: number) =>
    specs.map((p, i) => (
      <ellipse
        key={i}
        cx={cx}
        cy={cy - p.len / 2}
        rx={p.wid / 2}
        ry={p.len / 2}
        fill={fill}
        fillOpacity={opacity < 1 ? opacity : undefined}
        transform={`rotate(${p.angle.toFixed(1)} ${cx} ${cy})`}
      />
    ));

  return (
    <span
      className={`inline-block leading-none ${className}`}
      style={{ width: size, height: size + stemH }}
      role="img"
      aria-label={mood ? mood.label : '花'}
    >
      <svg
        width={size}
        height={size + stemH}
        viewBox={`0 0 ${size} ${size + stemH}`}
        style={{ display: 'block' }}
      >
        {withStem && (
          <>
            <path
              d={`M ${cx} ${size * 0.9} Q ${cx - size * 0.12} ${size + stemH * 0.45} ${cx + size * 0.06} ${size + stemH}`}
              fill="none"
              stroke="var(--pine)"
              strokeWidth={Math.max(2, size * 0.045)}
              strokeLinecap="round"
            />
            <ellipse
              cx={cx + size * 0.13}
              cy={size + stemH * 0.4}
              rx={size * 0.1}
              ry={size * 0.05}
              fill="var(--pine)"
              opacity="0.9"
              transform={`rotate(32 ${cx + size * 0.13} ${size + stemH * 0.4})`}
            />
            <ellipse
              cx={cx - size * 0.11}
              cy={size + stemH * 0.64}
              rx={size * 0.09}
              ry={size * 0.045}
              fill="var(--pine)"
              opacity="0.75"
              transform={`rotate(-28 ${cx - size * 0.11} ${size + stemH * 0.64})`}
            />
          </>
        )}
        {petalEls(outer, outerFill, outerOpacity)}
        {petalEls(inner, selected ? '#FFFFFF' : solid, 1)}
        <circle cx={cx} cy={cy} r={rc} fill={selected ? solid : '#FFFFFF'} />
        {!selected && <circle cx={cx} cy={cy} r={rc * 0.42} fill={ink} opacity="0.8" />}
      </svg>
    </span>
  );
}
