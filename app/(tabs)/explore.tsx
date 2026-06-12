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
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polyline, Circle, Path, Rect, Line, Text as SvgText } from 'react-native-svg';
import { colors, fonts, borderRadius } from '../../src/constants/theme';
import Sparkline, { formatRuntime } from '../../src/components/Sparkline';
import {
  fetchTickerFilms,
  fetchNowPlayingFilms,
  fetchHiddenPeakFilms,
  fetchSlowBurnFilms,
  fetchRecommendedFilms,
  fetchHero,
  fetchUserProfile,
} from '../../src/lib/api';
import { getPosterUrl } from '../../src/lib/tmdb-image';
import type { Film, HeroResponse } from '../../src/types/film';

const SCREEN_WIDTH = Dimensions.get('window').width;
const POSTER_WIDTH = 104;
const POSTER_ART_HEIGHT = 152;
// One full pass of the item set, per the mockup's 34s marquee cycle.
const TICKER_CYCLE_MS = 34000;
const RECOMMENDED_MIN_REVIEWS = 5;

function calcDelta(dataPoints: { score: number }[]): number | null {
  if (dataPoints.length < 4) return null;
  const sampleSize = Math.max(2, Math.floor(dataPoints.length * 0.25));
  const firstAvg =
    dataPoints.slice(0, sampleSize).reduce((s, d) => s + d.score, 0) / sampleSize;
  const lastAvg =
    dataPoints.slice(-sampleSize).reduce((s, d) => s + d.score, 0) / sampleSize;
  return lastAvg - firstAvg;
}

// ---------------------------------------------------------------------------
// Hero "why" copy, keyed by angle.label from /api/hero. One sentence per
// angle; `bold` is the single emphasized word rendered ivory/semibold
// (mockup .hero-why b). Unknown labels render no why line.
// ---------------------------------------------------------------------------

const HERO_WHY: Record<string, { pre: string; bold: string; post: string }> = {
  "today's highest": {
    pre: 'Critics rated no arc higher ',
    bold: 'today',
    post: '. This is the one to beat.',
  },
  'biggest swing': {
    pre: 'From its deepest valley to its highest crest, this arc covers serious ',
    bold: 'distance',
    post: '.',
  },
  'hidden peak': {
    pre: 'This film crests in the ',
    bold: 'middle',
    post: ", then settles. The peak isn't where you expect it.",
  },
  nosedive: {
    pre: 'It starts high and lets go. Watch the arc ',
    bold: 'fall',
    post: ', and decide if the drop is the point.',
  },
  'perfect ending': {
    pre: 'Everything builds to the final minutes. The arc saves its ',
    bold: 'best',
    post: ' for last.',
  },
  'slow burn': {
    pre: 'No spikes, no shortcuts. Just a ',
    bold: 'steady',
    post: ' climb that earns every point.',
  },
  'steady great': {
    pre: 'It never spikes and never slips. ',
    bold: 'Consistently',
    post: ' great, first minute to last.',
  },
};

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
// Section header: title + subtitle left, gold "See all" right
// ---------------------------------------------------------------------------

function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <View style={styles.secHead}>
      <View>
        <Text style={styles.secTitle}>{title}</Text>
        <Text style={styles.secSub}>{sub}</Text>
      </View>
      <Text style={styles.secMore}>See all</Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

// ---------------------------------------------------------------------------
// Ticket stub overlay icon (mockup stub: 20pt chip, rect + tear line)
// ---------------------------------------------------------------------------

