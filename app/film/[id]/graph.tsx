import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Line,
  Polyline,
  Circle,
  Text as SvgText,
  Rect,
  Path,
} from 'react-native-svg';
import { colors, fonts, borderRadius } from '../../../src/constants/theme';
import { fetchFilmDetail } from '../../../src/lib/api';
import type { FilmDetail, FilmDataPoint } from '../../../src/types/film';

const SCREEN_WIDTH = Dimensions.get('window').width;
const Y_AXIS_WIDTH = 28;
const GRAPH_PAD_TOP = 8;
const GRAPH_PAD_BOTTOM = 24;
const X_LABEL_AREA = 18;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonBox({ width, height, style }: { width: number | string; height: number; style?: object }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.6, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: 'rgba(245,240,225,0.06)',
          borderRadius: borderRadius.md,
          opacity,
        },
        style,
      ]}
    />
  );
}

function GraphSkeleton() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <SkeletonBox width={18} height={18} />
        <SkeletonBox width={120} height={16} />
        <SkeletonBox width={30} height={16} />
      </View>
      <View style={{ flex: 1, padding: 14 }}>
        <SkeletonBox width={'100%' as any} height={400} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

function Tooltip({
  dp,
  x,
  y,
  graphHeight,
}: {
  dp: FilmDataPoint;
  x: number;
  y: number;
  graphHeight: number;
}) {
  const aboveDot = y > 80;
  const top = aboveDot ? y - 60 : y + 14;

  return (
    <View
      style={[
        styles.tooltip,
        {
          left: x - 50,
          top,
        },
      ]}
    >
      <Text style={styles.tooltipLabel}>{dp.label}</Text>
      <Text style={styles.tooltipTime}>{formatTimestamp(dp.timeMidpoint)}</Text>
      <Text style={styles.tooltipScore}>{dp.score.toFixed(1)}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ExpandedGraphScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [film, setFilm] = useState<FilmDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(false);
    fetchFilmDetail(id)
      .then((data) => {
        if (data) setFilm(data);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <GraphSkeleton />;

  if (error || !film) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Could not load film details</Text>
          <Pressable onPress={load} style={styles.retryButton}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const sg = film.sentimentGraph;
  const dataPoints = sg?.dataPoints ?? [];
  const n = dataPoints.length;

  const peakLabel = sg?.peakMoment?.label;
  const lowLabel = sg?.lowestMoment?.label;

  // Graph dimensions
  const graphAreaHeight = Dimensions.get('window').height - insets.top - insets.bottom - 60;
  const plotHeight = graphAreaHeight - GRAPH_PAD_TOP - GRAPH_PAD_BOTTOM - X_LABEL_AREA;
  const svgWidth = Math.max(n * 60, 500);
  const svgHeight = graphAreaHeight;

  // Map data point index to x,y
  function getX(i: number): number {
    if (n <= 1) return svgWidth / 2;
    return 10 + (i / (n - 1)) * (svgWidth - 20);
  }

  function getY(score: number): number {
    const clamped = Math.max(0, Math.min(10, score));
    return GRAPH_PAD_TOP + (1 - clamped / 10) * plotHeight;
  }

  // Polyline points
  const polylinePoints = dataPoints
    .map((dp, i) => `${getX(i).toFixed(1)},${getY(dp.score).toFixed(1)}`)
    .join(' ');

  // Midline Y
  const midY = getY(5);

  // X-axis label skip logic
  const labelEvery = n > 10 ? (n > 20 ? 3 : 2) : 1;

  function dotColor(dp: FilmDataPoint): string {
    if (dp.label === peakLabel) return colors.teal;
    if (dp.label === lowLabel) return colors.negativeRed;
    return colors.gold;
  }

  function handleDotPress(index: number) {
    setActiveIndex((prev) => (prev === index ? null : index));
  }

  // Overall score
  const overallScore = sg?.overallSentiment ?? sg?.overallScore;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={colors.ivory} strokeWidth={2} />
          </Svg>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {film.title}
        </Text>
        <Text style={styles.headerScore}>
          {overallScore != null ? overallScore.toFixed(1) : '--'}
        </Text>
      </View>

      {/* Graph area: pinned Y-axis + scrollable graph */}
      <View style={styles.graphRow}>
        {/* Pinned Y-axis */}
        <View style={[styles.yAxis, { height: graphAreaHeight }]}>
          {Array.from({ length: 10 }, (_, i) => 10 - i).map((val) => (
            <Text key={val} style={styles.yLabel}>
              {val}
            </Text>
          ))}
        </View>

        {/* Scrollable graph */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={true}
          style={{ flex: 1 }}
          contentContainerStyle={{ position: 'relative' }}
        >
          <Pressable onPress={() => setActiveIndex(null)}>
            <Svg width={svgWidth} height={svgHeight}>
              {/* Y-axis line */}
              <Line
                x1={0}
                y1={GRAPH_PAD_TOP}
                x2={0}
                y2={GRAPH_PAD_TOP + plotHeight}
                stroke="rgba(245,240,225,0.08)"
                strokeWidth={0.5}
              />

              {/* Dashed midline at score 5 */}
              <Line
                x1={0}
                y1={midY}
                x2={svgWidth}
                y2={midY}
                stroke="rgba(245,240,225,0.12)"
                strokeWidth={0.5}
                strokeDasharray="4,4"
              />

              {/* Gold polyline */}
              {n >= 2 && (
                <Polyline
                  points={polylinePoints}
                  fill="none"
                  stroke={colors.gold}
                  strokeWidth={2}
                />
              )}

              {/* Beat dots with invisible hit areas */}
              {dataPoints.map((dp, i) => {
                const cx = getX(i);
                const cy = getY(dp.score);
                return (
                  <React.Fragment key={i}>
                    <Circle
                      cx={cx}
                      cy={cy}
                      r={20}
                      fill="transparent"
                      onPress={() => handleDotPress(i)}
                    />
                    <Circle
                      cx={cx}
                      cy={cy}
                      r={5}
                      fill={dotColor(dp)}
                      onPress={() => handleDotPress(i)}
                    />
                  </React.Fragment>
                );
              })}

              {/* X-axis timestamps */}
              {dataPoints.map((dp, i) => {
                if (i % labelEvery !== 0) return null;
                return (
                  <SvgText
                    key={`x-${i}`}
                    x={getX(i)}
                    y={GRAPH_PAD_TOP + plotHeight + X_LABEL_AREA}
                    textAnchor="middle"
                    fontSize={9}
                    fill="rgba(245,240,225,0.2)"
                  >
                    {formatTimestamp(dp.timeMidpoint)}
                  </SvgText>
                );
              })}
            </Svg>

            {/* Tooltip overlay */}
            {activeIndex != null && dataPoints[activeIndex] && (
              <Tooltip
                dp={dataPoints[activeIndex]}
                x={getX(activeIndex)}
                y={getY(dataPoints[activeIndex].score)}
                graphHeight={graphAreaHeight}
              />
            )}
          </Pressable>
        </ScrollView>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.ivory,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  headerScore: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.gold,
  },

  // Graph layout
  graphRow: {
    flex: 1,
    flexDirection: 'row',
  },
  yAxis: {
    width: Y_AXIS_WIDTH,
    paddingTop: GRAPH_PAD_TOP,
    paddingBottom: GRAPH_PAD_BOTTOM + X_LABEL_AREA,
    paddingRight: 6,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  yLabel: {
    fontSize: 9,
    color: 'rgba(245,240,225,0.25)',
    fontFamily: fonts.body,
  },

  // Tooltip
  tooltip: {
    position: 'absolute',
    backgroundColor: 'rgba(13,13,26,0.92)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.25)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    width: 100,
    alignItems: 'center',
  },
  tooltipLabel: {
    fontSize: 12,
    color: colors.ivory,
    fontFamily: fonts.bodyMedium,
    textAlign: 'center',
    marginBottom: 2,
  },
  tooltipTime: {
    fontSize: 9,
    color: 'rgba(245,240,225,0.4)',
    fontFamily: fonts.body,
    marginBottom: 2,
  },
  tooltipScore: {
    fontSize: 14,
    color: colors.gold,
    fontFamily: fonts.bodyMedium,
  },

  // Error
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 14,
    color: 'rgba(245,240,225,0.5)',
    fontFamily: fonts.body,
    marginBottom: 12,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(200,169,81,0.3)',
    borderRadius: 8,
  },
  retryText: {
    fontSize: 13,
    color: colors.gold,
    fontFamily: fonts.bodyMedium,
  },
});
