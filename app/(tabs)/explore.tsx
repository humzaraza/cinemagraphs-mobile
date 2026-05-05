import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  FlatList,
  Pressable,
  Animated,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline } from 'react-native-svg';
import { colors, fonts, spacing, borderRadius } from '../../src/constants/theme';
import Sparkline from '../../src/components/Sparkline';
import {
  fetchTickerFilms,
  fetchNowPlayingFilms,
  fetchTrendingFilms,
  fetchRecommendedFilms,
} from '../../src/lib/api';
import { getPosterUrl } from '../../src/lib/tmdb-image';
import type { Film } from '../../src/types/film';

const SCREEN_WIDTH = Dimensions.get('window').width;
const POSTER_WIDTH = 90;
const POSTER_HEIGHT = 130;
const TICKER_SPEED = 44800;

function calcDelta(dataPoints: Array<{ score: number }>): number | null {
  if (dataPoints.length < 4) return null;
  const sampleSize = Math.max(2, Math.floor(dataPoints.length * 0.25));
  const firstAvg =
    dataPoints.slice(0, sampleSize).reduce((s, d) => s + d.score, 0) / sampleSize;
  const lastAvg =
    dataPoints.slice(-sampleSize).reduce((s, d) => s + d.score, 0) / sampleSize;
  return lastAvg - firstAvg;
}

// ---------------------------------------------------------------------------
// Skeleton placeholder with pulse animation
// ---------------------------------------------------------------------------

function SkeletonBox({ width, height, style }: { width: number; height: number; style?: object }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.6, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width, height, backgroundColor: 'rgba(245,240,225,0.06)', borderRadius: borderRadius.md, opacity },
        style,
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Section heading
// ---------------------------------------------------------------------------

function SectionHeading({ title }: { title: string }) {
  return <Text style={styles.sectionHeading}>{title}</Text>;
}

// ---------------------------------------------------------------------------
// Ticket stub overlay icon
// ---------------------------------------------------------------------------

