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
import { colors, fonts, borderRadius } from '../src/constants/theme';
import { fetchSectionFilms, type SectionFilter } from '../src/lib/api';
import { getPosterUrl } from '../src/lib/tmdb-image';
import type { Film } from '../src/types/film';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_PADDING = 12;
const GRID_GAP = 8;
const TILE_WIDTH = (SCREEN_WIDTH - SCREEN_PADDING * 2 - GRID_GAP * 2) / 3;
const POSTER_HEIGHT = TILE_WIDTH * 1.5;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
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
    <View style={{ width: TILE_WIDTH }}>
      <Animated.View
        style={{
          width: TILE_WIDTH,
          height: POSTER_HEIGHT,
          backgroundColor: 'rgba(245,240,225,0.06)',
          borderRadius: borderRadius.md,
          opacity,
        }}
      />
      <Animated.View
        style={{
          width: TILE_WIDTH - 16,
          height: 10,
          marginTop: 6,
          backgroundColor: 'rgba(245,240,225,0.06)',
          borderRadius: borderRadius.sm,
          opacity,
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Poster tile: poster + title + gold score. No graphs, consistent with
// the Explore rows this screen expands.
// ---------------------------------------------------------------------------

function PosterTile({ film, onPress }: { film: Film; onPress: () => void }) {
  const uri = getPosterUrl(film, 'grid');
  const score = film.sentimentGraph?.overallScore;
  return (
    <Pressable onPress={onPress} style={styles.tile}>
      {uri ? (
        <Image source={{ uri }} style={styles.poster} resizeMode="cover" />
      ) : (
        <View style={styles.poster} />
      )}
      <Text style={styles.tileTitle} numberOfLines={2}>{film.title}</Text>
      {score != null && <Text style={styles.tileScore}>{score.toFixed(1)}</Text>}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Main screen. Generic "See all" target for the Explore rows: receives
// the section title/subtitle and the same /api/films filter params the
// row used, via route params.
// ---------------------------------------------------------------------------

export default function SectionListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    title?: string | string[];
    sub?: string | string[];
    arcShape?: string | string[];
    nowPlaying?: string | string[];
    sort?: string | string[];
  }>();

  const title = firstParam(params.title) ?? '';
  const sub = firstParam(params.sub) ?? '';
  const arcShape = firstParam(params.arcShape);
  const nowPlaying = firstParam(params.nowPlaying) === 'true';
  const sortParam = firstParam(params.sort);
  const sort =
    sortParam === 'highest' || sortParam === 'swing' || sortParam === 'recent'
      ? sortParam
      : undefined;

  const filter: SectionFilter | null =
    arcShape || nowPlaying || sort ? { arcShape, nowPlaying, sort } : null;

  const [films, setFilms] = useState<Film[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const loadingMoreRef = useRef(false);
  // The filter comes from route params and is stable for the life of
  // the screen; a ref keeps loadPage's identity stable too.
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const loadPage = useCallback(
    async (pageToLoad: number, mode: 'initial' | 'append' | 'refresh') => {
      if (!filterRef.current) return;
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        if (mode === 'initial') setInitialLoading(true);
        if (mode === 'append') {
          loadingMoreRef.current = true;
          setLoadingMore(true);
        }
        const result = await fetchSectionFilms(filterRef.current, pageToLoad, ctrl.signal);
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
    [],
  );

  // Validate the filter, bail out if missing, otherwise kick off the
  // first load.
  useEffect(() => {
    if (!filterRef.current) {
      router.replace('/');
      return;
    }
    loadPage(1, 'initial');
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  if (!filter) return null;

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
          {!!sub && <Text style={styles.headerKicker}>{sub}</Text>}
          <Text style={styles.headerTitle}>{title}</Text>
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
    fontFamily: fonts.bodySemiBold,
    fontSize: 18,
    color: colors.ivory,
    letterSpacing: -0.2,
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
    marginBottom: 14,
  },
  tile: {
    width: TILE_WIDTH,
  },
  poster: {
    width: '100%',
    height: POSTER_HEIGHT,
    borderRadius: borderRadius.md,
    backgroundColor: '#1a1a2e',
  },
  tileTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 15,
    color: colors.ivory,
    marginTop: 6,
  },
  tileScore: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.gold,
    marginTop: 2,
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
