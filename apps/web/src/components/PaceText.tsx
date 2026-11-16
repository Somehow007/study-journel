import type { CSSProperties } from 'react';
import { periodOf, todayLocal } from '../lib/domain';
import type { GoalType } from '../lib/types/api';

interface PaceTextProps {
  pace: number | null;
  type: GoalType;
  unit: string | null;
  period: string;
  reached: boolean;
  style?: CSSProperties;
}

/** 目标节奏「落后 N / 按计划 / 领先 N」：仅当月未达标目标显示，值来自服务端 pace。 */
export default function PaceText({ pace, type, unit, period, reached, style }: PaceTextProps) {
  if (pace == null || reached || period !== periodOf(todayLocal())) return null;
  const u = type === 'COUNT' ? (unit ? ` ${unit}` : '') : ' 项';
  const text =
    pace > 0
      ? `领先 ${pace}${u}`
      : pace === 0
        ? '按计划'
        : type === 'COUNT'
          ? `落后 ${-pace}${u}`
          : `逾期 ${-pace}${u}`;
  return (
    <span style={{ color: pace < 0 ? 'var(--brand)' : 'var(--success)', ...style }}>{text}</span>
  );
}
