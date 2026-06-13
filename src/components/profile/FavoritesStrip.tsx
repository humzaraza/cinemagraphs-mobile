import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import FavoriteSlot, { type FavoriteFilm } from './FavoriteSlot';

type FavoritesStripProps = {
  favorites: FavoriteFilm[];
  onAddFavorite: () => void;
  onPressFilm: (filmId: string) => void;
  // Remove the favorite at this slot index. By index, not film id, so
  // removing one copy of a film that fills multiple slots leaves the
  // others in place.
  onRemoveFavorite: (index: number) => void;
};

export default function FavoritesStrip({
  favorites,
  onAddFavorite,
  onPressFilm,
  onRemoveFavorite,
}: FavoritesStripProps) {
  const isEmpty = favorites.length === 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        {[0, 1, 2, 3].map((i) => (
          <FavoriteSlot
            key={i}
            film={favorites[i]}
            onAdd={onAddFavorite}
            onPressFilm={onPressFilm}
            onLongPress={() => onRemoveFavorite(i)}
          />
        ))}
      </View>
      {isEmpty && (
        <Text style={styles.microcopy}>
          Favorite films you&apos;ve reviewed. Each shows your personal arc shape.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
  },
  grid: {
    flexDirection: 'row',
    gap: 10,
  },
  microcopy: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(245,240,225,0.42)',
    textAlign: 'center',
    paddingHorizontal: 32,
    marginTop: 14,
    lineHeight: 17,
  },
});
