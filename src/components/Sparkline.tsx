import Svg, { Polyline } from 'react-native-svg';
import { colors } from '../constants/theme';

interface SparklineProps {
  dataPoints: Array<{ score: number }>;
  width: number;
  height: number;
  strokeColor?: string;
  strokeWidth?: number;
}

export default function Sparkline({
  dataPoints,
  width,
  height,
  strokeColor = colors.gold,
  strokeWidth = 1.5,
}: SparklineProps) {
  if (dataPoints.length < 2) return null;

  const padding = 2;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const scores = dataPoints.map((dp) => dp.score);
  const rawMin = Math.min(...scores);
  const rawMax = Math.max(...scores);
  const range = rawMax - rawMin;
  const yPad = range < 0.5 ? 0.5 : range * 0.15;
  const yMin = rawMin - yPad;
  const yMax = rawMax + yPad;
  const yRange = yMax - yMin || 1;

  const points = dataPoints
    .map((dp, i) => {
      const x = padding + (i / (dataPoints.length - 1)) * chartWidth;
      const y = padding + (1 - (dp.score - yMin) / yRange) * chartHeight;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <Svg width={width} height={height}>
      <Polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
