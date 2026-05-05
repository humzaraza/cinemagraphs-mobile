import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { getPosterUrl } from '../../lib/tmdb-image';
import MiniArc from '../MiniArc';

export type FavoriteFilm = {
  id: string;
  title: string;
  year: number | null;
  posterUrl: string | null;
  sparklinePoints: number[];
};

type FavoriteSlotProps = {
  film?: FavoriteFilm;
  onAdd?: () => void;
  onPressFilm?: (filmId: string) => void;
};

export default function FavoriteSlot({
  film,
  onAdd,
  onPressFilm,
}: FavoriteSlotProps) {
  if (!film) {
    return (
      <View style={styles.outer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add favorite film"
          onPress={onAdd}
          hitSlop={8}
        >
          {/* TODO Phase 7: revisit if empty slots feel too plain.
              Mockup specifies a diagonal hatch at 0.04 alpha;
              simplified to plain tint for v1. */}
          <View style={styles.posterEmpty}>
            <Text style={styles.plus}>+</Text>
          </View>
          <View style={styles.arcEmpty} />
        </Pressable>
      </View>
    );
  }

  const posterUri = getPosterUrl(film, 'card');

  return (
    <View style={styles.outer}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${film.title}`}
        onPress={() => onPressFilm?.(film.id)}
        hitSlop={8}
      >
        <View style={styles.posterShadow}>
          {posterUri ? (
            <Image
              source={{ uri: posterUri }}
              style={styles.posterImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.posterImage, styles.posterFallback]} />
          )}
        </View>
        <View style={styles.arc}>
          <MiniArc variant="favorite" points={film.sparklinePoints} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
  },
  posterShadow: {
    aspectRatio: 2 / 3,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  posterImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  posterFallback: {
    backgroundColor: 'rgba(245,240,225,0.06)',
  },
  posterEmpty: {
    aspectRatio: 2 / 3,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(245,240,225,0.12)',
    backgroundColor: 'rgba(245,240,225,0.025)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: {
    fontSize: 24,
    fontWeight: '300',
    color: 'rgba(245,240,225,0.25)',
  },
  arc: {
    marginTop: 6,
    alignItems: 'center',
  },
  arcEmpty: {
    height: 28,
    marginTop: 6,
    borderRadius: 2,
    backgroundColor: 'rgba(245,240,225,0.04)',
  },
});
