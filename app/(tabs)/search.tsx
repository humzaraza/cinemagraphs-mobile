import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Keyboard,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Line } from 'react-native-svg';
import { colors, fonts, borderRadius } from '../../src/constants/theme';
import { fetchAllFilms } from '../../src/lib/api';
import Sparkline from '../../src/components/Sparkline';
import type { Film } from '../../src/types/film';

const TMDB_POSTER = 'https://image.tmdb.org/t/p/w185';

function getPosterUri(film: Film): string | null {
  const path = film.posterUrl || film.posterPath;
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${TMDB_POSTER}${path}`;
}

// ---------------------------------------------------------------------------
// Skeleton
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
        { width, height, backgroundColor: 'rgba(245,240,225,0.06)', borderRadius: borderRadius.md, opacity },
        style,
      ]}
    />
  );
}

function ResultSkeleton() {
  return (
    <View style={{ gap: 10, paddingTop: 8 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonBox key={i} width={'100%' as any} height={114} style={{ borderRadius: 12 }} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Category icons (simple SVG shapes)
// ---------------------------------------------------------------------------

function CategoryIcon({ name }: { name: string }) {
  const stroke = 'rgba(245,240,225,0.5)';
  const sw = 1.5;

  switch (name) {
    case 'Genre':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={9} stroke={stroke} strokeWidth={sw} />
          <Path d="M9 9l6 3-6 3V9z" stroke={stroke} strokeWidth={sw} />
        </Svg>
      );
    case 'Release date':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path d="M4 7a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" stroke={stroke} strokeWidth={sw} />
          <Line x1={4} y1={10} x2={20} y2={10} stroke={stroke} strokeWidth={sw} />
          <Line x1={8} y1={5} x2={8} y2={3} stroke={stroke} strokeWidth={sw} />
          <Line x1={16} y1={5} x2={16} y2={3} stroke={stroke} strokeWidth={sw} />
        </Svg>
      );
    case 'Highest rated':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.27 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z" stroke={stroke} strokeWidth={sw} />
        </Svg>
      );
    case 'Most dramatic arcs':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path d="M3 20L7 10l4 6 4-10 6 14" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        </Svg>
      );
    case 'Streaming service':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path d="M2 6a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" stroke={stroke} strokeWidth={sw} />
          <Line x1={8} y1={20} x2={16} y2={20} stroke={stroke} strokeWidth={sw} />
        </Svg>
      );
    case 'Directors':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={8} r={4} stroke={stroke} strokeWidth={sw} />
          <Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={stroke} strokeWidth={sw} />
        </Svg>
      );
    case 'Recently added':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={9} stroke={stroke} strokeWidth={sw} />
          <Path d="M12 7v5l3 3" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Browse categories
// ---------------------------------------------------------------------------

const CATEGORIES = [
  'Genre',
  'Release date',
  'Highest rated',
  'Most dramatic arcs',
  'Streaming service',
  'Directors',
  'Recently added',
];

function BrowseCategories() {
  return (
    <View>
      <Text style={styles.browseLabel}>BROWSE</Text>
      {CATEGORIES.map((cat, i) => (
        <Pressable
          key={cat}
          onPress={() => console.log('Category:', cat)}
          style={[
            styles.categoryRow,
            i < CATEGORIES.length - 1 && styles.categoryDivider,
          ]}
        >
          <View style={styles.categoryIcon}>
            <CategoryIcon name={cat} />
          </View>
          <Text style={styles.categoryLabel}>{cat}</Text>
          <Text style={styles.chevron}>{'\u203A'}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Search result card
// ---------------------------------------------------------------------------

function ResultCard({ film }: { film: Film }) {
  const router = useRouter();
  const posterUri = getPosterUri(film);
  const score = film.sentimentGraph?.overallScore;
  const dataPoints = film.sentimentGraph?.dataPoints;

  return (
    <Pressable
      onPress={() => router.push(`/film/${film.id}` as any)}
      style={styles.resultCard}
    >
      {posterUri ? (
        <Image source={{ uri: posterUri }} style={styles.resultPoster} resizeMode="cover" />
      ) : (
        <View style={[styles.resultPoster, { backgroundColor: '#1a1a2e' }]} />
      )}
      <View style={styles.resultInfo}>
        <Text style={styles.resultTitle} numberOfLines={2}>{film.title}</Text>
        <Text style={styles.resultMeta} numberOfLines={1}>
          {film.year}{film.genres?.length ? ` \u00B7 ${film.genres.join(', ')}` : ''}
        </Text>
        {score != null && dataPoints && dataPoints.length >= 2 ? (
          <View style={styles.resultScoreRow}>
            <Text style={styles.resultScore}>{score.toFixed(1)}</Text>
            <Sparkline
              dataPoints={dataPoints}
              width={40}
              height={16}
              strokeColor={colors.gold}
              strokeWidth={1}
            />
          </View>
        ) : score != null ? (
          <Text style={styles.resultScore}>{score.toFixed(1)}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

function normalizeTitle(title: string): string {
  return title.replace(/\\"/g, '').replace(/"/g, '').toLowerCase();
}

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [allFilms, setAllFilms] = useState<Film[]>([]);
  const [results, setResults] = useState<Film[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [loadingFilms, setLoadingFilms] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSearching = focused || query.length > 0;

  // Fetch all films once on mount
  useEffect(() => {
    fetchAllFilms()
      .then(setAllFilms)
      .catch(() => {})
      .finally(() => setLoadingFilms(false));
  }, []);

  // Client-side filter
  const doSearch = useCallback(
    (term: string) => {
      if (!term.trim()) {
        setResults([]);
        setHasSearched(false);
        setSearching(false);
        return;
      }
      setSearching(true);
      const lower = term.trim().toLowerCase();
      const matched = allFilms.filter((f) =>
        normalizeTitle(f.title).includes(lower)
      );
      setResults(matched);
      setHasSearched(true);
      setSearching(false);
    },
    [allFilms]
  );

  const onChangeText = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSearch(text), 400);
    },
    [doSearch]
  );

  const onCancel = useCallback(() => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    setSearching(false);
    setFocused(false);
    Keyboard.dismiss();
  }, []);

  const renderResult = useCallback(
    ({ item }: { item: Film }) => <ResultCard film={item} />,
    []
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={[styles.searchBar, focused && styles.searchBarFocused]}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Circle cx={11} cy={11} r={7} stroke="rgba(255,255,255,0.3)" strokeWidth={2} />
            <Path d="M16.5 16.5L21 21" stroke="rgba(255,255,255,0.3)" strokeWidth={2} strokeLinecap="round" />
          </Svg>
          <TextInput
            style={styles.searchInput}
            placeholder="Films, people, members..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={query}
            onChangeText={onChangeText}
            onFocus={() => setFocused(true)}
            onBlur={() => { if (!query) setFocused(false); }}
            returnKeyType="search"
            autoCorrect={false}
          />
        </View>
        {isSearching && (
          <Pressable onPress={onCancel} hitSlop={8}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        )}
      </View>

      {/* Content */}
      {!isSearching ? (
        <FlatList
          data={[]}
          renderItem={null}
          ListHeaderComponent={<BrowseCategories />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      ) : searching ? (
        <View style={styles.listContent}>
          <ResultSkeleton />
        </View>
      ) : hasSearched && results.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No results found</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          renderItem={renderResult}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            hasSearched ? (
              <Text style={styles.resultCount}>{results.length} result{results.length !== 1 ? 's' : ''}</Text>
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 80,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontFamily: fonts.heading,
    fontSize: 22,
    color: colors.ivory,
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(200,169,81,0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.25)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  reviewButtonText: {
    fontSize: 11,
    color: colors.gold,
    fontFamily: fonts.bodyMedium,
  },

  // Search bar
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 20,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchBarFocused: {
    borderColor: colors.gold,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.ivory,
    fontFamily: fonts.body,
    padding: 0,
  },
  cancelText: {
    fontSize: 13,
    color: colors.gold,
    fontFamily: fonts.body,
  },

  // Browse categories
  browseLabel: {
    fontSize: 13,
    color: '#888',
    letterSpacing: 1,
    fontFamily: fonts.body,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  categoryDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A2E',
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1A1A2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ivory,
  },
  chevron: {
    fontSize: 18,
    color: '#555',
  },

  // Results
  resultCount: {
    fontSize: 13,
    color: '#888',
    fontFamily: fonts.body,
    marginBottom: 10,
  },
  resultCard: {
    flexDirection: 'row',
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A3D',
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  resultPoster: {
    width: 60,
    height: 90,
    borderRadius: 6,
  },
  resultInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  resultTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.ivory,
    marginBottom: 4,
  },
  resultMeta: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#888',
    marginBottom: 6,
  },
  resultScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultScore: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.gold,
  },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: 'rgba(245,240,225,0.3)',
  },
});
