import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  TextInput,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Line } from 'react-native-svg';
import { colors, fonts, spacing, borderRadius } from '../../src/constants/theme';
import Sparkline from '../../src/components/Sparkline';
import ArcCard from '../../src/components/ArcCard';
import {
  fetchUserProfile,
  fetchUserFilms,
  fetchUserWatchlist,
  fetchUserLists,
  createUserList,
} from '../../src/lib/api';
import type { MockUser, MockFilm, MockWatchlistFilm } from '../../src/data/mockProfile';
// createList no longer needed - lists are created via API
import BottomSheet from '../../src/components/BottomSheet';
import { useAuth } from '../../src/providers/AuthProvider';
import { getRecentlyViewed } from '../../src/lib/recentlyViewed';

const TMDB_POSTER = 'https://image.tmdb.org/t/p/w185';

function getPosterUri(film: { posterUrl?: string | null; posterPath?: string | null }): string | null {
  const path = film.posterUrl || (film as any).posterPath;
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${TMDB_POSTER}${path}`;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const POSTER_GAP = 8;
const POSTER_COLS = 3;
const POSTER_PAD = 16;
const POSTER_W = (SCREEN_WIDTH - POSTER_PAD * 2 - POSTER_GAP * (POSTER_COLS - 1)) / POSTER_COLS;
const POSTER_H = POSTER_W * 1.5;

type SubTab = 'profile' | 'my-films' | 'lists' | 'watchlist';
type FilmFilter = 'reviewed' | 'watched' | 'reactions';
type ViewMode = 'poster' | 'graph';

// ---------------------------------------------------------------------------
// Gear icon
// ---------------------------------------------------------------------------

function GearIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
        stroke="rgba(245,240,225,0.35)"
        strokeWidth={1.5}
      />
      <Path
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
        stroke="rgba(245,240,225,0.35)"
        strokeWidth={1.5}
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Grid / List icons for view toggle
// ---------------------------------------------------------------------------

function GridIcon({ active }: { active: boolean }) {
  const c = active ? colors.gold : 'rgba(255,255,255,0.4)';
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path d="M1 1h6v6H1zM9 1h6v6H9zM1 9h6v6H1zM9 9h6v6H9z" stroke={c} strokeWidth={1.2} />
    </Svg>
  );
}

function ListIcon({ active }: { active: boolean }) {
  const c = active ? colors.gold : 'rgba(255,255,255,0.4)';
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Line x1={1} y1={3} x2={15} y2={3} stroke={c} strokeWidth={1.5} />
      <Line x1={1} y1={8} x2={15} y2={8} stroke={c} strokeWidth={1.5} />
      <Line x1={1} y1={13} x2={15} y2={13} stroke={c} strokeWidth={1.5} />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Chevron right (for section rows)
// ---------------------------------------------------------------------------

function ChevronRight() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M9 6l6 6-6 6" stroke="rgba(245,240,225,0.15)" strokeWidth={2} />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

function Avatar({ size, initial, imageUrl }: { size: number; initial: string; imageUrl?: string | null }) {
  const fontSize = size < 48 ? 16 : 20;
  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.5,
          borderColor: 'rgba(200,169,81,0.3)',
        }}
      />
    );
  }
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <Text style={[styles.avatarLetter, { fontSize }]}>{initial}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sub-tab bar
// ---------------------------------------------------------------------------

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'my-films', label: 'My films' },
  { key: 'lists', label: 'Lists' },
  { key: 'watchlist', label: 'Watchlist' },
];

function SubTabBar({
  active,
  onSelect,
}: {
  active: SubTab;
  onSelect: (t: SubTab) => void;
}) {
  return (
    <View style={styles.subTabBar}>
      {SUB_TABS.map((t) => (
        <Pressable
          key={t.key}
          onPress={() => onSelect(t.key)}
          style={[styles.subTab, active === t.key && styles.subTabActive]}
        >
          <Text
            style={[
              styles.subTabText,
              active === t.key && styles.subTabTextActive,
            ]}
          >
            {t.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Pill toggle (Watched / Reviewed)
// ---------------------------------------------------------------------------

function PillToggle<T extends string>({
  options,
  active,
  onSelect,
}: {
  options: { key: T; label: string }[];
  active: T;
  onSelect: (k: T) => void;
}) {
  return (
    <View style={styles.pillToggle}>
      {options.map((o) => (
        <Pressable
          key={o.key}
          onPress={() => onSelect(o.key)}
          style={[styles.pill, active === o.key && styles.pillActive]}
        >
          <Text
            style={[styles.pillText, active === o.key && styles.pillTextActive]}
          >
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// View toggle (Grid / List)
// ---------------------------------------------------------------------------

function ViewToggle({
  mode,
  onSelect,
}: {
  mode: ViewMode;
  onSelect: (m: ViewMode) => void;
}) {
  return (
    <View style={styles.pillToggle}>
      <Pressable
        onPress={() => onSelect('poster')}
        style={[styles.iconPill, mode === 'poster' && styles.pillActive]}
      >
        <GridIcon active={mode === 'poster'} />
      </Pressable>
      <Pressable
        onPress={() => onSelect('graph')}
        style={[styles.iconPill, mode === 'graph' && styles.pillActive]}
      >
        <ListIcon active={mode === 'graph'} />
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Poster grid item
// ---------------------------------------------------------------------------

function PosterFallback({ title }: { title: string }) {
  return (
    <View style={styles.posterFallback}>
      <Text style={styles.posterFallbackText} numberOfLines={3}>
        {title}
      </Text>
    </View>
  );
}

function PosterCell({
  film,
  showSparkline,
}: {
  film: MockFilm;
  showSparkline: boolean;
}) {
  const router = useRouter();
  const [imgError, setImgError] = useState(false);
  const posterUri = getPosterUri(film);

  return (
    <Pressable
      onPress={() => router.push(`/film/${film.id}` as any)}
      style={styles.posterCell}
    >
      <View style={styles.posterImageContainer}>
        {imgError || !posterUri ? (
          <PosterFallback title={film.title} />
        ) : (
          <Image
            source={{ uri: posterUri }}
            style={styles.posterImageInner}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        )}
      </View>
      {showSparkline && (
        <>
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
        </>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Watchlist poster cell
// ---------------------------------------------------------------------------

function WatchlistCell({ film }: { film: MockWatchlistFilm }) {
  const router = useRouter();
  const [imgError, setImgError] = useState(false);
  const posterUri = getPosterUri(film);

  return (
    <Pressable
      onPress={() => router.push(`/film/${film.id}` as any)}
      style={styles.posterCell}
    >
      <View style={styles.posterImageContainer}>
        {imgError || !posterUri ? (
          <PosterFallback title={film.title} />
        ) : (
          <Image
            source={{ uri: posterUri }}
            style={styles.posterImageInner}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        )}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user: authUser } = useAuth();

  const [user, setUser] = useState<(MockUser & Record<string, any>) | null>(null);
  const [films, setFilms] = useState<MockFilm[]>([]);
  const [watchlist, setWatchlist] = useState<MockWatchlistFilm[]>([]);
  const [lists, setLists] = useState<any[]>([]);
  const [recentFilmIds, setRecentFilmIds] = useState<string[]>([]);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileError, setProfileError] = useState(false);

  const [subTab, setSubTab] = useState<SubTab>('profile');
  const [filmFilter, setFilmFilter] = useState<FilmFilter>('reviewed');
  const [viewMode, setViewMode] = useState<ViewMode>('poster');

  // List creation modal state
  const [showCreateList, setShowCreateList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListGenre, setNewListGenre] = useState('Drama');
  const [newListFilmIds, setNewListFilmIds] = useState<string[]>([]);
  const [showFilmPicker, setShowFilmPicker] = useState(false);
  const [filmSearchInput, setFilmSearchInput] = useState('');
  const [filmSearch, setFilmSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadProfile = useCallback(() => {
    if (!isAuthenticated) return;
    setProfileError(false);
    fetchUserProfile()
      .then((p) => {
        if (p) {
          setUser({ ...(p.user ?? p), stats: p.stats ?? {} });
        } else {
          // API returned null/empty - fall back to authUser
          if (authUser) {
            setUser({ ...authUser, bio: '', avatarInitial: (authUser.name ?? 'U').charAt(0).toUpperCase(), stats: { films: 0, following: 0, followers: 0 }, counts: { reviewed: 0, watched: 0, watchlist: 0, lists: 0, liveReacted: 0 } } as any);
          }
          console.error('[Profile] fetchUserProfile returned null');
        }
      })
      .catch((e) => {
        console.error('[Profile] fetchUserProfile error:', e);
        // Fall back to authUser so we don't stuck on loading
        if (authUser) {
          setUser({ ...authUser, bio: '', avatarInitial: (authUser.name ?? 'U').charAt(0).toUpperCase(), stats: { films: 0, following: 0, followers: 0 }, counts: { reviewed: 0, watched: 0, watchlist: 0, lists: 0, liveReacted: 0 } } as any);
        } else {
          setProfileError(true);
        }
      })
      .finally(() => setProfileLoaded(true));
    Promise.all([
      fetchUserFilms('reviewed'),
      fetchUserFilms('watched'),
    ])
      .then(([reviewed, watched]) => {
        const all = [...reviewed, ...watched];
        const unique = all.filter((f, i, arr) => arr.findIndex((x) => x.id === f.id) === i);
        setFilms(unique);
      })
      .catch((e) => console.error('[Profile] fetchUserFilms error:', e));
    fetchUserWatchlist().then(setWatchlist).catch((e) => console.error('[Profile] fetchUserWatchlist error:', e));
    fetchUserLists().then(setLists).catch((e) => console.error('[Profile] fetchUserLists error:', e));
    getRecentlyViewed().then((r) => setRecentFilmIds(r.map((x) => x.filmId)));
  }, [isAuthenticated, authUser]);

  useFocusEffect(loadProfile);

  // Navigation helpers from profile hub rows
  const handleRowTap = useCallback(
    (row: string) => {
      switch (row) {
        case 'Reviewed':
          setFilmFilter('reviewed');
          setSubTab('my-films');
          break;
        case 'Watched':
          setFilmFilter('watched');
          setSubTab('my-films');
          break;
        case 'Watchlist':
          setSubTab('watchlist');
          break;
        case 'Lists':
          setSubTab('lists');
          break;
        default:
          break;
      }
    },
    [],
  );

  // Unauthenticated state
  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.unauthWrap}>
          <Text style={styles.unauthLogo}>Cinemagraphs</Text>
          <Text style={styles.unauthText}>Sign in to see your profile</Text>
          <Pressable
            onPress={() => router.push('/(auth)/landing' as any)}
            style={styles.unauthBtn}
          >
            <Text style={styles.unauthBtnText}>Sign in</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!user && !profileLoaded) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.unauthWrap}>
          <Text style={styles.unauthText}>Could not load profile</Text>
          <Pressable onPress={loadProfile} style={styles.unauthBtn}>
            <Text style={styles.unauthBtnText}>Try again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const reviewed = films.filter((f) => f.status === 'reviewed');
  const watched = films.filter((f) => f.status === 'watched' || f.status === 'reviewed');
  const liveReacted = films.filter((f) => f.status === 'live-reacted');
  const activeFilms = filmFilter === 'reviewed' ? reviewed : filmFilter === 'reactions' ? liveReacted : watched;

  // -----------------------------------------------------------------------
  // Profile hub (sub-tab: profile)
  // -----------------------------------------------------------------------
  const renderProfileHub = () => {
    const sectionRows: { label: string; count: number }[] = [
      { label: 'Reviewed', count: user?.counts?.reviewed ?? user?.stats?.reviewCount ?? user?.reviewCount ?? 0 },
      { label: 'Watched', count: user?.counts?.watched ?? user?.stats?.watchedCount ?? user?.watchedCount ?? 0 },
      { label: 'Watchlist', count: user?.counts?.watchlist ?? user?.stats?.watchlistCount ?? user?.watchlistCount ?? 0 },
      { label: 'Lists', count: user?.counts?.lists ?? user?.stats?.listCount ?? user?.listCount ?? 0 },
      { label: 'Following', count: user?.stats?.followingCount ?? user?.stats?.following ?? user?.followingCount ?? 0 },
      { label: 'Followers', count: user?.stats?.followerCount ?? user?.stats?.followers ?? user?.followerCount ?? 0 },
    ];

    return (
      <>
        {/* Avatar + username + bio */}
        <View style={styles.avatarSection}>
          <Avatar size={56} initial={user?.avatarInitial ?? (user?.name ?? 'U').charAt(0).toUpperCase()} imageUrl={authUser?.image ?? user?.image} />
          <Text style={styles.username}>{user?.name ?? ''}</Text>
          <Text style={styles.bio}>{user?.bio ?? ''}</Text>
        </View>

        {/* Stats card */}
        <View style={styles.statsCard}>
          <Pressable style={styles.statCol}>
            <Text style={styles.statNumber}>{(user?.stats?.reviewCount ?? 0) + (user?.stats?.watchedCount ?? 0)}</Text>
            <Text style={styles.statLabel}>Films</Text>
          </Pressable>
          <View style={styles.statDivider} />
          <Pressable style={styles.statCol}>
            <Text style={styles.statNumber}>{user?.stats?.followingCount ?? user?.stats?.following ?? user?.followingCount ?? 0}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </Pressable>
          <View style={styles.statDivider} />
          <Pressable style={styles.statCol}>
            <Text style={styles.statNumber}>{user?.stats?.followerCount ?? user?.stats?.followers ?? user?.followerCount ?? 0}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </Pressable>
        </View>

        {/* Recently viewed */}
        <Text style={styles.sectionLabel}>RECENTLY VIEWED</Text>
        {recentFilmIds.length === 0 ? (
          <View style={styles.emptySection}>
            <Text style={styles.emptyText}>
              Once you start browsing, your recently viewed films will appear here
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.recentScroll}
            contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
          >
            {recentFilmIds.slice(0, 10).map((fid) => {
              const f = films.find((x) => x.id === fid);
              if (!f) return null;
              return (
                <Pressable
                  key={fid}
                  onPress={() => router.push(`/film/${fid}` as any)}
                >
                  <Image
                    source={{ uri: f.posterUrl }}
                    style={styles.recentPoster}
                    resizeMode="cover"
                  />
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Section rows */}
        {sectionRows.map((row, i) => (
          <Pressable
            key={row.label}
            onPress={() => handleRowTap(row.label)}
            style={[
              styles.sectionRow,
              i < sectionRows.length - 1 && styles.sectionRowBorder,
            ]}
          >
            <Text style={styles.sectionRowLabel}>{row.label}</Text>
            <View style={styles.sectionRowRight}>
              <Text style={styles.sectionRowCount}>{row.count}</Text>
              <ChevronRight />
            </View>
          </Pressable>
        ))}
      </>
    );
  };

  // -----------------------------------------------------------------------
  // My Films
  // -----------------------------------------------------------------------
  const renderMyFilms = () => (
    <>
      {/* Filter + view toggle row */}
      <View style={styles.filterRow}>
        <PillToggle
          // TODO: Unhide when live reactions are ready
          // { key: 'reactions' as FilmFilter, label: 'Reactions' },
          options={[
            { key: 'reviewed' as FilmFilter, label: 'Reviewed' },
            { key: 'watched' as FilmFilter, label: 'Watched' },
          ]}
          active={filmFilter}
          onSelect={setFilmFilter}
        />
        {filmFilter === 'reviewed' && (
          <ViewToggle mode={viewMode} onSelect={setViewMode} />
        )}
      </View>

      {/* Content */}
      {filmFilter === 'reactions' ? (
        <View style={styles.posterGrid}>
          {activeFilms.map((f) => (
            <PosterCell key={f.id} film={f} showSparkline={false} />
          ))}
        </View>
      ) : filmFilter === 'reviewed' && viewMode === 'graph' ? (
        <View style={styles.arcList}>
          {(() => {
            const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
            const sorted = [...activeFilms].sort((a, b) => b.dateWatched.localeCompare(a.dateWatched));
            let currentMonth = '';
            const elements: React.ReactElement[] = [];
            sorted.forEach((f) => {
              const [year, month] = f.dateWatched.split('-');
              const monthLabel = `${MONTHS[parseInt(month, 10) - 1]} ${year}`;
              if (monthLabel !== currentMonth) {
                const isFirst = currentMonth === '';
                currentMonth = monthLabel;
                elements.push(
                  <Text
                    key={`month-${monthLabel}`}
                    style={[styles.monthHeader, !isFirst && { marginTop: 16 }]}
                  >
                    {monthLabel}
                  </Text>
                );
              }
              elements.push(<ArcCard key={f.id} film={f} cardWidth={SCREEN_WIDTH - POSTER_PAD * 2} />);
            });
            return elements;
          })()}
        </View>
      ) : (
        <View style={styles.posterGrid}>
          {activeFilms.map((f) => (
            <PosterCell
              key={f.id}
              film={f}
              showSparkline={filmFilter === 'reviewed'}
            />
          ))}
        </View>
      )}
    </>
  );

  // -----------------------------------------------------------------------
  // Lists
  // -----------------------------------------------------------------------
  const GENRE_TAGS = ['Drama', 'Action', 'Horror', 'Sci-Fi', 'Comedy', 'Thriller'];

  const allUniqueFilms = films.filter(
    (f, i, arr) => arr.findIndex((x) => x.id === f.id) === i,
  );

  const filteredPickerFilms = allUniqueFilms.filter((f) =>
    f.title.toLowerCase().includes(filmSearch.toLowerCase()),
  );

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    try {
      console.log('[Profile] Creating list:', newListName.trim(), newListGenre, newListFilmIds);
      const apiList = await createUserList(newListName.trim(), newListGenre, newListFilmIds);
      console.log('[Profile] createUserList returned:', JSON.stringify(apiList).slice(0, 300));
      // API may return { list: {...} } or {...} directly
      const listObj = apiList.list ?? apiList;
      console.log('[Profile] listObj.id:', listObj.id, 'keys:', Object.keys(listObj));
      setLists((prev) => [listObj, ...prev]);
      setShowCreateList(false);
      setNewListName('');
      setNewListGenre('Drama');
      setNewListFilmIds([]);
      setFilmSearchInput('');
      setFilmSearch('');
    } catch (e) {
      console.error('[Profile] createList error:', e);
    }
  };

  const handlePickerSearchChange = (text: string) => {
    setFilmSearchInput(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setFilmSearch(text), 400);
  };

  const toggleFilmInNewList = (filmId: string) => {
    setNewListFilmIds((prev) =>
      prev.includes(filmId) ? prev.filter((id) => id !== filmId) : [...prev, filmId],
    );
  };

  const renderLists = () => (
    <>
      {/* New list button */}
      <Pressable
        onPress={() => setShowCreateList(true)}
        style={styles.createListBtn}
      >
        <Text style={styles.createListText}>+ New list</Text>
      </Pressable>

      {lists.length === 0 ? (
        <View style={styles.listEmptyWrap}>
          <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
            <Path
              d="M4 6h16M4 12h16M4 18h10"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1.5}
            />
          </Svg>
          <Text style={styles.listEmptyText}>Your lists will appear here</Text>
        </View>
      ) : (
        <View style={{ gap: 10, marginTop: 8 }}>
          {lists.map((list) => {
            const filmIds = list.filmIds ?? (list.films ?? []).map((f: any) => f.id ?? f.filmId);
            const listFilms = filmIds
              .map((fid: string) => allUniqueFilms.find((f) => f.id === fid))
              .filter(Boolean) as MockFilm[];
            return (
              <Pressable
                key={list.id}
                onPress={() => router.push(`/list/${list.id}` as any)}
                style={styles.listCard}
              >
                {/* Poster strip */}
                <View style={styles.listPosterStrip}>
                  {(list.previewPosters ?? []).slice(0, 4).map((p: string, i: number) => (
                    <Image
                      key={i}
                      source={{ uri: p.startsWith('/') ? 'https://image.tmdb.org/t/p/w185' + p : p }}
                      style={styles.listThumb}
                      resizeMode="cover"
                    />
                  ))}
                  {(!list.previewPosters || list.previewPosters.length === 0) && (
                    <View style={[styles.listThumb, { backgroundColor: 'rgba(30,30,60,0.6)' }]} />
                  )}
                </View>
                {/* Info */}
                <View style={styles.listCardInfo}>
                  <Text style={styles.listCardName} numberOfLines={1}>
                    {list.name}
                  </Text>
                  <Text style={styles.listCardMeta}>
                    {list.genreTag} {'\u00B7'} {(list.filmCount ?? filmIds.length)} film{(list.filmCount ?? filmIds.length) !== 1 ? 's' : ''}
                  </Text>
                </View>
                <ChevronRight />
              </Pressable>
            );
          })}
        </View>
      )}
    </>
  );

  // -----------------------------------------------------------------------
  // Watchlist
  // -----------------------------------------------------------------------
  const renderWatchlist = () => {
    if (watchlist.length === 0) {
      return (
        <View style={styles.listEmptyWrap}>
          <Text style={styles.listEmptyText}>Save films to watch later</Text>
          <Pressable
            onPress={() => router.push('/(tabs)/search' as any)}
            style={styles.browseButton}
          >
            <Text style={styles.browseText}>Browse films</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.posterGrid}>
        {watchlist.map((f) => (
          <WatchlistCell key={f.id} film={f} />
        ))}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 80 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header - same on every sub-tab */}
        <View style={styles.collapsedHeader}>
          <View style={[styles.collapsedCenter, subTab === 'profile' && { opacity: 0 }]}>
            <Avatar size={44} initial={user.avatarInitial} imageUrl={authUser?.image ?? user?.image} />
            <Text style={styles.collapsedName}>{user.name}</Text>
          </View>
          <Pressable
            onPress={() => router.push('/settings' as any)}
            style={styles.collapsedGear}
          >
            <GearIcon />
          </Pressable>
        </View>

        {/* Sub-tabs - never moves */}
        <SubTabBar active={subTab} onSelect={setSubTab} />

        {/* Content */}
        {subTab === 'profile' && renderProfileHub()}
        {subTab === 'my-films' && renderMyFilms()}
        {subTab === 'lists' && renderLists()}
        {subTab === 'watchlist' && renderWatchlist()}
      </ScrollView>

      {/* ---- Create List Bottom Sheet ---- */}
      <BottomSheet
        visible={showCreateList && !showFilmPicker}
        onClose={() => setShowCreateList(false)}
        title="New list"
      >
        {/* Name */}
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

        {/* Genre tag */}
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

        {/* Films */}
        <Text style={[styles.sheetLabel, { marginTop: 14 }]}>ADD FILMS</Text>
        <View style={styles.filmChipRow}>
          {newListFilmIds.map((id) => {
            const f = allUniqueFilms.find((x) => x.id === id);
            if (!f) return null;
            return (
              <Pressable key={id} onPress={() => toggleFilmInNewList(id)}>
                <Image
                  source={{ uri: f.posterUrl }}
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

        {/* Create button */}
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

      {/* ---- Film Picker Bottom Sheet ---- */}
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
                  source={{ uri: f.posterUrl }}
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
  scrollContent: {
    paddingHorizontal: POSTER_PAD,
  },
  loadingText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(245,240,225,0.4)',
    textAlign: 'center',
    marginTop: 40,
  },

  // ---- Header (all sub-tabs) ----
  collapsedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 12,
    minHeight: 70,
  },
  collapsedCenter: {
    alignItems: 'center',
    gap: 4,
  },
  collapsedGear: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 44,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  collapsedName: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ivory,
  },

  // ---- Avatar ----
  avatar: {
    backgroundColor: 'rgba(200,169,81,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(200,169,81,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    fontFamily: fonts.bodyMedium,
    color: colors.gold,
  },

  // ---- Avatar + username + bio (hub) ----
  avatarSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  username: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.ivory,
    marginTop: 6,
  },
  bio: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: 'rgba(245,240,225,0.4)',
    marginTop: 2,
  },

  // ---- Stats card ----
  statsCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.08)',
    borderRadius: borderRadius.lg,
    paddingVertical: 12,
    marginBottom: 16,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontFamily: fonts.bodyMedium,
    fontSize: 18,
    color: colors.ivory,
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 2,
  },
  statDivider: {
    width: 0.5,
    backgroundColor: 'rgba(200,169,81,0.12)',
    marginVertical: 4,
  },

  // ---- Sub-tab bar ----
  subTabBar: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
  },
  subTab: {
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  subTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.gold,
  },
  subTabText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
  },
  subTabTextActive: {
    fontFamily: fonts.bodyMedium,
    color: colors.gold,
  },

  // ---- Section label ----
  sectionLabel: {
    fontSize: 9,
    color: 'rgba(245,240,225,0.3)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontFamily: fonts.body,
    marginBottom: 8,
  },

  // ---- Empty section ----
  emptySection: {
    paddingVertical: 40,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.25)',
    textAlign: 'center',
    paddingHorizontal: 24,
  },

  // ---- Section rows ----
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  sectionRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(245,240,225,0.04)',
  },
  sectionRowLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ivory,
  },
  sectionRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionRowCount: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(245,240,225,0.3)',
  },

  // ---- Pill toggle ----
  pillToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 6,
    padding: 2,
  },
  pill: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  pillActive: {
    backgroundColor: 'rgba(200,169,81,0.2)',
  },
  pillText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  pillTextActive: {
    fontFamily: fonts.bodyMedium,
    color: colors.gold,
  },
  iconPill: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 4,
  },

  // ---- Filter row ----
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  // ---- Poster grid ----
  posterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: POSTER_GAP,
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

  // ---- Arc card (trending arcs style) ----
  arcList: {
    gap: 10,
  },
  monthHeader: {
    fontFamily: fonts.headingBold,
    fontSize: 14,
    color: colors.gold,
    marginBottom: 8,
  },
  // ---- Lists empty ----
  listEmptyWrap: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  listEmptyText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
  },
  newListButton: {
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.2)',
    borderRadius: borderRadius.md,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  newListText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(200,169,81,0.3)',
  },
  browseButton: {
    backgroundColor: 'rgba(45,212,168,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(45,212,168,0.2)',
    borderRadius: borderRadius.md,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  browseText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.teal,
  },

  // ---- Lists (real) ----
  createListBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.gold,
    borderRadius: borderRadius.md,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  createListText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.background,
  },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.08)',
    borderRadius: borderRadius.xl,
    padding: 10,
    gap: 10,
  },
  listPosterStrip: {
    flexDirection: 'row',
    gap: 4,
  },
  listThumb: {
    width: 36,
    height: 52,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.1)',
    backgroundColor: 'rgba(30,30,60,0.6)',
  },
  listCardInfo: {
    flex: 1,
    gap: 2,
  },
  listCardName: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ivory,
  },
  listCardMeta: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: 'rgba(245,240,225,0.4)',
  },

  // ---- Bottom sheet form ----
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
    borderRadius: borderRadius.md,
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
    borderRadius: borderRadius.md,
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

  // Unauthenticated state
  unauthWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  unauthLogo: {
    fontFamily: fonts.heading,
    fontSize: 26,
    color: colors.gold,
  },
  unauthText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(245,240,225,0.5)',
  },
  unauthBtn: {
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 36,
    marginTop: 4,
  },
  unauthBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.background,
  },

  // Recently viewed
  recentScroll: {
    marginBottom: 16,
  },
  recentPoster: {
    width: 60,
    height: 90,
    borderRadius: 6,
    backgroundColor: 'rgba(245,240,225,0.06)',
  },
});
