import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
  Animated,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, borderRadius } from '../../src/constants/theme';
import { fetchCategoryFilms } from '../../src/lib/api';
import {
  CATEGORY_LABELS,
  CATEGORY_PARAMS,
  isCategoryKey,
} from '../../src/lib/categories';
import type { Film } from '../../src/types/film';

const SCREEN_WIDTH = Dimensions.get('window').width;
const TMDB_POSTER = 'https://image.tmdb.org/t/p/w185';
const SCREEN_PADDING = 12;
const GRID_GAP = 8;
const TILE_WIDTH = (SCREEN_WIDTH - SCREEN_PADDING * 2 - GRID_GAP * 2) / 3;
const TILE_HEIGHT = TILE_WIDTH * 1.5;

function getPosterUri(film: Film): string | null {
  const path = film.posterUrl || film.posterPath;
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${TMDB_POSTER}${path}`;
}

// ---------------------------------------------------------------------------
// Skeleton tile (same opacity-pulse pattern used elsewhere)
// ---------------------------------------------------------------------------

function SkeletonTile() {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.6, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={{
        width: TILE_WIDTH,
        height: TILE_HEIGHT,
        backgroundColor: 'rgba(245,240,225,0.06)',
        borderRadius: borderRadius.md,
        opacity,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Poster tile
// ---------------------------------------------------------------------------

function PosterTile({ film, onPress }: { film: Film; onPress: () => void }) {
  const uri = getPosterUri(film);
  return (
    <Pressable onPress={onPress} style={styles.tile}>
      {uri ? (
        <Image source={{ uri }} style={styles.poster} resizeMode="cover" />
      ) : (
        <View style={[styles.poster, styles.posterFallback]} />
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function CategoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { key } = useLocalSearchParams<{ key: string | string[] }>();
  const rawKey = Array.isArray(key) ? key[0] : key;
  const validKey =
    typeof rawKey === 'string' && isCategoryKey(rawKey) ? rawKey : null;
  const params = validKey ? CATEGORY_PARAMS[validKey] : null;
  const label = validKey ? CATEGORY_LABELS[validKey] : '';

  const [films, setFilms] = useState<Film[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const loadingMoreRef = useRef(false);

  const loadPage = useCallback(
    async (pageToLoad: number, mode: 'initial' | 'append' | 'refresh') => {
      if (!params) return;
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        if (mode === 'initial') setInitialLoading(true);
        if (mode === 'append') {
          loadingMoreRef.current = true;
          setLoadingMore(true);
        }
        const result = await fetchCategoryFilms(params, pageToLoad, ctrl.signal);
        if (ctrl.signal.aborted) return;
        setError(false);
        if (mode === 'append') {
          setFilms((prev) => [...prev, ...result.films]);
        } else {
          setFilms(result.films);
        }
        setHasMore(result.hasMore);
        setPage(pageToLoad);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        if (mode !== 'append') setError(true);
      } finally {
        if (!ctrl.signal.aborted) {
          if (mode === 'initial') setInitialLoading(false);
          if (mode === 'append') {
            loadingMoreRef.current = false;
            setLoadingMore(false);
          }
          if (mode === 'refresh') setRefreshing(false);
        }
      }
    },
    [params],
  );

  // Validate key, redirect if invalid, otherwise kick off the first load.
  useEffect(() => {
    if (!validKey) {
      router.replace('/');
      return;
    }
    loadPage(1, 'initial');
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validKey]);

  const onEndReached = useCallback(() => {
    if (loadingMoreRef.current) return;
    if (initialLoading || refreshing) return;
    if (!hasMore) return;
    loadPage(page + 1, 'append');
  }, [initialLoading, refreshing, hasMore, page, loadPage]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPage(1, 'refresh');
  }, [loadPage]);

  const renderItem = useCallback(
    ({ item }: { item: Film }) => (
      <PosterTile
        film={item}
        onPress={() => router.push(`/film/${item.id}` as any)}
      />
    ),
    [router],
  );

  const keyExtractor = useCallback((film: Film) => film.id, []);

  if (!validKey) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={colors.ivory} strokeWidth={2} />
          </Svg>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerKicker}>Browse by</Text>
          <Text style={styles.headerTitle}>{label}</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      {/* Body */}
      {initialLoading ? (
        <View style={styles.skeletonGrid}>
          {Array.from({ length: 12 }).map((_, i) => (
            <SkeletonTile key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={films}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={3}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[
            styles.gridContent,
            films.length === 0 && styles.gridEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.gold}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {error
                  ? "Couldn't load films. Pull down to retry."
                  : 'No films found'}
              </Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color={colors.gold} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginTop: 12,
    marginBottom: 16,
  },
  backBtn: { width: 32, height: 32, justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerKicker: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: 'rgba(245,240,225,0.35)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  headerTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.ivory,
  },

  // Grid
  gridContent: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: 80,
  },
  gridEmpty: {
    flexGrow: 1,
  },
  row: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  tile: {
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
  },
  poster: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.md,
    backgroundColor: '#1a1a2e',
  },
  posterFallback: {
    backgroundColor: '#1a1a2e',
  },

  // Skeleton
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SCREEN_PADDING,
    gap: GRID_GAP,
  },

  // Footer / states
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: 'rgba(245,240,225,0.5)',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
