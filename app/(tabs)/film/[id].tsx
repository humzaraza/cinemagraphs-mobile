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
  Dimensions,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Line,
  Polyline,
  Text as SvgText,
  Path,
} from 'react-native-svg';
import { colors, fonts, spacing, borderRadius } from '../../../src/constants/theme';
import { fetchFilmDetail, fetchSimilarFilms, fetchUserLists, fetchAllFilms, fetchUserWatchlist, addToWatchlist, removeFromWatchlist, addFilmToListAPI, createUserList } from '../../../src/lib/api';
// lists.ts local helpers no longer needed - using API directly
import BottomSheet from '../../../src/components/BottomSheet';
import { useAuthGate } from '../../../src/components/AuthGate';
import { addRecentlyViewed } from '../../../src/lib/recentlyViewed';
import type { Film, FilmDetail, FilmReview, FilmDataPoint } from '../../../src/types/film';

const SCREEN_WIDTH = Dimensions.get('window').width;
const TMDB_POSTER = 'https://image.tmdb.org/t/p/w185';
const TMDB_BACKDROP = 'https://image.tmdb.org/t/p/w780';
const BACKDROP_HEIGHT = 160;
const CONTENT_PADDING = 14;

// Graph layout constants
const GRAPH_PAD_LEFT = 22;
const GRAPH_PAD_RIGHT = 4;
const GRAPH_PAD_TOP = 4;
const GRAPH_PAD_BOTTOM = 16;
const GRAPH_HEIGHT = 100;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function formatTimestamp(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getPosterUri(film: { posterUrl?: string | null; posterPath?: string | null }): string | null {
  const path = film.posterUrl || film.posterPath;
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${TMDB_POSTER}${path}`;
}

function getBackdropUri(backdropPath: string | null | undefined): string | null {
  if (!backdropPath) return null;
  if (backdropPath.startsWith('http')) return backdropPath;
  return `${TMDB_BACKDROP}${backdropPath}`;
}

// ---------------------------------------------------------------------------
// Skeleton placeholder (same pulse pattern as Explore tab)
// ---------------------------------------------------------------------------

function SkeletonBox({ width, height, style }: { width: number | string; height: number; style?: object }) {
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
        {
          width,
          height,
          backgroundColor: 'rgba(245,240,225,0.06)',
          borderRadius: borderRadius.md,
          opacity,
        },
        style,
      ]}
    />
  );
}

function DetailSkeleton() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SkeletonBox width={SCREEN_WIDTH} height={BACKDROP_HEIGHT} style={{ borderRadius: 0 }} />
      <View style={{ padding: CONTENT_PADDING, marginTop: -36 }}>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
          <SkeletonBox width={70} height={105} />
          <View style={{ flex: 1, paddingTop: 36, gap: 6 }}>
            <SkeletonBox width={160} height={18} />
            <SkeletonBox width={120} height={11} />
            <SkeletonBox width={100} height={11} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
          <SkeletonBox width={'48%' as any} height={40} />
          <SkeletonBox width={'48%' as any} height={40} />
        </View>
        <SkeletonBox width={'100%' as any} height={160} style={{ marginBottom: 14 }} />
        <SkeletonBox width={'100%' as any} height={60} style={{ marginBottom: 14 }} />
        <SkeletonBox width={'100%' as any} height={80} style={{ marginBottom: 14 }} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Backdrop with gradient, back button, watched badge
// ---------------------------------------------------------------------------

function Backdrop({ film, onAddToList, inWatchlist, onToggleWatchlist }: { film: FilmDetail; onAddToList?: () => void; inWatchlist: boolean; onToggleWatchlist?: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const backdropUri = getBackdropUri(film.backdropUrl);

  return (
    <View style={styles.backdrop}>
      {backdropUri ? (
        <Image source={{ uri: backdropUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(30,30,60,0.8)' }]} />
      )}
      <LinearGradient
        colors={['rgba(13,13,26,0)', '#0D0D1A']}
        locations={[0.4, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Back chevron */}
      <Pressable
        onPress={() => router.back()}
        style={[styles.backButton, { top: insets.top + 18 }]}
      >
        <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
          <Path d="M15 18l-6-6 6-6" stroke={colors.ivory} strokeWidth={2} />
        </Svg>
      </Pressable>

      {/* Watched badge + add-to-list button */}
      <View style={styles.badgeRow}>
        {/* TODO: unhide ticket stub when watched feature is ready */}
        {false && (
        <View style={styles.watchedBadge}>
          <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
            <Path
              d="M2 6a2 2 0 012-2h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"
              stroke={colors.gold}
              strokeWidth={1.5}
            />
            <Line x1={2} y1={8} x2={22} y2={8} stroke={colors.gold} strokeWidth={1.5} />
          </Svg>
          <Text style={styles.watchedText}>Watched</Text>
        </View>
        )}
        <Pressable
          onPress={() => onToggleWatchlist?.()}
          style={styles.addToListBtn}
        >
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path
              d="M5 3a2 2 0 00-2 2v16l9-4 9 4V5a2 2 0 00-2-2H5z"
              stroke={colors.gold}
              strokeWidth={1.8}
              fill={inWatchlist ? colors.gold : 'none'}
            />
          </Svg>
        </Pressable>
        <Pressable
          onPress={() => onAddToList?.()}
          style={styles.addToListBtn}
        >
          <Text style={styles.addToListPlus}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Poster + metadata
// ---------------------------------------------------------------------------

function MetadataRow({ film }: { film: FilmDetail }) {
  const posterUri = getPosterUri(film);

  return (
    <View style={styles.metadataRow}>
      {posterUri ? (
        <Image source={{ uri: posterUri }} style={styles.metadataPoster} resizeMode="cover" />
      ) : (
        <View style={[styles.metadataPoster, { backgroundColor: 'rgba(30,30,60,0.8)' }]} />
      )}
      <View style={styles.metadataText}>
        <Text style={styles.filmTitle}>{film.title}</Text>
        <Text style={styles.filmMeta}>
          {film.year} {'\u00B7'} {formatRuntime(film.runtime)} {'\u00B7'} {film.genres.join(', ')}
        </Text>
        <Text style={styles.filmDirector}>Dir. {film.director}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// CTA buttons
// ---------------------------------------------------------------------------

function CTAButtons({ filmId }: { filmId: string }) {
  const router = useRouter();

  return (
    <View style={styles.ctaRow}>
      <Pressable
        onPress={() => router.push({ pathname: '/(tabs)/review', params: { filmId } } as any)}
        style={styles.ctaPrimary}
      >
        <Text style={styles.ctaPrimaryText}>Write review</Text>
      </Pressable>
      {/* TODO: Unhide when live reactions are ready */}
      {false && (
      <Pressable
        onPress={() => router.push({ pathname: '/live-react', params: { filmId } } as any)}
        style={styles.ctaSecondary}
      >
        <Text style={styles.ctaSecondaryText}>Live react</Text>
      </Pressable>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sentiment arc graph
// ---------------------------------------------------------------------------

function SentimentArc({ film }: { film: FilmDetail }) {
  const router = useRouter();
  const sg = film.sentimentGraph;
  if (!sg?.dataPoints?.length) return null;

  const graphWidth = SCREEN_WIDTH - CONTENT_PADDING * 2 - 20; // 20 = card padding
  const plotW = graphWidth - GRAPH_PAD_LEFT - GRAPH_PAD_RIGHT;
  const plotH = GRAPH_HEIGHT - GRAPH_PAD_TOP - GRAPH_PAD_BOTTOM;
  const n = sg.dataPoints.length;

  // Y-axis anchoring: floor = lowest whole number - 1 (min 0), ceiling = 10
  const allScores = sg.dataPoints.map((dp) => dp.score);
  const yFloor = Math.max(0, Math.floor(Math.min(...allScores)) - 1);
  const yRange = 10 - yFloor || 1;
  const midY = GRAPH_PAD_TOP + (1 - (5 - yFloor) / yRange) * plotH;

  function toPoint(index: number, score: number): string {
    const clamped = Math.max(yFloor, Math.min(10, score));
    const x = GRAPH_PAD_LEFT + (index / Math.max(1, n - 1)) * plotW;
    const y = GRAPH_PAD_TOP + (1 - (clamped - yFloor) / yRange) * plotH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }

  // Single polyline from dataPoints
  const points = sg.dataPoints
    .map((dp, i) => toPoint(i, dp.score))
    .join(' ');

  // X-axis timestamps
  const runtime = film.runtime;
  const midTime = formatTimestamp(Math.floor(runtime / 2));
  const endTime = formatTimestamp(runtime);

  return (
    <View style={{ marginBottom: 14 }}>
      {/* Header */}
      <View style={styles.sentimentHeader}>
        <Text style={styles.sentimentLabel}>Sentiment arc</Text>
        <Text style={styles.sentimentScore}>
          {sg.overallSentiment?.toFixed(1) ?? sg.overallScore?.toFixed(1) ?? '--'}
        </Text>
      </View>

      {/* Graph card */}
      <Pressable
        onPress={() => router.push(`/graph/${film.id}` as any)}
        style={styles.graphCard}
      >
        {/* SVG Graph */}
        <Svg width={graphWidth} height={GRAPH_HEIGHT}>
          {/* 1. Y-axis line */}
          <Line
            x1={GRAPH_PAD_LEFT}
            y1={GRAPH_PAD_TOP}
            x2={GRAPH_PAD_LEFT}
            y2={GRAPH_PAD_TOP + plotH}
            stroke="rgba(245,240,225,0.15)"
            strokeWidth={0.5}
          />

          {/* 2. Y-axis labels */}
          <SvgText
            x={GRAPH_PAD_LEFT - 4}
            y={GRAPH_PAD_TOP + 4}
            textAnchor="end"
            fontSize={9}
            fill="rgba(245,240,225,0.25)"
          >
            10
          </SvgText>
          {5 > yFloor && (
          <SvgText
            x={GRAPH_PAD_LEFT - 4}
            y={midY + 3}
            textAnchor="end"
            fontSize={9}
            fill="rgba(245,240,225,0.25)"
          >
            5
          </SvgText>
          )}
          <SvgText
            x={GRAPH_PAD_LEFT - 4}
            y={GRAPH_PAD_TOP + plotH}
            textAnchor="end"
            fontSize={9}
            fill="rgba(245,240,225,0.25)"
          >
            {yFloor}
          </SvgText>

          {/* 3. X-axis line */}
          <Line
            x1={GRAPH_PAD_LEFT}
            y1={GRAPH_PAD_TOP + plotH}
            x2={GRAPH_PAD_LEFT + plotW}
            y2={GRAPH_PAD_TOP + plotH}
            stroke="rgba(245,240,225,0.15)"
            strokeWidth={0.5}
          />

          {/* 4. X-axis timestamps */}
          <SvgText
            x={GRAPH_PAD_LEFT}
            y={GRAPH_HEIGHT - 2}
            textAnchor="start"
            fontSize={7}
            fill="rgba(245,240,225,0.15)"
          >
            0m
          </SvgText>
          <SvgText
            x={GRAPH_PAD_LEFT + plotW / 2}
            y={GRAPH_HEIGHT - 2}
            textAnchor="middle"
            fontSize={7}
            fill="rgba(245,240,225,0.15)"
          >
            {midTime}
          </SvgText>
          <SvgText
            x={GRAPH_PAD_LEFT + plotW}
            y={GRAPH_HEIGHT - 2}
            textAnchor="end"
            fontSize={7}
            fill="rgba(245,240,225,0.15)"
          >
            {endTime}
          </SvgText>

          {/* 5. Dashed midline at score 5 */}
          <Line
            x1={GRAPH_PAD_LEFT}
            y1={midY}
            x2={GRAPH_PAD_LEFT + plotW}
            y2={midY}
            stroke="rgba(245,240,225,0.12)"
            strokeWidth={0.5}
            strokeDasharray="3,3"
          />

          {/* Sentiment polyline (gold) */}
          <Polyline
            points={points}
            fill="none"
            stroke={colors.gold}
            strokeWidth={1.5}
          />
        </Svg>

        {/* Expand icon bottom-right */}
        <View style={styles.expandRow}>
          <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
            <Path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="rgba(200,169,81,0.4)" strokeWidth={2} />
          </Svg>
          <Text style={styles.expandText}>Expand</Text>
        </View>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Story beat pills
// ---------------------------------------------------------------------------

function StoryBeatPills({ film }: { film: FilmDetail }) {
  const sg = film.sentimentGraph;
  if (!sg?.dataPoints?.length) return null;

  const peakLabel = sg.peakMoment?.label;
  const lowLabel = sg.lowestMoment?.label;

  function pillStyle(dp: FilmDataPoint) {
    if (dp.label === peakLabel) {
      return {
        bg: 'rgba(45,212,168,0.1)',
        border: 'rgba(45,212,168,0.2)',
        text: colors.teal,
      };
    }
    if (dp.label === lowLabel) {
      return {
        bg: 'rgba(226,75,74,0.1)',
        border: 'rgba(226,75,74,0.2)',
        text: colors.negativeRed,
      };
    }
    return {
      bg: 'rgba(200,169,81,0.1)',
      border: 'rgba(200,169,81,0.2)',
      text: colors.gold,
    };
  }

  return (
    <FlatList
      data={sg.dataPoints}
      keyExtractor={(item, i) => `${item.label}-${i}`}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 4, marginBottom: 14 }}
      renderItem={({ item }) => {
        const s = pillStyle(item);
        return (
          <View
            style={{
              backgroundColor: s.bg,
              borderWidth: 0.5,
              borderColor: s.border,
              borderRadius: 12,
              paddingVertical: 3,
              paddingHorizontal: 8,
            }}
          >
            <Text style={{ fontSize: 9, color: s.text, fontFamily: fonts.body }}>
              {item.label} {'\u00B7'} {formatTimestamp(item.timeMidpoint)}
            </Text>
          </View>
        );
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Peak / Low cards
// ---------------------------------------------------------------------------

function PeakLowCards({ film }: { film: FilmDetail }) {
  const sg = film.sentimentGraph;
  if (!sg?.peakMoment || !sg?.lowestMoment) return null;

  const peak = sg.peakMoment;
  const low = sg.lowestMoment;

  return (
    <View style={styles.peakLowRow}>
      <View style={styles.peakCard}>
        <Text style={styles.peakLabel}>Peak moment</Text>
        <Text style={styles.peakTitle}>{peak.label}</Text>
        <Text style={styles.peakMeta}>
          {formatTimestamp(peak.time)} {'\u00B7'} {peak.score}/10
        </Text>
      </View>
      <View style={styles.lowCard}>
        <Text style={styles.lowLabel}>Lowest point</Text>
        <Text style={styles.lowTitle}>{low.label}</Text>
        <Text style={styles.lowMeta}>
          {formatTimestamp(low.time)} {'\u00B7'} {low.score}/10
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// AI Summary
// ---------------------------------------------------------------------------

function AISummary({ summary }: { summary: string }) {
  if (!summary) return null;

  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>SUMMARY</Text>
      <Text style={styles.summaryText}>{summary}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// User reviews
// ---------------------------------------------------------------------------

function ReviewCard({ review }: { review: FilmReview }) {
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewAvatar}>
          <Text style={styles.reviewAvatarText}>{getInitials(review.user.name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.reviewUsername}>{review.user.name}</Text>
          <Text style={styles.reviewTime}>{timeAgo(review.createdAt)}</Text>
        </View>
        <Text style={styles.reviewScore}>{review.score.toFixed(1)}</Text>
      </View>
      <Text style={styles.reviewContent} numberOfLines={3}>
        {review.content}
      </Text>
    </View>
  );
}

function UserReviews({ reviews }: { reviews: FilmReview[] }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={styles.reviewsHeader}>
        <Text style={styles.reviewsTitle}>User reviews</Text>
        <Text style={styles.reviewsSeeAll}>See all</Text>
      </View>
      {reviews && reviews.length > 0 ? (
        <View style={{ gap: 6 }}>
          {reviews.slice(0, 2).map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </View>
      ) : (
        <Text style={styles.noReviews}>No reviews yet</Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Similar films
// ---------------------------------------------------------------------------

function SimilarFilmCard({ film: f }: { film: Film }) {
  const router = useRouter();
  const posterUri = getPosterUri(f);

  return (
    <Pressable onPress={() => router.push(`/film/${f.id}` as any)} style={styles.similarCard}>
      {posterUri ? (
        <Image source={{ uri: posterUri }} style={styles.similarPoster} resizeMode="cover" />
      ) : (
        <View style={[styles.similarPoster, { backgroundColor: 'rgba(30,30,60,0.6)' }]} />
      )}
      <Text style={styles.similarTitle} numberOfLines={1}>
        {f.title}
      </Text>
      <Text style={styles.similarScore}>
        {f.sentimentGraph?.overallScore?.toFixed(1) ?? '--'}
      </Text>
    </Pressable>
  );
}

function SimilarFilms({ filmId, genre }: { filmId: string; genre: string }) {
  const [films, setFilms] = useState<Film[]>([]);

  useEffect(() => {
    fetchSimilarFilms(filmId, genre).then(setFilms).catch(() => {});
  }, [filmId, genre]);

  if (films.length === 0) return null;

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.similarHeading}>Similar films</Text>
      <FlatList
        data={films}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6 }}
        renderItem={({ item }) => <SimilarFilmCard film={item} />}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function FilmDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [film, setFilm] = useState<FilmDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [lists, setLists] = useState<any[]>([]);
  const [showListSheet, setShowListSheet] = useState(false);
  const { gate: authGate, sheet: authSheet } = useAuthGate();

  // Create-list-from-detail state
  const [showCreateFlow, setShowCreateFlow] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListGenre, setNewListGenre] = useState('Drama');
  const [newListFilmIds, setNewListFilmIds] = useState<string[]>([]);
  const [showFilmPicker, setShowFilmPicker] = useState(false);
  const [filmSearchInput, setFilmSearchInput] = useState('');
  const [filmSearch, setFilmSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pickerFilms, setPickerFilms] = useState<Film[]>([]);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(false);
    fetchFilmDetail(id)
      .then((data) => {
        if (data) {
          setFilm(data);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
    if (id) addRecentlyViewed(id);
    fetchUserLists().then(setLists).catch(() => {});
    fetchUserWatchlist()
      .then((films) => setInWatchlist(films.some((f: any) => f.id === id)))
      .catch(() => {});
    fetchAllFilms().then((films) => {
      const unique = films.filter(
        (f, i, arr) => arr.findIndex((x) => x.id === f.id) === i,
      );
      setPickerFilms(unique);
    });
  }, [load]);

  const GENRE_TAGS = ['Drama', 'Action', 'Horror', 'Sci-Fi', 'Comedy', 'Thriller'];

  const filteredPickerFilms = pickerFilms.filter((f) =>
    f.title.toLowerCase().includes(filmSearch.toLowerCase()),
  );

  const handlePickerSearchChange = (text: string) => {
    setFilmSearchInput(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setFilmSearch(text), 400);
  };

  const toggleFilmInNewList = (filmId: string) => {
    setNewListFilmIds((prev) =>
      prev.includes(filmId) ? prev.filter((fid) => fid !== filmId) : [...prev, filmId],
    );
  };

  const handleToggleWatchlist = async () => {
    if (!id) return;
    try {
      if (inWatchlist) {
        await removeFromWatchlist(id);
        setInWatchlist(false);
      } else {
        await addToWatchlist(id);
        setInWatchlist(true);
      }
    } catch (e) {
      console.error('[Watchlist] toggle error:', e);
    }
  };

  const openCreateFlow = () => {
    setShowListSheet(false);
    setNewListName('');
    setNewListGenre('Drama');
    setNewListFilmIds(id ? [id] : []);
    setShowCreateFlow(true);
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    try {
      const apiList = await createUserList(newListName.trim(), newListGenre, newListFilmIds);
      setLists((prev) => [apiList, ...prev]);
      setShowCreateFlow(false);
      setNewListName('');
      setNewListGenre('Drama');
      setNewListFilmIds([]);
      setFilmSearchInput('');
      setFilmSearch('');
    } catch (e) {
      console.error('[CreateList] API error:', e);
    }
  };

  if (loading) return <DetailSkeleton />;

  if (error || !film) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Could not load film details</Text>
        <Pressable onPress={load} style={styles.retryButton}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      >
        <Backdrop film={film} onAddToList={() => authGate(() => setShowListSheet(true))} inWatchlist={inWatchlist} onToggleWatchlist={() => authGate(handleToggleWatchlist)} />

        <View style={styles.content}>
          <MetadataRow film={film} />
          <CTAButtons filmId={film.id} />
          <SentimentArc film={film} />
          <StoryBeatPills film={film} />
          <PeakLowCards film={film} />
          <AISummary summary={film.sentimentGraph?.summary} />
          <UserReviews reviews={film.reviews} />
          <SimilarFilms
            filmId={film.id}
            genre={film.genres?.[0] ?? ''}
          />
        </View>
      </ScrollView>

      {/* Add to List bottom sheet */}
      <BottomSheet
        visible={showListSheet}
        onClose={() => setShowListSheet(false)}
        title="Add to list"
      >
        {lists.map((list) => {
          const listFilmIds = list.filmIds ?? (list.films ?? []).map((f: any) => f.id ?? f.filmId);
          const already = listFilmIds.some((fid: string) => fid === id);
          const filmCount = list.filmCount ?? listFilmIds.length;
          return (
            <Pressable
              key={list.id}
              onPress={async () => {
                if (!already && id) {
                  try {
                    await addFilmToListAPI(list.id, id);
                    const updated = await fetchUserLists();
                    setLists(updated);
                  } catch (e) {
                    console.error('[AddToList] API error:', e);
                  }
                  setShowListSheet(false);
                }
              }}
              style={styles.listSheetRow}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.listSheetName}>{list.name}</Text>
                <Text style={styles.listSheetMeta}>
                  {list.genreTag} {'\u00B7'} {filmCount} film{filmCount !== 1 ? 's' : ''}
                </Text>
              </View>
              {already && (
                <Text style={styles.listSheetAdded}>{'\u2713'} Added</Text>
              )}
            </Pressable>
          );
        })}
        {/* Create new list row */}
        <Pressable onPress={openCreateFlow} style={styles.createNewRow}>
          <Text style={styles.createNewPlus}>+</Text>
          <Text style={styles.createNewText}>Create new list</Text>
        </Pressable>
      </BottomSheet>

      {/* Create List bottom sheet */}
      <BottomSheet
        visible={showCreateFlow && !showFilmPicker}
        onClose={() => setShowCreateFlow(false)}
        title="New list"
      >
        <Text style={styles.sheetLabel}>NAME</Text>
        <View style={styles.sheetInput}>
          <TextInput
            value={newListName}
            onChangeText={setNewListName}
            placeholder="Best of 2024"
            placeholderTextColor="rgba(245,240,225,0.2)"
            style={styles.sheetTextInput}
            maxLength={40}
          />
        </View>

        <Text style={[styles.sheetLabel, { marginTop: 14 }]}>GENRE TAG</Text>
        <View style={styles.genreTagRow}>
          {GENRE_TAGS.map((g) => (
            <Pressable
              key={g}
              onPress={() => setNewListGenre(g)}
              style={[
                styles.genreTag,
                newListGenre === g && styles.genreTagActive,
              ]}
            >
              <Text
                style={[
                  styles.genreTagText,
                  newListGenre === g && styles.genreTagTextActive,
                ]}
              >
                {g}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sheetLabel, { marginTop: 14 }]}>ADD FILMS</Text>
        <View style={styles.filmChipRow}>
          {newListFilmIds.map((fid) => {
            const f = pickerFilms.find((x) => x.id === fid);
            if (!f) return null;
            return (
              <Pressable key={fid} onPress={() => toggleFilmInNewList(fid)}>
                <Image
                  source={{ uri: getPosterUri(f) ?? undefined }}
                  style={styles.filmChipPoster}
                  resizeMode="cover"
                />
              </Pressable>
            );
          })}
          <Pressable
            style={styles.filmChipAdd}
            onPress={() => setShowFilmPicker(true)}
          >
            <Text style={styles.filmChipPlus}>+</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={handleCreateList}
          style={[
            styles.sheetCreateBtn,
            !newListName.trim() && { opacity: 0.4 },
          ]}
          disabled={!newListName.trim()}
        >
          <Text style={styles.sheetCreateText}>Create list</Text>
        </Pressable>
      </BottomSheet>

      {/* Film Picker bottom sheet */}
      <BottomSheet
        visible={showFilmPicker}
        onClose={() => { setShowFilmPicker(false); setFilmSearchInput(''); setFilmSearch(''); }}
        title="Add films"
      >
        <View
          style={[
            styles.pickerSearchBar,
            searchFocused && styles.pickerSearchBarFocused,
          ]}
        >
          <TextInput
            value={filmSearchInput}
            onChangeText={handlePickerSearchChange}
            placeholder="Search films..."
            placeholderTextColor="rgba(245,240,225,0.2)"
            style={styles.sheetTextInput}
            autoFocus
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
        </View>
        <ScrollView style={{ maxHeight: 320, marginTop: 10 }}>
          {filteredPickerFilms.map((f) => {
            const selected = newListFilmIds.includes(f.id);
            return (
              <Pressable
                key={f.id}
                onPress={() => toggleFilmInNewList(f.id)}
                style={styles.pickerRow}
              >
                <Image
                  source={{ uri: getPosterUri(f) ?? undefined }}
                  style={styles.pickerPoster}
                  resizeMode="cover"
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickerTitle} numberOfLines={1}>
                    {f.title}
                  </Text>
                  <Text style={styles.pickerYear}>{f.year}</Text>
                </View>
                <View
                  style={[
                    styles.pickerCheck,
                    selected && styles.pickerCheckActive,
                  ]}
                >
                  {selected && <Text style={styles.pickerCheckMark}>{'\u2713'}</Text>}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable
          onPress={() => { setShowFilmPicker(false); setFilmSearchInput(''); setFilmSearch(''); }}
          style={styles.sheetCreateBtn}
        >
          <Text style={styles.sheetCreateText}>
            Done ({newListFilmIds.length} selected)
          </Text>
        </Pressable>
      </BottomSheet>

      {authSheet}
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
  content: {
    padding: CONTENT_PADDING,
    marginTop: -36,
    position: 'relative',
    zIndex: 2,
  },

  // Backdrop
  backdrop: {
    width: SCREEN_WIDTH,
    height: BACKDROP_HEIGHT,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 10,
    zIndex: 3,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeRow: {
    position: 'absolute',
    bottom: 12,
    right: 14,
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  watchedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(200,169,81,0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.3)',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  watchedText: {
    fontSize: 10,
    color: colors.gold,
    fontFamily: fonts.bodyMedium,
  },

  // Metadata
  metadataRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  metadataPoster: {
    width: 70,
    height: 105,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.15)',
  },
  metadataText: {
    flex: 1,
    paddingTop: 36,
  },
  filmTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.ivory,
    marginBottom: 3,
    lineHeight: 22,
  },
  filmMeta: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: 'rgba(245,240,225,0.4)',
    marginBottom: 4,
  },
  filmDirector: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: 'rgba(245,240,225,0.35)',
  },

  // CTA buttons
  ctaRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  ctaPrimary: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: colors.gold,
    borderRadius: 8,
    alignItems: 'center',
  },
  ctaPrimaryText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.background,
  },
  ctaSecondary: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(200,169,81,0.3)',
    borderRadius: 8,
    alignItems: 'center',
  },
  ctaSecondaryText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.gold,
  },

  // Sentiment arc
  sentimentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sentimentLabel: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.ivory,
  },
  sentimentScore: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.gold,
  },
  graphCard: {
    backgroundColor: 'rgba(245,240,225,0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.10)',
    borderRadius: 10,
    padding: 10,
  },
  expandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  expandText: {
    fontSize: 9,
    color: 'rgba(200,169,81,0.4)',
    fontFamily: fonts.body,
  },

  // Peak / Low
  peakLowRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  peakCard: {
    flex: 1,
    backgroundColor: 'rgba(45,212,168,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(45,212,168,0.2)',
    borderRadius: 8,
    padding: 10,
  },
  peakLabel: {
    fontSize: 9,
    color: colors.teal,
    fontFamily: fonts.bodyMedium,
    marginBottom: 2,
  },
  peakTitle: {
    fontSize: 12,
    color: colors.ivory,
    fontFamily: fonts.bodyMedium,
    marginBottom: 1,
  },
  peakMeta: {
    fontSize: 9,
    color: 'rgba(245,240,225,0.4)',
    fontFamily: fonts.body,
  },
  lowCard: {
    flex: 1,
    backgroundColor: 'rgba(226,75,74,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(226,75,74,0.2)',
    borderRadius: 8,
    padding: 10,
  },
  lowLabel: {
    fontSize: 9,
    color: colors.negativeRed,
    fontFamily: fonts.bodyMedium,
    marginBottom: 2,
  },
  lowTitle: {
    fontSize: 12,
    color: colors.ivory,
    fontFamily: fonts.bodyMedium,
    marginBottom: 1,
  },
  lowMeta: {
    fontSize: 9,
    color: 'rgba(245,240,225,0.4)',
    fontFamily: fonts.body,
  },

  // Summary
  summaryCard: {
    backgroundColor: 'rgba(245,240,225,0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.08)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  summaryLabel: {
    fontSize: 9,
    color: 'rgba(245,240,225,0.35)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontFamily: fonts.body,
    marginBottom: 6,
  },
  summaryText: {
    fontSize: 11,
    color: 'rgba(245,240,225,0.5)',
    fontFamily: fonts.body,
    lineHeight: 16.5,
  },

  // Reviews
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewsTitle: {
    fontFamily: fonts.heading,
    fontSize: 13,
    color: colors.ivory,
  },
  reviewsSeeAll: {
    fontSize: 11,
    color: colors.gold,
    fontFamily: fonts.body,
  },
  reviewCard: {
    backgroundColor: 'rgba(245,240,225,0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.08)',
    borderRadius: 8,
    padding: 10,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  reviewAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(200,169,81,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: {
    fontSize: 10,
    color: colors.gold,
    fontFamily: fonts.bodyMedium,
  },
  reviewUsername: {
    fontSize: 11,
    color: colors.ivory,
    fontFamily: fonts.bodyMedium,
  },
  reviewTime: {
    fontSize: 9,
    color: 'rgba(245,240,225,0.3)',
    fontFamily: fonts.body,
  },
  reviewScore: {
    fontSize: 13,
    color: colors.gold,
    fontFamily: fonts.bodyMedium,
  },
  reviewContent: {
    fontSize: 11,
    color: 'rgba(245,240,225,0.5)',
    fontFamily: fonts.body,
    lineHeight: 15.4,
  },
  noReviews: {
    fontSize: 11,
    color: 'rgba(245,240,225,0.3)',
    fontFamily: fonts.body,
  },

  // Similar films
  similarHeading: {
    fontFamily: fonts.heading,
    fontSize: 13,
    color: colors.ivory,
    marginBottom: 8,
  },
  similarCard: {
    width: 70,
  },
  similarPoster: {
    width: 70,
    height: 105,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.1)',
    marginBottom: 4,
  },
  similarTitle: {
    fontSize: 10,
    color: colors.ivory,
    fontFamily: fonts.body,
  },
  similarScore: {
    fontSize: 9,
    color: colors.gold,
    fontFamily: fonts.body,
  },

  // Error state
  errorContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 14,
    color: 'rgba(245,240,225,0.5)',
    fontFamily: fonts.body,
    marginBottom: 12,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(200,169,81,0.3)',
    borderRadius: 8,
  },
  retryText: {
    fontSize: 13,
    color: colors.gold,
    fontFamily: fonts.bodyMedium,
  },

  // ---- Add to list button ----
  addToListBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(200,169,81,0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addToListPlus: {
    fontSize: 14,
    color: colors.gold,
    fontFamily: fonts.bodyMedium,
    marginTop: -1,
  },

  // ---- List sheet ----
  listSheetEmpty: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(245,240,225,0.4)',
    textAlign: 'center',
    paddingVertical: 20,
  },
  listSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(245,240,225,0.04)',
  },
  listSheetName: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ivory,
  },
  listSheetMeta: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: 'rgba(245,240,225,0.35)',
    marginTop: 1,
  },
  listSheetAdded: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.gold,
  },

  // ---- Create new list row ----
  createNewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    marginTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(200,169,81,0.12)',
  },
  createNewPlus: {
    fontSize: 16,
    color: colors.gold,
    fontFamily: fonts.bodyMedium,
  },
  createNewText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.gold,
  },

  // ---- Create list form ----
  sheetLabel: {
    fontSize: 10,
    color: 'rgba(245,240,225,0.5)',
    textTransform: 'uppercase',
    fontFamily: fonts.body,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  sheetInput: {
    backgroundColor: 'rgba(245,240,225,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.15)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sheetTextInput: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.ivory,
    padding: 0,
  },
  genreTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  genreTag: {
    backgroundColor: 'rgba(245,240,225,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.12)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  genreTagActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  genreTagText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: 'rgba(245,240,225,0.5)',
  },
  genreTagTextActive: {
    color: colors.background,
  },
  filmChipRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  filmChipPoster: {
    width: 44,
    height: 64,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.1)',
  },
  filmChipAdd: {
    width: 44,
    height: 64,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(200,169,81,0.2)',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filmChipPlus: {
    fontSize: 16,
    color: 'rgba(200,169,81,0.3)',
  },
  sheetCreateBtn: {
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  sheetCreateText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.background,
  },

  // ---- Film picker ----
  pickerSearchBar: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.15)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pickerSearchBarFocused: {
    borderColor: colors.gold,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(245,240,225,0.04)',
  },
  pickerPoster: {
    width: 40,
    height: 60,
    borderRadius: 4,
  },
  pickerTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.ivory,
  },
  pickerYear: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: 'rgba(245,240,225,0.35)',
  },
  pickerCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(200,169,81,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerCheckActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  pickerCheckMark: {
    fontSize: 12,
    color: colors.background,
  },
});
