import { useCallback, useState } from 'react';
import { View, Text, Image, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { getRecentlyViewed, type RecentFilm } from '../../lib/recentlyViewed';
import { getPosterUrl } from '../../lib/tmdb-image';

// Horizontal poster strip of recently viewed films, shown on the Search
// tab idle state. Renders nothing while loading or when the store is
// empty. Refreshed on screen focus so films viewed since the tab last
// rendered appear without a remount.
export default function RecentlyViewedStrip() {
  const router = useRouter();
  const [films, setFilms] = useState<RecentFilm[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getRecentlyViewed().then((list) => {
        if (active) setFilms(list);
      });
      return () => {
        active = false;
      };
    }, [])
  );

  // Entries whose poster can't resolve to a URL are skipped rather than
  // rendered as blank tiles.
  const renderable = films?.filter((f) => getPosterUrl(f, 'card') != null) ?? [];
  if (renderable.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Recently viewed</Text>
      <FlatList
        data={renderable}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.filmId}
        contentContainerStyle={styles.row}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/film/${item.filmId}` as any)}>
            <Image
              source={{ uri: getPosterUrl(item, 'card')! }}
              style={styles.poster}
              resizeMode="cover"
            />
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Bleed past the parent list's 14px horizontal padding so posters
  // scroll off the screen edges, mirroring the Explore rows.
  container: {
    marginHorizontal: -14,
    marginBottom: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(245,240,225,0.45)',
    marginBottom: 10,
    paddingHorizontal: 14,
  },
  row: {
    paddingHorizontal: 14,
    gap: 10,
  },
  poster: {
    width: 64,
    height: 96,
    borderRadius: 8,
  },
});
