import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Line } from 'react-native-svg';
import { colors, fonts } from '../constants/theme';

interface SparklineProps {
  dataPoints: Array<{ score: number }>;
  width: number;
  height: number;
  strokeColor?: string;
  strokeWidth?: number;
  showAxes?: boolean;
  showMidline?: boolean;
  runtimeMinutes?: number | null;
}

function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`;
}

export default function Sparkline({
  dataPoints,
  width,
  height,
  strokeColor = colors.gold,
  strokeWidth = 1.5,
  showAxes = false,
  showMidline = false,
  runtimeMinutes,
}: SparklineProps) {
  if (dataPoints.length < 2) return null;

  const scores = dataPoints.map((dp) => dp.score);
  const rawMin = Math.min(...scores);
  const rawMax = Math.max(...scores);
  const range = rawMax - rawMin;
  const yPad = range < 0.5 ? 0.5 : range * 0.15;
  const yMin = rawMin - yPad;
  const yMax = rawMax + yPad;
  const yRange = yMax - yMin || 1;

  if (!showAxes) {
    const padding = 2;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const points = dataPoints
      .map((dp, i) => {
        const x = padding + (i / (dataPoints.length - 1)) * chartWidth;
        const y = padding + (1 - (dp.score - yMin) / yRange) * chartHeight;
        return `${x},${y}`;
      })
      .join(' ');

    return (
      <Svg width={width} height={height}>
        {showMidline && (
          <Line
            x1={0}
            y1={height / 2}
            x2={width}
            y2={height / 2}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={0.5}
            strokeDasharray="3,3"
          />
        )}
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

  // With axes: reserve space for labels
  const yLabelWidth = 28;
  const xLabelHeight = 14;
  const svgWidth = width - yLabelWidth;
  const svgHeight = height - xLabelHeight;
  const padding = 2;
  const chartWidth = svgWidth - padding * 2;
  const chartHeight = svgHeight - padding * 2;

  const points = dataPoints
    .map((dp, i) => {
      const x = padding + (i / (dataPoints.length - 1)) * chartWidth;
      const y = padding + (1 - (dp.score - yMin) / yRange) * chartHeight;
      return `${x},${y}`;
    })
    .join(' ');

  const displayMin = rawMin.toFixed(1);
  const displayMax = rawMax.toFixed(1);

  return (
    <View style={{ width, height }}>
      <View style={axStyles.row}>
        {/* Y-axis labels */}
        <View style={[axStyles.yLabels, { width: yLabelWidth, height: svgHeight }]}>
          <Text style={axStyles.axisLabel}>{displayMax}</Text>
          <Text style={axStyles.axisLabel}>{displayMin}</Text>
        </View>
        {/* SVG chart */}
        <Svg width={svgWidth} height={svgHeight}>
          <Line
            x1={0}
            y1={svgHeight / 2}
            x2={svgWidth}
            y2={svgHeight / 2}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={0.5}
            strokeDasharray="3,3"
          />
          <Polyline
            points={points}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      {/* X-axis labels */}
      <View style={[axStyles.xLabels, { marginLeft: yLabelWidth }]}>
        <Text style={axStyles.axisLabel}>0m</Text>
        <Text style={axStyles.axisLabel}>
          {runtimeMinutes ? formatRuntime(runtimeMinutes) : ''}
        </Text>
      </View>
    </View>
  );
}

const axStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  yLabels: {
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 4,
  },
  xLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 14,
  },
  axisLabel: {
    fontFamily: fonts.body,
    fontSize: 8,
    color: 'rgba(245,240,225,0.25)',
  },
});
