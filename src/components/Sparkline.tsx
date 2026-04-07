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

  const points = dataPoints
    .map((dp, i) => {
      const x = padding + (i / (dataPoints.length - 1)) * chartWidth;
      const y = padding + (1 - dp.score / 10) * chartHeight;
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
