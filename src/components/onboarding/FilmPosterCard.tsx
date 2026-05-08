import * as React from 'react';
import { Pressable, View, Text, Image, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

import { colors, fonts } from '../../constants/theme';
import { getPosterUrl } from '../../lib/tmdb-image';
import type { Screen3Film } from '../../lib/onboarding-api';

type FilmPosterCardProps = {
  film: Screen3Film;
  selected: boolean;
  onPress: () => void;
};

const SPRING_CONFIG = { damping: 14, stiffness: 180 } as const;
const POSTER_RADIUS = 6;
const HALO_OFFSET = 2;
// Mockup .film-poster-selected: box-shadow 0 0 0 2px rgba(200,169,81,0.25).
// Implemented as an inset border View at -2 offset with borderColor solid
// gold and animated opacity that lands at this alpha when selected.
const HALO_VISIBLE_OPACITY = 0.25;

export function FilmPosterCard({ film, selected, onPress }: FilmPosterCardProps) {
  const haloOpacity = useSharedValue(0);
  const borderOpacity = useSharedValue(0);

  React.useEffect(() => {
    haloOpacity.value = withSpring(selected ? HALO_VISIBLE_OPACITY : 0, SPRING_CONFIG);
    borderOpacity.value = withSpring(selected ? 1 : 0, SPRING_CONFIG);
  }, [selected, haloOpacity, borderOpacity]);

  const haloAnimatedStyle = useAnimatedStyle(() => ({ opacity: haloOpacity.value }));
  const borderAnimatedStyle = useAnimatedStyle(() => ({ opacity: borderOpacity.value }));

  const posterUri = getPosterUrl(film, 'grid') ?? '';

  return (
    <Pressable testID="film-poster-pressable" onPress={onPress}>
      <View style={styles.cell}>
        <Animated.View
          testID="film-poster-halo"
          pointerEvents="none"
          style={[styles.halo, haloAnimatedStyle]}
        />
        <View style={styles.posterWrapper}>
          <Image source={{ uri: posterUri }} style={styles.poster} resizeMode="cover" />
          <Animated.View
            pointerEvents="none"
            style={[styles.selectedBorder, borderAnimatedStyle]}
          />
          {selected ? (
            <View testID="film-checkmark" style={styles.checkmarkBadge}>
              <Text style={styles.checkmarkGlyph}>{'✓'}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <Text
        style={[styles.title, selected ? styles.titleSelected : null]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {film.title}
      </Text>
      <Text style={styles.year}>{film.year}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: {
    position: 'relative',
  },
  // NOTE: Halo alpha here is gold@0.25 per mockup .film-poster-
  // selected (box-shadow 0 0 0 2px rgba(200,169,81,0.25)).
  // MosaicBlock uses gold@0.15 (colors.goldHalo) per its own
  // mockup spec. The difference is intentional design, not drift.
  halo: {
    position: 'absolute',
    top: -HALO_OFFSET,
    left: -HALO_OFFSET,
    right: -HALO_OFFSET,
    bottom: -HALO_OFFSET,
    borderRadius: POSTER_RADIUS + HALO_OFFSET,
    borderWidth: HALO_OFFSET,
    borderColor: colors.gold,
  },
  posterWrapper: {
    position: 'relative',
    aspectRatio: 2 / 3,
    width: '100%',
    borderRadius: POSTER_RADIUS,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.bandBorder,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  selectedBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: POSTER_RADIUS,
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  checkmarkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkGlyph: {
    color: colors.background,
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    lineHeight: 11,
  },
  title: {
    fontFamily: fonts.bodyMedium,
    fontSize: 9,
    color: colors.ivory,
    textAlign: 'center',
    marginTop: 5,
    lineHeight: 11,
    paddingHorizontal: 2,
  },
  titleSelected: {
    color: colors.gold,
  },
  year: {
    fontFamily: fonts.body,
    fontSize: 8.5,
    color: colors.ivory,
    opacity: 0.4,
    textAlign: 'center',
    marginTop: 1,
    paddingHorizontal: 2,
  },
});
