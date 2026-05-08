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

const COMPACT_HEIGHT = 56;
const TALL_HEIGHT = 64;

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
  const containerHeight = height === 'tall' ? TALL_HEIGHT : COMPACT_HEIGHT;
  const sizeStyle = height === 'tall' ? styles.posterTall : styles.posterCompact;
  const overlapStyle = height === 'tall' ? styles.overlapTall : styles.overlapCompact;

  return (
    <View testID="accumulation-band" style={[styles.band, { height: containerHeight }]}>
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
  band: {
    width: '100%',
    backgroundColor: colors.bandBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.bandBorder,
    position: 'relative',
    overflow: 'hidden',
  },
  label: {
    position: 'absolute',
    top: 6,
    left: 16,
    fontFamily: fonts.body,
    fontSize: 9,
    color: colors.labelGold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  cascadeRow: {
    position: 'absolute',
    top: 18,
    left: 16,
    right: 16,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  poster: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
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
