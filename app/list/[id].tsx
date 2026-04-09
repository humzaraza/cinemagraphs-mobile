import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Line } from 'react-native-svg';
import { colors, fonts, borderRadius } from '../../src/constants/theme';
import Sparkline from '../../src/components/Sparkline';
import ArcCard from '../../src/components/ArcCard';
import { fetchUserLists, fetchUserFilms } from '../../src/lib/api';
import type { MockList, MockFilm } from '../../src/data/mockProfile';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PAD = 16;
const POSTER_GAP = 8;
const POSTER_COLS = 3;
const POSTER_W = (SCREEN_WIDTH - PAD * 2 - POSTER_GAP * (POSTER_COLS - 1)) / POSTER_COLS;
const POSTER_H = POSTER_W * 1.5;
type ViewMode = 'poster' | 'graph';

function GridIcon({ active }: { active: boolean }) {
  const c = active ? colors.gold : 'rgba(255,255,255,0.4)';
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path d="M1 1h6v6H1zM9 1h6v6H9zM1 9h6v6H1zM9 9h6v6H9z" stroke={c} strokeWidth={1.2} />
    </Svg>
  );
}

function ListViewIcon({ active }: { active: boolean }) {
  const c = active ? colors.gold : 'rgba(255,255,255,0.4)';
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Line x1={1} y1={3} x2={15} y2={3} stroke={c} strokeWidth={1.5} />
      <Line x1={1} y1={8} x2={15} y2={8} stroke={c} strokeWidth={1.5} />
      <Line x1={1} y1={13} x2={15} y2={13} stroke={c} strokeWidth={1.5} />
    </Svg>
  );
}

function PosterCell({ film }: { film: MockFilm }) {
  const router = useRouter();
  const [imgError, setImgError] = useState(false);

  return (
    <Pressable
      onPress={() => router.push(`/film/${film.id}` as any)}
      style={styles.posterCell}
    >
      <View style={styles.posterImageContainer}>
        {imgError ? (
          <View style={styles.posterFallback}>
            <Text style={styles.posterFallbackText} numberOfLines={3}>
              {film.title}
            </Text>
          </View>
        ) : (
          <Image
            source={{ uri: film.posterUrl }}
            style={styles.posterImageInner}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        )}
      </View>
      <View style={styles.posterSparkline}>
        <Sparkline
          dataPoints={film.sparklineData.map((s) => ({ score: s }))}
          width={POSTER_W - 4}
          height={16}
          strokeColor={colors.teal}
          strokeWidth={1.2}
        />
      </View>
      <Text style={styles.posterScore}>{film.personalScore.toFixed(1)}</Text>
    </Pressable>
  );
}

export default function ListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [list, setList] = useState<MockList | null>(null);
  const [allFilms, setAllFilms] = useState<MockFilm[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    Promise.all([
      fetchUserLists()
        .then((lists) => {
          const found = lists.find((l) => l.id === id);
          if (!found) console.error('[ListDetail] List not found in API response, id:', id);
          setList(found ?? null);
        })
        .catch((e) => console.error('[ListDetail] fetchUserLists error:', e)),
      fetchUserFilms('reviewed')
        .then(setAllFilms)
        .catch((e) => console.error('[ListDetail] fetchUserFilms error:', e)),
    ]).finally(() => setLoaded(true));
  }, [id]);

  if (!loaded) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.loading}>Loading...</Text>
      </View>
    );
  }

  if (!list) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 12 }}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={colors.gold} strokeWidth={2} />
            </Svg>
          </Pressable>
          <Text style={styles.title}>List not found</Text>
        </View>
      </View>
    );
  }

  const unique = allFilms.filter(
    (f, i, arr) => arr.findIndex((x) => x.id === f.id) === i,
  );
  const listFilms = list.filmIds
    .map((fid) => unique.find((f) => f.id === fid))
    .filter(Boolean) as MockFilm[];

  const cardWidth = SCREEN_WIDTH - PAD * 2;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={colors.gold} strokeWidth={2} />
            </Svg>
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>{list.name}</Text>
          <View style={styles.toggleRow}>
            <Pressable onPress={() => setViewMode('poster')} style={styles.toggleBtn}>
              <GridIcon active={viewMode === 'poster'} />
            </Pressable>
            <Pressable onPress={() => setViewMode('graph')} style={styles.toggleBtn}>
              <ListViewIcon active={viewMode === 'graph'} />
            </Pressable>
          </View>
        </View>

        <Text style={styles.meta}>
          {list.genreTag} {'\u00B7'} {listFilms.length} film{listFilms.length !== 1 ? 's' : ''}
        </Text>

        {viewMode === 'graph' ? (
          <View style={styles.arcList}>
            {listFilms.map((f) => (
              <ArcCard key={f.id} film={f} cardWidth={cardWidth} />
            ))}
          </View>
        ) : (
          <View style={styles.posterGrid}>
            {listFilms.map((f) => (
              <PosterCell key={f.id} film={f} />
            ))}
          </View>
        )}

        {listFilms.length === 0 && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No films in this list yet</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(245,240,225,0.4)',
    textAlign: 'center',
    marginTop: 40,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PAD,
    marginTop: 12,
    marginBottom: 4,
  },
  backBtn: { width: 32, height: 32, justifyContent: 'center' },
  title: {
    flex: 1,
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.ivory,
    marginLeft: 4,
  },
  toggleRow: { flexDirection: 'row', gap: 6 },
  toggleBtn: { padding: 4 },
  meta: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: 'rgba(245,240,225,0.4)',
    paddingHorizontal: PAD,
    marginBottom: 14,
    marginLeft: 36,
  },

  // Arc cards (graph view)
  arcList: { paddingHorizontal: PAD, gap: 10 },

  // Poster grid
  posterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: POSTER_GAP,
    paddingHorizontal: PAD,
  },
  posterCell: {
    width: POSTER_W,
    marginBottom: 4,
  },
  posterImageContainer: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: 5,
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.12)',
    backgroundColor: 'rgba(30,30,60,0.8)',
    overflow: 'hidden',
  },
  posterImageInner: {
    width: '100%',
    height: '100%',
    borderRadius: 5,
  },
  posterFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  posterFallbackText: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: 'rgba(245,240,225,0.3)',
    textAlign: 'center',
  },
  posterSparkline: {
    marginTop: 4,
  },
  posterScore: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.teal,
    textAlign: 'center',
    marginTop: 2,
  },

  // Empty
  emptyWrap: { alignItems: 'center', paddingVertical: 60 },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
  },
});
