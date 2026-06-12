import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { colors, fonts } from '../../constants/theme';
import { useIsReviewed } from '../../lib/reviewed-films';
import { formatScore } from '../../lib/score-format';
import TicketStub from '../TicketStub';
import type { SimilarFilm } from '../../types/film';

export function SimilarFilmCard({ film: f }: { film: SimilarFilm }) {
  const router = useRouter();
  const optimistic = useIsReviewed(f.id);
  // Visible in both default and blind mode (the stub is a status
  // indicator, not a score).
  const reviewed = f.userHasReviewed || optimistic;
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
        reviewed
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
        {reviewed && <TicketStub />}
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
});
