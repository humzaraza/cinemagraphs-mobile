import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { colors, fonts } from '../../constants/theme';
import { formatScore } from '../../lib/score-format';
import type { SimilarFilm } from '../../types/film';

/**
 * Editorial corner mark for the "Similar films" carousel — appears on
 * the top-right of a poster when `userHasReviewed === true`. Visible in
 * both default and blind mode (per spec: the ribbon is a status
 * indicator, not a score). Renders behind pointer events so taps still
 * fall through to the parent Pressable.
 */
function ReviewedRibbon() {
  return (
    <View style={styles.reviewedRibbon} pointerEvents="none">
      <Svg width={9} height={9} viewBox="0 0 24 24" fill="none">
        <Path
          d="M5 12l5 5 9-11"
          stroke={colors.gold}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <Text style={styles.reviewedRibbonText}>reviewed</Text>
    </View>
  );
}

export function SimilarFilmCard({ film: f }: { film: SimilarFilm }) {
  const router = useRouter();
  // SimilarFilm.posterUrl comes through as an absolute URL from the
  // PR 4a server transform. Fall back to undefined so the placeholder
  // renders cleanly when the server returned null.
  const posterUri = f.posterUrl ?? undefined;
  const scoreLabel = f.score !== null ? formatScore(f.score) : '--';
  const yearLabel = `${f.year}${f.score !== null ? ` · ${scoreLabel}` : ''}`;

  return (
    <Pressable
      onPress={() => router.push(`/film/${f.id}` as any)}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={
        f.userHasReviewed
          ? `${f.title}, ${f.year}. Score ${scoreLabel}. Reviewed.`
          : `${f.title}, ${f.year}. Score ${scoreLabel}.`
      }
    >
      <View>
        {posterUri ? (
          <Image
            source={{ uri: posterUri }}
            style={styles.poster}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.poster, styles.posterPlaceholder]} />
        )}
        {f.userHasReviewed && <ReviewedRibbon />}
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {f.title}
      </Text>
      <Text style={styles.score}>{yearLabel}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 70,
  },
  poster: {
    width: 70,
    height: 105,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.1)',
    marginBottom: 4,
  },
  posterPlaceholder: {
    backgroundColor: 'rgba(30,30,60,0.6)',
  },
  title: {
    fontSize: 10,
    color: colors.ivory,
    fontFamily: fonts.body,
  },
  score: {
    fontSize: 9,
    color: colors.gold,
    fontFamily: fonts.body,
  },
  reviewedRibbon: {
    position: 'absolute',
    top: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    backgroundColor: 'rgba(13,13,26,0.7)',
    borderRadius: 4,
  },
  reviewedRibbonText: {
    fontFamily: fonts.body,
    fontSize: 8,
    color: colors.gold,
    letterSpacing: 0.1,
  },
});
