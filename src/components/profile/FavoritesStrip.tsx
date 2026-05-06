import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import FavoriteSlot, { type FavoriteFilm } from './FavoriteSlot';

type FavoritesStripProps = {
  favorites: FavoriteFilm[];
  onAddFavorite: () => void;
  onPressFilm: (filmId: string) => void;
};

export default function FavoritesStrip({
  favorites,
  onAddFavorite,
  onPressFilm,
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
          />
        ))}
      </View>
      {isEmpty && (
        <Text style={styles.microcopy}>
          Review films to add favorites. Each favorite shows your personal arc shape.
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