function TicketStub() {
  return (
    <View style={styles.ticketStub}>
      <Svg width={10} height={10} viewBox="0 0 24 24">
        <Polyline
          points="4,6 4,18 20,18 20,6 4,6"
          fill="none"
          stroke={colors.gold}
          strokeWidth={1.5}
        />
        <Polyline
          points="8,6 8,18"
          fill="none"
          stroke={colors.gold}
          strokeWidth={1.5}
        />
        <Polyline
          points="12,10 12,14"
          fill="none"
          stroke={colors.gold}
          strokeWidth={1.5}
        />
        <Polyline
          points="16,10 16,14"
          fill="none"
          stroke={colors.gold}
          strokeWidth={1.5}
        />
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Poster card (Now Playing / Recommended)
// ---------------------------------------------------------------------------

function PosterCard({ film }: { film: Film }) {
  const router = useRouter();
  const posterUri = getPosterUrl(film, 'card');

  return (
    <Pressable
      onPress={() => router.push(`/film/${film.id}` as any)}
      style={styles.posterCard}
    >
      {posterUri ? (
        <Image source={{ uri: posterUri }} style={styles.posterImage} resizeMode="cover" />
      ) : (
        <View style={styles.posterPlaceholder}>
          <Text style={styles.posterPlaceholderText}>{film.title}</Text>
        </View>
      )}
      {/* TODO: unhide ticket stub when watched feature is ready */}
      {false && <TicketStub />}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Movie Market Ticker
// ---------------------------------------------------------------------------

function TickerItem({ film }: { film: Film }) {
  const router = useRouter();
  const score = film.sentimentGraph?.overallScore;
  const dataPoints = film.sentimentGraph?.dataPoints;

  if (!dataPoints || dataPoints.length < 2) {
    return (
      <Pressable onPress={() => router.push(`/film/${film.id}` as any)} style={styles.tickerItem}>
        <Text style={styles.tickerTitle} numberOfLines={1}>{film.title}</Text>
        {score != null && (
          <Text style={styles.tickerScore}>{score.toFixed(1)}</Text>
        )}
      </Pressable>
    );
  }

  const delta = calcDelta(dataPoints);
  const isPositive = delta != null && delta >= 0;
  const trendColor = isPositive ? colors.positiveGreen : colors.negativeRed;

  return (
    <Pressable onPress={() => router.push(`/film/${film.id}` as any)} style={styles.tickerItem}>
      <Text style={styles.tickerTitle} numberOfLines={1}>{film.title}</Text>
      <Sparkline
        dataPoints={dataPoints}
        width={50}
        height={24}
        strokeColor={trendColor}
        strokeWidth={1.2}
        showMidline
      />
      {score != null && (
        <Text style={styles.tickerScore}>{score.toFixed(1)}</Text>
      )}
      {delta != null && (
        <Text style={[styles.tickerDelta, { color: trendColor }]}>
          {isPositive ? '+' : ''}{delta.toFixed(1)}
        </Text>
      )}
    </Pressable>
  );
}

function MovieTicker({ films }: { films: Film[] }) {
  const scrollX = useRef(new Animated.Value(0)).current;
  const setWidth = useRef(0);
  const offsetRef = useRef(0);
  const touchStartX = useRef(0);
  const touchStartOffset = useRef(0);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const startAutoScroll = useCallback((fromOffset: number) => {
    if (setWidth.current === 0) return;
    const w = setWidth.current;

    // Normalize into [0, -w) range
    let pos = fromOffset % w;
    if (pos > 0) pos -= w;
    offsetRef.current = pos;
    scrollX.setValue(pos);

    // Distance remaining in this cycle
    const remaining = -w - pos;
    const fraction = Math.abs(remaining) / w;
    const duration = fraction * TICKER_SPEED;

    const anim = Animated.timing(scrollX, {
      toValue: pos + remaining,
      duration,
      useNativeDriver: true,
      easing: (t: number) => t, // linear
    });
    animRef.current = anim;
    anim.start(({ finished }) => {
      if (finished) {
        // Reset to 0 and loop
        offsetRef.current = 0;
        scrollX.setValue(0);
        startAutoScroll(0);
      }
    });
  }, [scrollX]);

  // Measure one copy of the item set
  const onSetLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number } } }) => {
      const w = e.nativeEvent.layout.width;
      if (w > 0 && setWidth.current === 0) {
        setWidth.current = w;
        startAutoScroll(0);
      }
    },
    [startAutoScroll]
  );

  // Clean up on unmount
  useEffect(() => {
    return () => { animRef.current?.stop(); };
  }, []);

  if (films.length === 0) return null;

  // Render three copies so there is always content visible during drag
  const tripled = [...films, ...films, ...films];

  return (
    <View
      style={styles.tickerContainer}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => {
        animRef.current?.stop();
        // Capture where the finger started and the current scroll position
        touchStartX.current = e.nativeEvent.pageX;
        // Read the current animated value
        scrollX.stopAnimation((val) => {
          offsetRef.current = val;
          touchStartOffset.current = val;
        });
      }}
      onResponderMove={(e) => {
        const dx = e.nativeEvent.pageX - touchStartX.current;
        const newPos = touchStartOffset.current + dx;
        offsetRef.current = newPos;
        scrollX.setValue(newPos);
      }}
      onResponderRelease={() => {
        startAutoScroll(offsetRef.current);
      }}
    >
      <Animated.View style={[styles.tickerStrip, { transform: [{ translateX: scrollX }] }]}>
        {/* First copy used for measurement */}
        <View onLayout={onSetLayout} style={styles.tickerSet}>
          {films.map((film) => (
            <TickerItem key={`a-${film.id}`} film={film} />
          ))}
        </View>
        {/* Additional copies for seamless wrap */}
        <View style={styles.tickerSet}>
          {films.map((film) => (
            <TickerItem key={`b-${film.id}`} film={film} />
          ))}
        </View>
        <View style={styles.tickerSet}>
          {films.map((film) => (
            <TickerItem key={`c-${film.id}`} film={film} />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Trending arc card
// ---------------------------------------------------------------------------

function TrendingArcCard({ film }: { film: Film }) {
  const router = useRouter();
  const posterUri = getPosterUrl(film, 'thumbnail');
  const score = film.sentimentGraph?.overallScore;
  const dataPoints = film.sentimentGraph?.dataPoints;

  // Card padding (10) + poster (44) + gaps (10+10) + score (~40) + card padding (10) = ~124
  const sparklineWidth = SCREEN_WIDTH - 28 - 124;

  return (
    <Pressable onPress={() => router.push(`/film/${film.id}` as any)} style={styles.trendingCard}>
      {posterUri ? (
        <Image source={{ uri: posterUri }} style={styles.trendingPoster} resizeMode="cover" />
      ) : (
        <View style={[styles.trendingPoster, styles.posterPlaceholder]} />
      )}
      <View style={styles.trendingMiddle}>
        <Text style={styles.trendingTitle} numberOfLines={1}>{film.title}</Text>
        {dataPoints && dataPoints.length >= 2 && (
          <Sparkline
            dataPoints={dataPoints}
            width={sparklineWidth}
            height={50}
            strokeColor={colors.gold}
            strokeWidth={1.8}
            showAxes
            showMidline
            runtimeMinutes={film.runtime}
          />
        )}
      </View>
      {score != null && (
        <Text style={styles.trendingScore}>{score.toFixed(1)}</Text>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Loading skeletons
// ---------------------------------------------------------------------------

function TickerSkeleton() {
  return (
    <View style={styles.tickerContainer}>
      <SkeletonBox width={SCREEN_WIDTH} height={28} style={{ borderRadius: 0 }} />
    </View>
  );
}

function PosterRowSkeleton() {
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonBox key={i} width={POSTER_WIDTH} height={POSTER_HEIGHT} />
      ))}
    </View>
  );
}

function TrendingCardSkeleton() {
  return (
    <View style={{ gap: 10, marginBottom: 20 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <SkeletonBox key={i} width={SCREEN_WIDTH - 28} height={84} style={{ borderRadius: borderRadius.lg }} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Explore screen
// ---------------------------------------------------------------------------

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const [tickerFilms, setTickerFilms] = useState<Film[]>([]);
  const [nowPlaying, setNowPlaying] = useState<Film[]>([]);
  const [trending, setTrending] = useState<Film[]>([]);
  const [recommended, setRecommended] = useState<Film[]>([]);

  const [loadingTicker, setLoadingTicker] = useState(true);
  const [loadingNowPlaying, setLoadingNowPlaying] = useState(true);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [loadingRecommended, setLoadingRecommended] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(async () => {
    const loads = [
      fetchTickerFilms().then(setTickerFilms).catch(() => {}).finally(() => setLoadingTicker(false)),
      fetchNowPlayingFilms().then(setNowPlaying).catch(() => {}).finally(() => setLoadingNowPlaying(false)),
      fetchTrendingFilms().then(setTrending).catch(() => {}).finally(() => setLoadingTrending(false)),
      fetchRecommendedFilms().then(setRecommended).catch(() => {}).finally(() => setLoadingRecommended(false)),
    ];
    await Promise.all(loads);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setLoadingTicker(true);
    setLoadingNowPlaying(true);
    setLoadingTrending(true);
    setLoadingRecommended(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const renderPoster = useCallback(
    ({ item }: { item: Film }) => <PosterCard film={item} />,
    []
  );

  const keyExtractor = useCallback((item: Film) => item.id, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Sticky ticker */}
      {loadingTicker ? <TickerSkeleton /> : <MovieTicker films={tickerFilms} />}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold}
          />
        }
      >
        {/* Now Playing */}
        <SectionHeading title="Now playing" />
        {loadingNowPlaying ? (
          <PosterRowSkeleton />
        ) : nowPlaying.length > 0 ? (
          <FlatList
            data={nowPlaying}
            renderItem={renderPoster}
            keyExtractor={keyExtractor}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.posterRow}
            scrollEnabled
          />
        ) : null}

        {/* Trending arcs */}
        <SectionHeading title="Trending arcs" />
        {loadingTrending ? (
          <TrendingCardSkeleton />
        ) : trending.length > 0 ? (
          <View style={styles.trendingList}>
            {trending.map((film) => (
              <TrendingArcCard key={film.id} film={film} />
            ))}
          </View>
        ) : null}

        {/* Recommended for you */}
        {/* TODO: Replace with personalized recommendation engine. Currently showing recent films as placeholder. */}
        <SectionHeading title="Recommended for you" />
        {loadingRecommended ? (
          <PosterRowSkeleton />
        ) : recommended.length > 0 ? (
          <FlatList
            data={recommended}
            renderItem={renderPoster}
            keyExtractor={keyExtractor}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.posterRow}
            scrollEnabled
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 80,
  },
  sectionHeading: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.gold,
    marginBottom: 10,
    letterSpacing: -0.1,
  },

  // Ticker
  tickerContainer: {
    backgroundColor: 'rgba(13,13,26,0.97)',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(200,169,81,0.1)',
    paddingVertical: 16,
    overflow: 'hidden',
  },
  tickerStrip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tickerSet: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 36,
  },
  tickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tickerTitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ivory,
    maxWidth: 140,
  },
  tickerScore: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.gold,
  },
  tickerDelta: {
    fontFamily: fonts.body,
    fontSize: 13,
  },

  // Poster cards
  posterRow: {
    gap: 8,
    marginBottom: 20,
  },
  posterCard: {
    width: 90,
    height: 130,
    borderRadius: borderRadius.md,
    borderWidth: 0.5,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  posterImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  posterPlaceholder: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  posterPlaceholderText: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: colors.textTertiary,
    textAlign: 'center',
  },

  // Ticket stub
  ticketStub: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 18,
    height: 18,
    backgroundColor: 'rgba(13,13,26,0.7)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.2)',
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Trending arcs
  trendingList: {
    gap: 10,
    marginBottom: 20,
  },
  trendingCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: borderRadius.lg,
    padding: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.08)',
  },
  trendingPoster: {
    width: 44,
    height: 64,
    minWidth: 44,
    maxWidth: 44,
    borderRadius: borderRadius.sm,
    backgroundColor: '#1a1a2e',
  },
  trendingMiddle: {
    flex: 1,
  },
  trendingTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ivory,
    marginBottom: 4,
  },
  trendingScore: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.gold,
    alignSelf: 'center',
  },
});
