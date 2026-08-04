import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { colors, fonts } from '../constants/theme';
import type { FilmDataPoint } from '../types/film';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Ported from the web repo's ReviewBeatGraph (src/app/reviews/[id]/page.tsx):
// the film's arc in gold with the reviewer's beat ratings overlaid in dashed
// teal, both series sharing an index-based x scale. Two deliberate
// differences from the web: width follows the SentimentArc precedent
// (screen width minus screen and card padding) instead of the web's fixed
// 600, and y spans the 0-10 domain to match the composer's ArcGraph rather
// than the web's 1-10.
const GRAPH_HEIGHT = 120;
const GRAPH_PAD = 6;
// The review screen nests the arc two cards deep: list content padding (14
// each side), the review card's padding (10), and the graph card's padding
// (10). All three must come off the screen width or the fixed-width Svg
// overflows its card.
const GRAPH_WIDTH = SCREEN_WIDTH - 28 - 20 - 20;

export default function ReviewBeatArc({
  dataPoints,
  beatRatings,
}: {
  dataPoints: FilmDataPoint[];
  beatRatings: Record<string, number> | null;
}) {
  // A single point draws no line, and without beat ratings there is no
  // second series to compare against; both cases render nothing.
  if (!beatRatings || dataPoints.length <= 1) return null;

  const plotW = GRAPH_WIDTH - GRAPH_PAD * 2;
  const plotH = GRAPH_HEIGHT - GRAPH_PAD * 2;

  function getX(i: number): number {
    return GRAPH_PAD + (i / Math.max(dataPoints.length - 1, 1)) * plotW;
  }
  function getY(score: number): number {
    return GRAPH_HEIGHT - GRAPH_PAD - (Math.max(0, Math.min(10, score)) / 10) * plotH;
  }

  const goldPath = dataPoints
    .map((dp, i) => `${i === 0 ? 'M' : 'L'}${getX(i).toFixed(1)},${getY(dp.score).toFixed(1)}`)
    .join(' ');

  // The reviewer rated beats by label; data points whose label has no
  // rating are dropped rather than defaulted, so the teal line only spans
  // beats the reviewer actually scored.
  const matchedBeats = dataPoints
    .map((dp, i) => {
      const rating = beatRatings[dp.label];
      if (rating === undefined) return null;
      return { x: getX(i), y: getY(rating) };
    })
    .filter((p): p is { x: number; y: number } => p !== null);

  const tealPath = matchedBeats
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  return (
    <View>
      <Svg width={GRAPH_WIDTH} height={GRAPH_HEIGHT}>
        {goldPath ? (
          <Path d={goldPath} fill="none" stroke={colors.gold} strokeWidth={2} opacity={0.6} />
        ) : null}
        {tealPath ? (
          <Path
            d={tealPath}
            fill="none"
            stroke={colors.teal}
            strokeWidth={2}
            strokeDasharray="5 3"
            opacity={0.8}
          />
        ) : null}
      </Svg>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <Svg width={16} height={2}>
            <Line x1={0} y1={1} x2={16} y2={1} stroke={colors.gold} strokeWidth={2} opacity={0.6} />
          </Svg>
          <Text style={styles.legendText}>Film arc</Text>
        </View>
        <View style={styles.legendItem}>
          <Svg width={16} height={2}>
            <Line
              x1={0}
              y1={1}
              x2={16}
              y2={1}
              stroke={colors.teal}
              strokeWidth={2}
              strokeDasharray="5 3"
              opacity={0.8}
            />
          </Svg>
          <Text style={styles.legendText}>{"This review's beats"}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendText: {
    fontSize: 10,
    color: 'rgba(245,240,225,0.4)',
    fontFamily: fonts.body,
  },
});
