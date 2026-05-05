import React from 'react';
import { colors } from '../constants/theme';
import Sparkline from './Sparkline';

type MiniArcVariant = 'favorite' | 'reviewCard';

type MiniArcProps = {
  points: number[];
  variant: MiniArcVariant;
  color?: string;
  strokeWidth?: number;
};

const VARIANT_CONFIG: Record<
  MiniArcVariant,
  { width: number; height: number; strokeWidth: number }
> = {
  favorite:   { width: 80,  height: 28, strokeWidth: 1.4 },
  reviewCard: { width: 290, height: 50, strokeWidth: 2 },
};

export default function MiniArc({
  points,
  variant,
  color,
  strokeWidth,
}: MiniArcProps) {
  if (points.length < 2) return null;

  const cfg = VARIANT_CONFIG[variant];

  return (
    <Sparkline
      dataPoints={points.map((score) => ({ score }))}
      width={cfg.width}
      height={cfg.height}
      strokeColor={color ?? colors.gold}
      strokeWidth={strokeWidth ?? cfg.strokeWidth}
      showAxes={false}
    />
  );
}
