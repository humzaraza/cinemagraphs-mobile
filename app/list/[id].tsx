import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  Alert,
  Switch,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Line } from 'react-native-svg';
import { colors, fonts, borderRadius } from '../../src/constants/theme';
import Sparkline from '../../src/components/Sparkline';
import ArcCard from '../../src/components/ArcCard';
import { fetchUserList, fetchPublicList, addFilmToListAPI, deleteUserList, removeFilmFromListAPI, updateListVisibility } from '../../src/lib/api';
import BottomSheet from '../../src/components/BottomSheet';
import FilmPicker from '../../src/components/FilmPicker';
import { useAuth } from '../../src/providers/AuthProvider';
import type { MockFilm } from '../../src/data/mockProfile';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PAD = 16;
const POSTER_GAP = 6;
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

function MenuIcon() {
  const c = 'rgba(255,255,255,0.6)';
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Line x1={3} y1={5} x2={17} y2={5} stroke={c} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={3} y1={10} x2={17} y2={10} stroke={c} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={3} y1={15} x2={17} y2={15} stroke={c} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function PosterCell({ film, onLongPress }: { film: MockFilm; onLongPress?: () => void }) {
  const router = useRouter();
  const [imgError, setImgError] = useState(false);

  return (
    <Pressable
      onPress={() => router.push(`/film/${film.id}` as any)}
      onLongPress={onLongPress}
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
            source={{ uri: (film.posterUrl?.startsWith("/") ? "https://image.tmdb.org/t/p/w185" + film.posterUrl : film.posterUrl) ?? ((film as any).posterPath ? "https://image.tmdb.org/t/p/w185" + (film as any).posterPath : undefined) }}
            style={styles.posterImageInner}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        )}
      </View>
      <View style={styles.posterSparkline}>
        <Sparkline
          dataPoints={((film.sparklineData ?? []).map((s) => ({ score: s })))}
          width={POSTER_W}
          height={48}
          strokeColor={colors.gold}
          strokeWidth={1}
          showAxes
          showMidline
          runtimeMinutes={film.runtime}
          dynamicYAxis
          hideStartLabel
          fixPeakClipping
          yLabelWidth={14}
        />
      </View>
    </Pressable>
  );
}

