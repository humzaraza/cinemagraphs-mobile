import * as React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, fonts } from '../../constants/theme';
import { getPosterUrl } from '../../lib/tmdb-image';
import type { CuratedFilm } from '../../data/onboardingCuration';

type AccumulationStripProps = {
  films: CuratedFilm[];
  label: string;
  height?: 'compact' | 'tall';
};

function dedupeByPosterPath(films: CuratedFilm[]): CuratedFilm[] {
  const seen = new Set<string>();
  const result: CuratedFilm[] = [];
  for (const film of films) {
    if (seen.has(film.posterPath)) continue;
    seen.add(film.posterPath);
    result.push(film);
  }
  return result;
}

export function AccumulationStrip({ films, label, height = 'compact' }: AccumulationStripProps) {
  const deduped = dedupeByPosterPath(films);
  const sizeStyle = height === 'tall' ? styles.posterTall : styles.posterCompact;
  const overlapStyle = height === 'tall' ? styles.overlapTall : styles.overlapCompact;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.cascadeRow}>
        {deduped.map((film, index) => (
          <Image
            key={film.posterPath}
            testID="accumulation-poster"
            source={{ uri: getPosterUrl(film, 'thumbnail') ?? '' }}
            style={[styles.poster, sizeStyle, index > 0 ? overlapStyle : null]}
            resizeMode="cover"
          />
        ))}
        <LinearGradient
          testID="accumulation-fade-gradient"
          colors={['rgba(13,13,26,0)', colors.background]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          pointerEvents="none"
          style={styles.fadeGradient}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.ivory,
    opacity: 0.7,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  cascadeRow: {
    width: '100%',
    flexDirection: 'row',
    overflow: 'hidden',
    position: 'relative',
  },
  poster: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 1.5,
  },
  posterCompact: {
    width: 24,
    height: 36,
  },
  posterTall: {
    width: 18,
    height: 28,
  },
  overlapCompact: {
    marginLeft: -16,
  },
  overlapTall: {
    marginLeft: -12,
  },
  fadeGradient: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '20%',
  },
});