function TicketStub() {
  return (
    <View style={styles.ticketStub}>
      <Svg width={11} height={11} viewBox="0 0 24 24">
        <Rect x={2} y={4} width={20} height={14} rx={2} fill="none" stroke={colors.gold} strokeWidth={1.5} />
        <Path d="M2 8h20" fill="none" stroke={colors.gold} strokeWidth={1.5} />
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Poster card: art + title + gold score. No sparklines in rows; the hero
// is the only graph on this screen.
// ---------------------------------------------------------------------------

function PosterCard({ film, inTheatres }: { film: Film; inTheatres?: boolean }) {
  const router = useRouter();
  const posterUri = getPosterUrl(film, 'card');
  const score = film.sentimentGraph?.overallScore;

  return (
    <Pressable
      onPress={() => router.push(`/film/${film.id}` as any)}
      style={styles.posterCard}
    >
      <View style={styles.posterArt}>
        {posterUri ? (
          <Image source={{ uri: posterUri }} style={styles.posterImage} resizeMode="cover" />
        ) : (
          <View style={styles.posterPlaceholder}>
            <Text style={styles.posterPlaceholderText}>{film.title}</Text>
          </View>
        )}
        <TicketStub />
        {inTheatres && (
          <View style={styles.theatresTag}>
            <Text style={styles.theatresTagText}>IN THEATRES</Text>
          </View>
        )}
      </View>
      <Text style={styles.posterTitle} numberOfLines={2}>{film.title}</Text>
      {score != null && <Text style={styles.posterScore}>{score.toFixed(1)}</Text>}
    </Pressable>
  );
}

function PosterRow({ films, inTheatres }: { films: Film[]; inTheatres?: boolean }) {
  const renderPoster = useCallback(
    ({ item }: { item: Film }) => <PosterCard film={item} inTheatres={inTheatres} />,
    [inTheatres]
  );
  return (
    <FlatList
      data={films}
      renderItem={renderPoster}
      keyExtractor={(item) => item.id}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.posterRow}
    />
  );
}

// ---------------------------------------------------------------------------
// Movie Market Ticker: Apple Stocks widget layout. Stacked title over
// score + delta, trend-colored sparkline beside (mockup variant D).
// ---------------------------------------------------------------------------

const TICKER_NEUTRAL = 'rgba(245,240,225,0.45)';

function TickerItem({ film }: { film: Film }) {
  const router = useRouter();
  const score = film.sentimentGraph?.overallScore;
  const dataPoints = film.sentimentGraph?.dataPoints ?? [];
  const delta = calcDelta(dataPoints);
  // A delta that rounds to 0.0 reads as neutral: no arrow, dim ivory.
  const deltaText = delta != null ? Math.abs(delta).toFixed(1) : null;
  const isNeutral = deltaText === '0.0';
  const isPositive = delta != null && delta >= 0;
  const trendColor = isNeutral
    ? TICKER_NEUTRAL
    : isPositive
      ? colors.teal
      : colors.negativeRed;

  return (
    <Pressable onPress={() => router.push(`/film/${film.id}` as any)} style={styles.tickerItem}>
      <View style={styles.tickerCol}>
        <Text style={styles.tickerTitle} numberOfLines={1}>{film.title}</Text>
        <View style={styles.tickerScoreRow}>
          {score != null && (
            <Text style={styles.tickerScore}>{score.toFixed(1)}</Text>
          )}
          {deltaText != null && (
            <Text style={[styles.tickerDelta, { color: trendColor }]}>
              {isNeutral ? deltaText : `${isPositive ? '▲' : '▼'} ${deltaText}`}
            </Text>
          )}
        </View>
      </View>
      {delta != null && dataPoints.length >= 2 && (
        <Sparkline
          dataPoints={dataPoints}
          width={52}
          height={26}
          strokeColor={trendColor}
          strokeWidth={1.6}
          fitY
        />
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
    const duration = fraction * TICKER_CYCLE_MS;

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
        {/* First copy used for measurement; extra copies give a seamless wrap */}
        <View onLayout={onSetLayout} style={styles.tickerSet}>
          {films.map((film) => (
            <TickerItem key={`a-${film.id}`} film={film} />
          ))}
        </View>
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
// Rotating daily hero
// ---------------------------------------------------------------------------

function PulsingDot() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.35, duration: 900, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return <Animated.View style={[styles.heroDot, { opacity }]} />;
}

const HERO_GRAPH_WIDTH = SCREEN_WIDTH - 32 - 24; // card margins + graph padding
const HERO_GRAPH_HEIGHT = 92;

function HeroGraph({ hero }: { hero: HeroResponse }) {
  const graph = hero.film.sentimentGraph;
  const points = graph?.dataPoints ?? [];
  if (!graph || points.length < 2) return null;

  const peak = graph.peakMoment;
  const lowest = graph.lowestMoment;

  const times = points.map((p) => p.timeMidpoint);
  const scores = points.map((p) => p.score);
  // Include the peak/lowest moments so their dots always land inside the
  // plotted domain even if their times/scores sit outside the midpoints.
  const allTimes = [...times, peak?.time, lowest?.time].filter((t): t is number => t != null);
  const allScores = [...scores, peak?.score, lowest?.score].filter((s): s is number => s != null);
  const minT = Math.min(...allTimes);
  const maxT = Math.max(...allTimes);
  const minS = Math.min(...allScores);
  const maxS = Math.max(...allScores);
  const tSpan = maxT - minT || 1;
  const sSpan = maxS - minS || 1;

  // Inset the plotting area on every side by at least the largest dot
  // radius (4) plus the polyline stroke (2.5) so endpoint dots and line
  // caps never clip at the SVG bounds (e.g. nosedive picks, where the
  // peak sits on the first beat and the low on the last).
  const PAD_X = 7;
  const PAD_TOP = 10;
  const PAD_BOTTOM = 14;
  const getX = (t: number) =>
    PAD_X + ((t - minT) / tSpan) * (HERO_GRAPH_WIDTH - PAD_X * 2);
  const getY = (s: number) =>
    PAD_TOP + ((maxS - s) / sSpan) * (HERO_GRAPH_HEIGHT - PAD_TOP - PAD_BOTTOM);

  const polyline = points.map((p) => `${getX(p.timeMidpoint)},${getY(p.score)}`).join(' ');

  // Dashed midline at the vertical center of the plotted y-range.
  const midY = PAD_TOP + (HERO_GRAPH_HEIGHT - PAD_TOP - PAD_BOTTOM) / 2;

  // Score label beside each dot. Dots in the left half label to the
  // right and vice versa, so labels stay in bounds even when the dot
  // sits on the first or last beat. Baseline is clamped vertically.
  const dotLabel = (cx: number, cy: number, r: number) => {
    const onRight = cx <= HERO_GRAPH_WIDTH / 2;
    return {
      x: onRight ? cx + r + 4 : cx - r - 4,
      y: Math.min(Math.max(cy + 3.5, 10), HERO_GRAPH_HEIGHT - 2),
      anchor: (onRight ? 'start' : 'end') as 'start' | 'end',
    };
  };
  const peakLabel = peak ? dotLabel(getX(peak.time), getY(peak.score), 4) : null;
  const lowLabel = lowest ? dotLabel(getX(lowest.time), getY(lowest.score), 3.5) : null;

  const runtime = hero.film.runtime;

  return (
    <View style={styles.heroGraph}>
      <Svg width={HERO_GRAPH_WIDTH} height={HERO_GRAPH_HEIGHT}>
        <Line
          x1={PAD_X}
          y1={midY}
          x2={HERO_GRAPH_WIDTH - PAD_X}
          y2={midY}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={0.5}
          strokeDasharray="3,3"
        />
        <Polyline
          points={polyline}
          fill="none"
          stroke={colors.gold}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {peak && (
          <Circle cx={getX(peak.time)} cy={getY(peak.score)} r={4} fill={colors.teal} />
        )}
        {lowest && (
          <Circle cx={getX(lowest.time)} cy={getY(lowest.score)} r={3.5} fill={colors.negativeRed} />
        )}
        {peak && peakLabel && (
          <SvgText
            x={peakLabel.x}
            y={peakLabel.y}
            textAnchor={peakLabel.anchor}
            fontSize={10}
            fontWeight="600"
            fill={colors.teal}
          >
            {peak.score.toFixed(1)}
          </SvgText>
        )}
        {lowest && lowLabel && (
          <SvgText
            x={lowLabel.x}
            y={lowLabel.y}
            textAnchor={lowLabel.anchor}
            fontSize={10}
            fontWeight="600"
            fill={colors.negativeRed}
          >
            {lowest.score.toFixed(1)}
          </SvgText>
        )}
      </Svg>
      {runtime != null && runtime > 0 && (
        <View style={styles.heroAxisRow}>
          <Text style={[styles.heroAxisLabel, { textAlign: 'left' }]}>0m</Text>
          <Text style={[styles.heroAxisLabel, { textAlign: 'center' }]}>
            {formatRuntime(Math.round(runtime / 2))}
          </Text>
          <Text style={[styles.heroAxisLabel, { textAlign: 'right' }]}>
            {formatRuntime(runtime)}
          </Text>
        </View>
      )}
    </View>
  );
}

function HeroCard({ hero }: { hero: HeroResponse }) {
  const router = useRouter();
  const film = hero.film;
  const posterUri = getPosterUrl(film, 'card');
  const score = film.sentimentGraph?.overallScore;
  const why = HERO_WHY[hero.angle.label];
  const weekday = new Date()
    .toLocaleDateString('en-US', { weekday: 'long' })
    .toUpperCase();

  return (
    <Pressable onPress={() => router.push(`/film/${film.id}` as any)}>
      <LinearGradient
        colors={['#15131f', '#0f0d18']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroEyebrow}>
          <PulsingDot />
          <Text style={styles.heroAngle}>{hero.angle.label.toUpperCase()}</Text>
          <Text style={styles.heroDay}>{weekday}</Text>
        </View>

        <View style={styles.heroBody}>
          <View style={styles.heroPoster}>
            {posterUri ? (
              <Image source={{ uri: posterUri }} style={styles.heroPosterImage} resizeMode="cover" />
            ) : null}
            <TicketStub />
          </View>
          <View style={styles.heroMeta}>
            <Text style={styles.heroTitle} numberOfLines={2}>{film.title}</Text>
            <Text style={styles.heroYear}>
              {[film.year, film.director].filter(Boolean).join(' · ')}
            </Text>
            {score != null && (
              <View style={styles.heroScoreRow}>
                <Text style={styles.heroScore}>{score.toFixed(1)}</Text>
                <Text style={styles.heroScoreLabel}>overall</Text>
              </View>
            )}
          </View>
        </View>

        <HeroGraph hero={hero} />

        {why && (
          <Text style={styles.heroWhy}>
            {why.pre}
            <Text style={styles.heroWhyBold}>{why.bold}</Text>
            {why.post}
          </Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Loading skeletons
// ---------------------------------------------------------------------------

function TickerSkeleton() {
  return (
    <View style={styles.tickerContainer}>
      <SkeletonBox width={SCREEN_WIDTH} height={40} style={{ borderRadius: 0 }} />
    </View>
  );
}

function HeroSkeleton() {
  return (
    <View style={{ marginTop: 14, marginHorizontal: 16, marginBottom: 4 }}>
      <SkeletonBox width={SCREEN_WIDTH - 32} height={300} style={{ borderRadius: 18 }} />
    </View>
  );
}

function PosterRowSkeleton() {
  return (
    <View style={{ flexDirection: 'row', gap: 11, paddingHorizontal: 16 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <View key={i} style={{ gap: 7 }}>
          <SkeletonBox width={POSTER_WIDTH} height={POSTER_ART_HEIGHT} style={{ borderRadius: 11 }} />
          <SkeletonBox width={POSTER_WIDTH - 20} height={12} />
        </View>
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
  const [hero, setHero] = useState<HeroResponse | null>(null);
  const [nowPlaying, setNowPlaying] = useState<Film[]>([]);
  const [hiddenPeaks, setHiddenPeaks] = useState<Film[]>([]);
  const [slowBurns, setSlowBurns] = useState<Film[]>([]);
  const [recommended, setRecommended] = useState<Film[]>([]);
  const [reviewCount, setReviewCount] = useState<number | null>(null);

  const [loadingTicker, setLoadingTicker] = useState(true);
  const [loadingHero, setLoadingHero] = useState(true);
  const [loadingNowPlaying, setLoadingNowPlaying] = useState(true);
  const [loadingHiddenPeaks, setLoadingHiddenPeaks] = useState(true);
  const [loadingSlowBurns, setLoadingSlowBurns] = useState(true);
  const [loadingRecommended, setLoadingRecommended] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(async () => {
    const loads = [
      fetchTickerFilms().then(setTickerFilms).catch(() => {}).finally(() => setLoadingTicker(false)),
      // fetchHero never throws; null collapses the hero section.
      fetchHero().then(setHero).finally(() => setLoadingHero(false)),
      fetchNowPlayingFilms().then(setNowPlaying).catch(() => {}).finally(() => setLoadingNowPlaying(false)),
      fetchHiddenPeakFilms().then(setHiddenPeaks).catch(() => {}).finally(() => setLoadingHiddenPeaks(false)),
      fetchSlowBurnFilms().then(setSlowBurns).catch(() => {}).finally(() => setLoadingSlowBurns(false)),
      fetchRecommendedFilms().then(setRecommended).catch(() => {}).finally(() => setLoadingRecommended(false)),
      fetchUserProfile()
        .then((profile) => setReviewCount(profile?.stats.reviewCount ?? null))
        .catch(() => setReviewCount(null)),
    ];
    await Promise.all(loads);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setLoadingTicker(true);
    setLoadingHero(true);
    setLoadingNowPlaying(true);
    setLoadingHiddenPeaks(true);
    setLoadingSlowBurns(true);
    setLoadingRecommended(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  // Recommended is conditional: hidden until the user has 5+ reviews.
  // Below the gate the screen ends at Slow Burns.
  const showRecommended = reviewCount != null && reviewCount >= RECOMMENDED_MIN_REVIEWS;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Pinned ticker, above the scroll container */}
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
        {/* Rotating daily hero (collapses entirely if /api/hero fails) */}
        {loadingHero ? <HeroSkeleton /> : hero ? <HeroCard hero={hero} /> : null}

        {/* Now Playing */}
        <SectionHeader title="Now Playing" sub="In theatres this week" />
        {loadingNowPlaying ? (
          <PosterRowSkeleton />
        ) : (
          <PosterRow films={nowPlaying} inTheatres />
        )}

        <Divider />

        {/* Hidden Peaks */}
        <SectionHeader title="Hidden Peaks" sub="Films that crest in the middle" />
        {loadingHiddenPeaks ? <PosterRowSkeleton /> : <PosterRow films={hiddenPeaks} />}

        <Divider />

        {/* Slow Burns */}
        <SectionHeader title="Slow Burns" sub="A steady climb to the finish" />
        {loadingSlowBurns ? <PosterRowSkeleton /> : <PosterRow films={slowBurns} />}

        {/* Recommended for You (5+ reviews only) */}
        {/* TODO: Replace with personalized recommendation engine. Currently showing recent films as placeholder. */}
        {showRecommended && (
          <>
            <Divider />
            <SectionHeader title="Recommended for You" sub="Based on what you've reviewed" />
            {loadingRecommended ? <PosterRowSkeleton /> : <PosterRow films={recommended} />}
          </>
        )}
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
    paddingBottom: 92,
  },

  // Section headers + dividers
  secHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 22,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  secTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 17,
    color: colors.ivory,
    letterSpacing: -0.2,
  },
  secSub: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: 'rgba(245,240,225,0.45)',
    marginTop: 2,
  },
  secMore: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.gold,
  },
  divider: {
    height: 0.5,
    backgroundColor: 'rgba(200,169,81,0.07)',
    marginTop: 20,
    marginHorizontal: 16,
  },

  // Ticker
  tickerContainer: {
    backgroundColor: 'rgba(13,13,26,0.97)',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(200,169,81,0.10)',
    paddingVertical: 12,
    overflow: 'hidden',
  },
  tickerStrip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tickerSet: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 17,
    gap: 34,
  },
  tickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tickerCol: {
    gap: 1,
  },
  tickerTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.ivory,
    maxWidth: 150,
  },
  tickerScoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  tickerScore: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.gold,
  },
  tickerDelta: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
  },

  // Hero
  hero: {
    marginTop: 14,
    marginHorizontal: 16,
    marginBottom: 4,
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.18)',
    overflow: 'hidden',
  },
  heroEyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingTop: 14,
    paddingHorizontal: 16,
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.teal,
    shadowColor: colors.teal,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  heroAngle: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.gold,
    textTransform: 'uppercase',
  },
  heroDay: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: 'rgba(245,240,225,0.4)',
    marginLeft: 'auto',
    letterSpacing: 0.4,
  },
  heroBody: {
    flexDirection: 'row',
    gap: 14,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  heroPoster: {
    width: 78,
    height: 116,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.15)',
    backgroundColor: '#1a1a2e',
    overflow: 'hidden',
  },
  heroPosterImage: {
    width: '100%',
    height: '100%',
  },
  heroMeta: {
    flex: 1,
    paddingTop: 4,
  },
  heroTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 19,
    lineHeight: 22,
    color: colors.ivory,
    marginBottom: 4,
  },
  heroYear: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(245,240,225,0.5)',
    marginBottom: 10,
  },
  heroScoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  heroScore: {
    fontFamily: fonts.bodyBold,
    fontSize: 30,
    lineHeight: 30,
    color: colors.gold,
  },
  heroScoreLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: 'rgba(245,240,225,0.45)',
  },
  heroGraph: {
    paddingTop: 14,
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  heroAxisRow: {
    flexDirection: 'row',
    paddingTop: 2,
  },
  heroAxisLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 9,
    color: 'rgba(245,240,225,0.25)',
  },
  heroWhy: {
    paddingTop: 4,
    paddingHorizontal: 16,
    paddingBottom: 16,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(245,240,225,0.6)',
  },
  heroWhyBold: {
    fontFamily: fonts.bodySemiBold,
    color: colors.ivory,
  },

  // Poster cards
  posterRow: {
    gap: 11,
    paddingHorizontal: 16,
  },
  posterCard: {
    width: POSTER_WIDTH,
  },
  posterArt: {
    height: POSTER_ART_HEIGHT,
    borderRadius: 11,
    borderWidth: 0.5,
    borderColor: colors.cardBorder,
    backgroundColor: '#1a1a2e',
    overflow: 'hidden',
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  posterPlaceholder: {
    flex: 1,
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
  posterTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 15,
    color: colors.ivory,
    marginTop: 7,
  },
  posterScore: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.gold,
    marginTop: 2,
  },

  // Ticket stub
  ticketStub: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    backgroundColor: 'rgba(13,13,26,0.7)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.25)',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // IN THEATRES tag
  theatresTag: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(13,13,26,0.78)',
    borderRadius: 5,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  theatresTagText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 9,
    color: colors.teal,
    letterSpacing: 0.3,
  },
});