export default function ListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user: authUser } = useAuth();

  const [list, setList] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('poster');
  const [loaded, setLoaded] = useState(false);

  // Add film picker visibility (FilmPicker manages its own search state).
  const [showAddFilm, setShowAddFilm] = useState(false);

  // Menu state
  const [showMenu, setShowMenu] = useState(false);

  // Track ownership by which endpoint succeeded
  const [isOwnerList, setIsOwnerList] = useState(false);

  const loadList = useCallback(async () => {
    setLoaded(false);
    try {
      // Try the owner endpoint first
      const found = await fetchUserList(id!);
      if (found) {
        setIsOwnerList(true);
        setList(found);
        setLoaded(true);
        return;
      }
    } catch {
      // Owner endpoint failed, try public
    }
    try {
      setIsOwnerList(false);
      const pub = await fetchPublicList(id!);
      setList(pub ?? null);
    } catch {
      setIsOwnerList(false);
      setList(null);
    }
    setLoaded(true);
  }, [id]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const filmIds = list ? (list.filmIds ?? (list.films ?? []).map((f: any) => f.id ?? f.filmId)) : [];

  const handleAddFilm = async (filmId: string) => {
    if (!id) return;
    try {
      await addFilmToListAPI(id, filmId);
      const updated = await fetchUserList(id);
      setList(updated ?? null);
    } catch (e) {
      console.error('[ListDetail] addFilmToListAPI error:', e);
    }
  };

  const handleRemoveFilm = (filmId: string, filmTitle: string) => {
    Alert.alert(
      'Remove from list',
      `Remove "${filmTitle}" from this list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!id) return;
            try {
              await removeFilmFromListAPI(id, filmId);
              const updated = await fetchUserList(id);
              setList(updated ?? null);
            } catch (e) {
              console.error('[ListDetail] removeFilmFromListAPI error:', e);
              Alert.alert('Error', 'Could not remove film. Please try again.');
            }
          },
        },
      ],
    );
  };

  const handleDeleteList = () => {
    setShowMenu(false);
    Alert.alert(
      'Delete list',
      'Are you sure? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!id) return;
            try {
              await deleteUserList(id);
              router.back();
            } catch (e) {
              console.error('[ListDetail] deleteUserList error:', e);
              Alert.alert('Error', 'Could not delete list. Please try again.');
            }
          },
        },
      ],
    );
  };

  const handleToggleVisibility = async (newValue: boolean) => {
    if (!id) return;
    const prev = list.isPublic;
    setList((l: any) => ({ ...l, isPublic: newValue }));
    try {
      await updateListVisibility(id, newValue);
    } catch {
      setList((l: any) => ({ ...l, isPublic: prev }));
    }
  };

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

  const listFilms: MockFilm[] = list.films ?? [];

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
            <Pressable onPress={() => setShowMenu(true)} style={styles.toggleBtn} hitSlop={8}>
              <MenuIcon />
            </Pressable>
          </View>
        </View>

        <Text style={styles.meta}>
          {list.genreTag} {'\u00B7'} {filmIds.length} film{filmIds.length !== 1 ? 's' : ''}
        </Text>

        {isOwnerList && (
          <View style={styles.visibilityRow}>
            <Text style={styles.visibilityLabel}>Public</Text>
            <Switch
              value={list.isPublic !== false}
              onValueChange={handleToggleVisibility}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(200,169,81,0.4)' }}
              thumbColor={list.isPublic !== false ? colors.gold : 'rgba(255,255,255,0.4)'}
            />
          </View>
        )}

        {viewMode === 'graph' ? (
          <View style={styles.arcList}>
            {listFilms.map((f: MockFilm) => (
              <ArcCard
                key={f.id}
                film={f}
                cardWidth={cardWidth}
                onLongPress={() => handleRemoveFilm(f.id, f.title)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.posterGrid}>
            {listFilms.map((f: MockFilm) => (
              <PosterCell
                key={f.id}
                film={f}
                onLongPress={() => handleRemoveFilm(f.id, f.title)}
              />
            ))}
          </View>
        )}

        {listFilms.length === 0 && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No films in this list yet</Text>
          </View>
        )}

        {/* Add films button (owner only) */}
        {isOwnerList && (
          <Pressable
            onPress={() => setShowAddFilm(true)}
            style={styles.addFilmBtn}
          >
            <Text style={styles.addFilmBtnText}>+ Add films</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Add film picker. Hides films already in the list. Picker
          stays open after each tap so user can add multiple films. */}
      <FilmPicker
        visible={showAddFilm}
        onClose={() => setShowAddFilm(false)}
        onSelect={(film) => {
          if (!filmIds.includes(film.id)) handleAddFilm(film.id);
        }}
        filter={(film) => !filmIds.includes(film.id)}
        title="Add film to list"
      />

      {/* Menu bottom sheet */}
      <BottomSheet
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        title="List options"
      >
        <Pressable onPress={handleDeleteList} style={styles.menuRow}>
          <Text style={styles.menuRowDanger}>Delete list</Text>
        </Pressable>
      </BottomSheet>
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
    marginBottom: 10,
    marginLeft: 36,
  },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAD,
    marginLeft: 36,
    marginBottom: 14,
  },
  visibilityLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ivory,
  },

  // Arc cards (graph view)
  arcList: { paddingHorizontal: PAD, gap: 6 },

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
    width: POSTER_W,
    marginTop: 2,
    overflow: 'hidden',
  },

  // Empty
  emptyWrap: { alignItems: 'center', paddingVertical: 40 },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
  },

  // Add film button
  addFilmBtn: {
    marginHorizontal: PAD,
    marginTop: 16,
    paddingVertical: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.25)',
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  addFilmBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.gold,
  },

  // Menu
  menuRow: {
    paddingVertical: 14,
  },
  menuRowDanger: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.negativeRed,
  },
});
