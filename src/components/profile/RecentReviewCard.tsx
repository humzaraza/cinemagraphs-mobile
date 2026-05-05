import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { colors, fonts } from '../../constants/theme';
import { getPosterUrl } from '../../lib/tmdb-image';
import MiniArc from '../MiniArc';

export type RecentReview = {
  filmId: string;
  title: string;
  year: number | null;
  director: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  score: number;
  sparklinePoints: number[];
};

type RecentReviewCardProps = {
  review: RecentReview;
  onPress: (filmId: string) => void;
};

const SCRIM_COLORS = [
  'rgba(13,13,26,0)',
  'rgba(13,13,26,0.7)',
  'rgba(13,13,26,0.95)',
] as const;
const SCRIM_LOCATIONS = [0, 0.7, 1] as const;

export default function RecentReviewCard({
  review,
  onPress,
}: RecentReviewCardProps) {
  const backdropSource = review.backdropUrl ?? review.posterUrl;
  const heroUri = backdropSource
    ? getPosterUrl({ posterUrl: backdropSource }, 'hero')
    : null;

  const subtitleParts = [
    review.year != null ? String(review.year) : null,
    review.director ? `dir. ${review.director}` : null,
  ].filter(Boolean) as string[];
  const subtitle = subtitleParts.join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${review.title}`}
      onPress={() => onPress(review.filmId)}
      style={styles.card}
    >
      {heroUri ? (
        <Image
          source={{ uri: heroUri }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, styles.fallbackBg]} />
      )}

      <LinearGradient
        colors={SCRIM_COLORS}
        locations={SCRIM_LOCATIONS}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.scoreBadge}>
        <BlurView
          intensity={8}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, styles.scoreBadgeTint]} />
        <Text style={styles.scoreText}>{review.score.toFixed(1)}</Text>
      </View>

      <View style={styles.bottom}>
        <View style={styles.arcWrap}>
          <MiniArc
            variant="reviewCard"
            points={review.sparklinePoints}
            color={colors.gold}
          />
        </View>
        <View style={styles.bottomText}>
          <Text
            style={styles.title}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {review.title}
          </Text>
          {subtitle.length > 0 && (
            <Text style={styles.subtitle}>{subtitle}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 240,
    aspectRatio: 5 / 7,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fallbackBg: {
    backgroundColor: 'rgba(30,30,60,0.6)',
  },
  scoreBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.4)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  scoreBadgeTint: {
    backgroundColor: 'rgba(13,13,26,0.7)',
  },
  scoreText: {
    color: colors.gold,
    fontSize: 15,
    fontFamily: fonts.bodySemiBold,
    letterSpacing: -0.15,
    fontVariant: ['tabular-nums'],
  },
  bottom: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
  },
  arcWrap: {
    marginBottom: 12,
  },
  bottomText: {
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: fonts.bodyBold,
    letterSpacing: -0.36,
    color: colors.ivory,
    lineHeight: 21,
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(245,240,225,0.7)',
  },
});
