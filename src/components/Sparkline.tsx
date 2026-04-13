import Svg, { Polyline, Line, Circle, Text as SvgText } from 'react-native-svg';
import { colors } from '../constants/theme';

interface SparklineProps {
  dataPoints: Array<{ score: number }>;
  width: number;
  height: number;
  strokeColor?: string;
  strokeWidth?: number;
  showAxes?: boolean;
  showMidline?: boolean;
  hideLabels?: boolean;
  runtimeMinutes?: number | null;
  peakDotColor?: string;
  peakDotRadius?: number;
  lowDotColor?: string;
  lowDotRadius?: number;
  dynamicYAxis?: boolean;
  hideStartLabel?: boolean;
  fixPeakClipping?: boolean;
  yLabelWidth?: number;
}

function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`;
}

const AXIS_COLOR = 'rgba(245,240,225,0.15)';
const LABEL_COLOR = 'rgba(245,240,225,0.35)';
const MIDLINE_COLOR = 'rgba(255,255,255,0.25)';
const LABEL_FONT_SIZE = 9;

export default function Sparkline({
  dataPoints,
  width,
  height,
  strokeColor = colors.gold,
  strokeWidth = 1.5,
  showAxes = false,
  showMidline = false,
  hideLabels = false,
  runtimeMinutes,
  peakDotColor,
  peakDotRadius,
  lowDotColor,
  lowDotRadius,
  dynamicYAxis = false,
  hideStartLabel = false,
  fixPeakClipping = false,
  yLabelWidth,
}: SparklineProps) {
  if (dataPoints.length < 2) return null;

  const scores = dataPoints.map((dp) => dp.score);
  const rawMin = Math.min(...scores);
  const rawMax = Math.max(...scores);
  const yMin = dynamicYAxis ? Math.max(0, Math.floor(rawMin) - 1) : 0;
  const yMax = dynamicYAxis ? Math.min(10, Math.ceil(rawMax) + 1) : 10;
  const yRange = yMax - yMin || 1;

  // Simple sparkline (no axes)
  if (!showAxes) {
    const pad = 4;
    const cw = width - pad * 2;
    const ch = height - pad * 2;

    const points = dataPoints
      .map((dp, i) => {
        const x = pad + (i / (dataPoints.length - 1)) * cw;
        const y = pad + (1 - (dp.score - yMin) / yRange) * ch;
        return `${x},${y}`;
      })
      .join(' ');

    let peakIdx = 0;
    scores.forEach((s, i) => { if (s > scores[peakIdx]) peakIdx = i; });
    const peakX = pad + (peakIdx / (dataPoints.length - 1)) * cw;
    const peakY = pad + (1 - (scores[peakIdx] - yMin) / yRange) * ch;

    let lowIdx = 0;
    scores.forEach((s, i) => { if (s < scores[lowIdx]) lowIdx = i; });
    const lowX = pad + (lowIdx / (dataPoints.length - 1)) * cw;
    const lowY = pad + (1 - (scores[lowIdx] - yMin) / yRange) * ch;

    return (
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {showMidline && (
          <Line
            x1={0} y1={height / 2} x2={width} y2={height / 2}
            stroke={MIDLINE_COLOR} strokeWidth={0.5} strokeDasharray="3,3"
          />
        )}
        <Polyline
          points={points} fill="none" stroke={strokeColor}
          strokeWidth={strokeWidth} strokeLinejoin="round"
        />
        {peakDotColor && (
          <Circle cx={peakX} cy={peakY} r={peakDotRadius ?? 3} fill={peakDotColor} />
        )}
        {lowDotColor && (
          <Circle cx={lowX} cy={lowY} r={lowDotRadius ?? 3} fill={lowDotColor} />
        )}
      </Svg>
    );
  }

  // With axes: everything rendered inside a single SVG
  const dotR = peakDotRadius ?? 3;
  const yLabelW = hideLabels ? 4 : (yLabelWidth ?? 22);
  const xLabelH = hideLabels ? 2 : 12;
  const chartLeft = yLabelW;
  const chartTop = fixPeakClipping ? 10 : 2;
  const chartRight = width - 2;
  const chartBottom = height - xLabelH;
  const cw = chartRight - chartLeft;
  const ch = chartBottom - chartTop;

  const points = dataPoints
    .map((dp, i) => {
      const x = chartLeft + (i / (dataPoints.length - 1)) * cw;
      const y = chartTop + (1 - (dp.score - yMin) / yRange) * ch;
      return `${x},${y}`;
    })
    .join(' ');

  let peakIdx = 0;
  scores.forEach((s, i) => { if (s > scores[peakIdx]) peakIdx = i; });
  const peakX = chartLeft + (peakIdx / (dataPoints.length - 1)) * cw;
  const peakY = chartTop + (1 - (scores[peakIdx] - yMin) / yRange) * ch;

  let lowIdx = 0;
  scores.forEach((s, i) => { if (s < scores[lowIdx]) lowIdx = i; });
  const lowX = chartLeft + (lowIdx / (dataPoints.length - 1)) * cw;
  const lowY = chartTop + (1 - (scores[lowIdx] - yMin) / yRange) * ch;

  const midY = chartTop + ch / 2;

  return (
    <Svg width={width} height={fixPeakClipping ? height + 8 : height} viewBox={`0 0 ${width} ${fixPeakClipping ? height + 8 : height}`}>
      {/* Dashed midline */}
      <Line
        x1={chartLeft} y1={midY} x2={chartRight} y2={midY}
        stroke={MIDLINE_COLOR} strokeWidth={1} strokeDasharray="3,3"
      />
      {/* Y-axis line */}
      <Line x1={chartLeft} y1={chartTop} x2={chartLeft} y2={chartBottom} stroke={AXIS_COLOR} strokeWidth={0.5} />
      {/* X-axis line */}
      <Line x1={chartLeft} y1={chartBottom} x2={chartRight} y2={chartBottom} stroke={AXIS_COLOR} strokeWidth={0.5} />
      {/* Data line */}
      <Polyline
        points={points} fill="none" stroke={strokeColor}
        strokeWidth={strokeWidth} strokeLinejoin="round"
      />
      {/* Peak dot */}
      {peakDotColor && (
        <Circle cx={peakX} cy={peakY} r={dotR} fill={peakDotColor} />
      )}
      {/* Low dot */}
      {lowDotColor && (
        <Circle cx={lowX} cy={lowY} r={lowDotRadius ?? 3} fill={lowDotColor} />
      )}
      {/* Y-axis labels */}
      {!hideLabels && (
        <SvgText
          x={yLabelW - 3} y={chartTop + LABEL_FONT_SIZE - 2}
          textAnchor="end" fontSize={LABEL_FONT_SIZE}
          fill={LABEL_COLOR}>
          {yMax}
        </SvgText>
      )}
      {!hideLabels && (
        <SvgText
          x={yLabelW - 3} y={chartBottom}
          textAnchor="end" fontSize={LABEL_FONT_SIZE}
          fill={LABEL_COLOR}>
          {yMin}
        </SvgText>
      )}
      {/* X-axis labels */}
      {!hideLabels && !hideStartLabel && (
        <SvgText
          x={chartLeft} y={(fixPeakClipping ? height + 8 : height) - 1}
          textAnchor="start" fontSize={LABEL_FONT_SIZE}
          fill={LABEL_COLOR}>
          0m
        </SvgText>
      )}
      {!hideLabels && runtimeMinutes != null && (
        <SvgText
          x={chartRight} y={(fixPeakClipping ? height + 8 : height) - 1}
          textAnchor="end" fontSize={LABEL_FONT_SIZE}
          fill={LABEL_COLOR}>
          {formatRuntime(runtimeMinutes)}
        </SvgText>
      )}
    </Svg>
  );
}
