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
  Switch,
  BackHandler,
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
import {
  PROFILE_FIXTURES,
  PROFILE_FIXTURE_MODE,
  type MockUser,
  type MockFilm,
  type MockWatchlistFilm,
} from '../../src/data/mockProfile';
import type { BannerPresetKey } from '../../src/constants/bannerPresets';
import type { Film } from '../../src/types/film';
// createList no longer needed - lists are created via API
import BottomSheet from '../../src/components/BottomSheet';
import FilmPicker from '../../src/components/FilmPicker';
import FollowersModal from '../../src/components/FollowersModal';
import ProfileBanner from '../../src/components/profile/ProfileBanner';
import ProfileAvatar from '../../src/components/profile/ProfileAvatar';
import ProfileIdentity from '../../src/components/profile/ProfileIdentity';
import ProfileStats from '../../src/components/profile/ProfileStats';
import SectionHeader from '../../src/components/profile/SectionHeader';
import FavoritesStrip from '../../src/components/profile/FavoritesStrip';
import RecentReviewsRow from '../../src/components/profile/RecentReviewsRow';
import ListsPreview from '../../src/components/profile/ListsPreview';
import { useAuth } from '../../src/providers/AuthProvider';
import { getRecentlyViewed, type RecentFilm } from '../../src/lib/recentlyViewed';
import { getPosterUrl } from '../../src/lib/tmdb-image';

// Phase 5 mock fixtures live in src/data/mockProfile.ts so the picker
// (app/header-picker.tsx) and this screen share a single source.
// TODO PR 1a / post-auth: replace fixture consumption with real API
// (fetchUserProfile / fetchUserFilms / fetchUserLists) when the web ships
// the new profile contract.
const fixture = PROFILE_FIXTURES[PROFILE_FIXTURE_MODE];

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
//
// Hidden in PR 1a redesign. Legacy sub-tabs are reachable via "All ->" on
// the new hub. Watchlist sub-tab is currently orphaned (no UI entry point);
// will be re-wired as a pinned list on the Lists screen in PR 3. Definition
// is kept in case rollback is needed during the PR 1a rollout.
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
  const posterUri = getPosterUrl(film, 'grid');

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
              height={44}
              strokeColor="#C8A951"
              strokeWidth={1.2}
              showAxes
              showMidline
              hideLabels
              dynamicYAxis
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
  const posterUri = getPosterUrl(film, 'grid');

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
  const [recentFilms, setRecentFilms] = useState<RecentFilm[]>([]);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileError, setProfileError] = useState(false);

  const [subTab, setSubTab] = useState<SubTab>('profile');
  const [filmFilter, setFilmFilter] = useState<FilmFilter>('reviewed');
  const [viewMode, setViewMode] = useState<ViewMode>('poster');

  // List creation modal state
  const [showCreateList, setShowCreateList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListGenre, setNewListGenre] = useState('Drama');
  const [newListPublic, setNewListPublic] = useState(true);
  const [newListFilmIds, setNewListFilmIds] = useState<string[]>([]);
  const [showFilmPicker, setShowFilmPicker] = useState(false);
  // Cache of films picked via FilmPicker, keyed by id. Used so the
  // chip row in the New List sheet can render posters for films
  // outside the user's reviewed/watched set. Reset on list create.
  const [pickedFilmsById, setPickedFilmsById] = useState<Record<string, Film>>({});

  // Followers modal state
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [followersInitialTab, setFollowersInitialTab] = useState<'followers' | 'following'>('followers');

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
            setUser({ ...authUser, image: authUser?.image ?? null, bio: '', avatarInitial: (authUser.name ?? 'U').charAt(0).toUpperCase(), stats: { films: 0, following: 0, followers: 0 }, counts: { reviewed: 0, watched: 0, watchlist: 0, lists: 0, liveReacted: 0 } } as any);
          }
          console.error('[Profile] fetchUserProfile returned null');
        }
      })
      .catch((e) => {
        console.error('[Profile] fetchUserProfile error:', e);
        // Fall back to authUser so we don't stuck on loading
        if (authUser) {
          setUser({ ...authUser, image: authUser?.image ?? null, bio: '', avatarInitial: (authUser.name ?? 'U').charAt(0).toUpperCase(), stats: { films: 0, following: 0, followers: 0 }, counts: { reviewed: 0, watched: 0, watchlist: 0, lists: 0, liveReacted: 0 } } as any);
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
        // Normalize API fields to match MockFilm shape
        const normalize = (raw: any, status: string) => ({
          ...raw,
          id: raw.id,
          title: raw.title ?? '',
          posterUrl: raw.posterUrl ?? '',
          personalScore: raw.reviewScore ?? 0,
          score: raw.reviewScore ?? 0,
          sparklineData: Array.isArray(raw.sparkline) ? raw.sparkline.map((dp: any) => dp.score) : [],
          dateWatched: raw.reviewDate ?? '',
          status,
          year: raw.year ?? 0,
          runtime: raw.runtime ?? (Array.isArray(raw.sparkline) && raw.sparkline.length > 0 ? raw.sparkline[raw.sparkline.length - 1]?.timeEnd ?? 0 : 0),
          genres: raw.genres ?? [],
          dominantColor: raw.dominantColor ?? '#2E4057',
        });
        const taggedReviewed = reviewed.map((f: any) => normalize(f, 'reviewed'));
        const taggedWatched = watched.map((f: any) => normalize(f, 'watched'));
        const all = [...taggedReviewed, ...taggedWatched];
        const unique = all.filter((f, i, arr) => arr.findIndex((x) => x.id === f.id) === i);
        setFilms(unique);
      })
      .catch((e) => console.error('[Profile] fetchUserFilms error:', e));
    fetchUserWatchlist().then(setWatchlist).catch((e) => console.error('[Profile] fetchUserWatchlist error:', e));
    fetchUserLists().then(setLists).catch((e) => console.error('[Profile] fetchUserLists error:', e));
    getRecentlyViewed().then(setRecentFilms);
  }, [isAuthenticated, authUser]);

  useFocusEffect(loadProfile);

  // Hardware back on legacy sub-tabs returns to the new hub instead of
  // exiting the Profile tab. iOS swipe-back is route-level (handled by
  // expo-router) so it cannot intercept internal sub-tab state in PR 1a;
  // PR 3 lifts Lists/Watchlist into their own routes and resolves that.
  useEffect(() => {
    if (subTab === 'profile') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSubTab('profile');
      return true;
    });
    return () => sub.remove();
  }, [subTab]);

  console.log('[Profile] authUser?.image:', authUser?.image);

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
  //
  // @deprecated PR 1a: replaced by inline JSX in the main return that
  // composes ProfileBanner / ProfileAvatar / ProfileIdentity / ProfileStats
  // / FavoritesStrip / RecentReviewsRow / ListsPreview. Kept here as a
  // rollback safety net during the PR 1a rollout; safe to delete in PR 1c.
  // -----------------------------------------------------------------------
  const renderProfileHub = () => {
    const sectionRows: { label: string; count: number }[] = [
      { label: 'Reviewed', count: user?.counts?.reviewed ?? user?.stats?.reviewCount ?? user?.reviewCount ?? 0 },
      // TODO: Unhide when watched/ticket stub feature is enabled
      // { label: 'Watched', count: user?.counts?.watched ?? user?.stats?.watchedCount ?? user?.watchedCount ?? 0 },
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
            <Text style={styles.statNumber}>{user?.stats?.reviewCount ?? 0}</Text>
            <Text style={styles.statLabel}>Films</Text>
          </Pressable>
          <View style={styles.statDivider} />
          <Pressable style={styles.statCol} onPress={() => { setFollowersInitialTab('following'); setShowFollowersModal(true); }}>
            <Text style={styles.statNumber}>{user?.stats?.followingCount ?? user?.stats?.following ?? user?.followingCount ?? 0}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </Pressable>
          <View style={styles.statDivider} />
          <Pressable style={styles.statCol} onPress={() => { setFollowersInitialTab('followers'); setShowFollowersModal(true); }}>
            <Text style={styles.statNumber}>{user?.stats?.followerCount ?? user?.stats?.followers ?? user?.followerCount ?? 0}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </Pressable>
        </View>

        {/* Recently viewed */}
        <Text style={styles.sectionLabel}>RECENTLY VIEWED</Text>
        {recentFilms.length === 0 ? (
          <View style={styles.emptySection}>
            <Text style={styles.emptyText}>
              No recently viewed films
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.recentScroll}
            contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
          >
            {recentFilms.slice(0, 6).map((rf) => {
              const uri = getPosterUrl(rf, 'card') ?? undefined;
              return (
                <Pressable
                  key={rf.filmId}
                  onPress={() => router.push(`/film/${rf.filmId}` as any)}
                >
                  <Image
                    source={{ uri }}
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
        {/* TODO: Unhide Watched/Reviewed toggle when watched feature is enabled */}
        <View />
        <ViewToggle mode={viewMode} onSelect={setViewMode} />
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
              elements.push(
                <View key={f.id} style={{ position: 'relative' }}>
                  <ArcCard film={f} cardWidth={SCREEN_WIDTH - POSTER_PAD * 2} />
                  <Text style={styles.arcScore}>{f.personalScore.toFixed(1)}</Text>
                </View>
              );
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

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    try {
      console.log('[Profile] Creating list:', newListName.trim(), newListGenre, newListFilmIds, newListPublic);
      const apiList = await createUserList(newListName.trim(), newListGenre, newListFilmIds, newListPublic);
      console.log('[Profile] createUserList returned:', JSON.stringify(apiList).slice(0, 300));
      // API may return { list: {...} } or {...} directly
      const listObj = apiList.list ?? apiList;
      console.log('[Profile] listObj.id:', listObj.id, 'keys:', Object.keys(listObj));
      setLists((prev) => [listObj, ...prev]);
      setShowCreateList(false);
      setNewListName('');
      setNewListGenre('Drama');
      setNewListPublic(true);
      setNewListFilmIds([]);
      setPickedFilmsById({});
    } catch (e) {
      console.error('[Profile] createList error:', e);
    }
  };

  const togglePickedFilm = (film: Film) => {
    setNewListFilmIds((prev) =>
      prev.includes(film.id) ? prev.filter((id) => id !== film.id) : [...prev, film.id],
    );
    setPickedFilmsById((prev) => {
      if (prev[film.id]) return prev;
      return { ...prev, [film.id]: film };
    });
  };

  const removePickedFilm = (filmId: string) => {
    setNewListFilmIds((prev) => prev.filter((id) => id !== filmId));
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
                      source={{ uri: getPosterUrl({ posterUrl: p }, 'thumbnail') ?? undefined }}
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
      {subTab === 'profile' ? (
        <ScrollView
          style={{ flex: 1, backgroundColor: colors.background }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          showsVerticalScrollIndicator={false}
        >
          <ProfileBanner
            presetKey={fixture.user.bannerValue as BannerPresetKey}
            onEditPress={() => router.push('/header-picker' as any)}
          />

          <View
            style={{
              marginTop: -42,
              paddingHorizontal: 20,
              zIndex: 2,
              alignItems: 'flex-start',
            }}
          >
            <ProfileAvatar
              name={fixture.user.name}
              image={fixture.user.image}
            />
          </View>

          <ProfileIdentity
            name={fixture.user.name}
            username={fixture.user.username}
            bio={fixture.user.bio}
            onBioPlaceholderPress={() => router.push('/settings/edit-profile' as any)}
          />

          <ProfileStats
            reviewed={fixture.stats.reviewCount}
            following={fixture.stats.followingCount}
            followers={fixture.stats.followerCount}
            onPressFollowing={() => {
              setFollowersInitialTab('following');
              setShowFollowersModal(true);
            }}
            onPressFollowers={() => {
              setFollowersInitialTab('followers');
              setShowFollowersModal(true);
            }}
          />

          <SectionHeader title="FAVORITE FILMS" />
          <FavoritesStrip
            favorites={fixture.favoriteFilms}
            onAddFavorite={() => {
              // No-op for PR 1a; favorite editing ships in PR 9 (post-auth).
            }}
            onPressFilm={(filmId) => router.push(`/film/${filmId}` as any)}
          />

          <SectionHeader
            title="RECENT REVIEWS"
            allLink={
              fixture.recentReviews.length > 0
                ? { label: 'All →', onPress: () => setSubTab('my-films') }
                : undefined
            }
          />
          <RecentReviewsRow
            reviews={fixture.recentReviews}
            onPressReview={(filmId) => router.push(`/film/${filmId}` as any)}
            onFindFilm={() => router.push('/(tabs)/search' as any)}
          />

          <SectionHeader
            title="LISTS"
            allLink={
              fixture.lists.length > 0
                ? { label: 'All →', onPress: () => setSubTab('lists') }
                : undefined
            }
          />
          <ListsPreview
            lists={fixture.lists}
            onPressList={(listId) => router.push(`/list/${listId}` as any)}
            onCreateList={() => setShowCreateList(true)}
          />
        </ScrollView>
      ) : (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={styles.legacyHeader}>
            <Pressable
              onPress={() => setSubTab('profile')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Back to profile"
            >
              <Text style={styles.legacyHeaderChevron}>‹</Text>
            </Pressable>
            <Text style={styles.legacyHeaderTitle}>
              {subTab === 'my-films'
                ? 'My films'
                : subTab === 'lists'
                ? 'Lists'
                : 'Watchlist'}
            </Text>
          </View>
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + 80 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {subTab === 'my-films' && renderMyFilms()}
            {subTab === 'lists' && renderLists()}
            {subTab === 'watchlist' && renderWatchlist()}
          </ScrollView>
        </View>
      )}

      {/* Floating Settings affordance over the new hub. Placed top-left to
          avoid colliding with the banner pen icon at top-right. */}
      {subTab === 'profile' && (
        <Pressable
          onPress={() => router.push('/settings' as any)}
          style={[styles.hubGear, { top: insets.top + 14 }]}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          hitSlop={8}
        >
          <GearIcon />
        </Pressable>
      )}

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

        {/* Public toggle */}
        <View style={styles.publicToggleRow}>
          <Text style={styles.publicToggleLabel}>Public</Text>
          <Switch
            value={newListPublic}
            onValueChange={setNewListPublic}
            trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(200,169,81,0.4)' }}
            thumbColor={newListPublic ? colors.gold : 'rgba(255,255,255,0.4)'}
          />
        </View>
        <Text style={styles.publicToggleHint}>Public lists appear on your profile</Text>

        {/* Films */}
        <Text style={[styles.sheetLabel, { marginTop: 14 }]}>ADD FILMS</Text>
        <View style={styles.filmChipRow}>
          {newListFilmIds.map((id) => {
            const f = allUniqueFilms.find((x) => x.id === id) ?? pickedFilmsById[id];
            if (!f) return null;
            const posterUri = getPosterUrl(f, 'thumbnail');
            return (
              <Pressable key={id} onPress={() => removePickedFilm(id)}>
                <Image
                  source={{ uri: posterUri ?? undefined }}
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

      {/* ---- Followers Modal ---- */}
      {authUser?.id && (
        <FollowersModal
          visible={showFollowersModal}
          onClose={() => setShowFollowersModal(false)}
          userId={authUser.id}
          initialTab={followersInitialTab}
        />
      )}

      {/* ---- Film Picker (multi-select for create-list flow) ---- */}
      <FilmPicker
        visible={showFilmPicker}
        onClose={() => setShowFilmPicker(false)}
        onSelect={togglePickedFilm}
        selectedIds={new Set(newListFilmIds)}
        title="Add films"
      />
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
    color: '#C8A951',
    textAlign: 'center',
    marginTop: 2,
  },

  // ---- Arc card (trending arcs style) ----
  arcList: {
    gap: 10,
  },
  monthHeader: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.gold,
    marginBottom: 8,
    letterSpacing: -0.1,
  },
  arcScore: {
    position: 'absolute',
    top: 8,
    right: 12,
    fontFamily: fonts.bodySemiBold,
    fontSize: 20,
    color: colors.gold,
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
  publicToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  publicToggleLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ivory,
  },
  publicToggleHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(245,240,225,0.3)',
    marginTop: 4,
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

  // Unauthenticated state
  unauthWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  unauthLogo: {
    fontFamily: fonts.bodyBold,
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

  // ---- Legacy sub-tab back-chevron header (PR 1a) ----
  legacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(245,240,225,0.06)',
  },
  legacyHeaderChevron: {
    fontSize: 22,
    color: colors.ivory,
    fontWeight: '300',
  },
  legacyHeaderTitle: {
    marginLeft: 12,
    fontSize: 16,
    fontFamily: fonts.bodySemiBold,
    color: colors.ivory,
  },

  // ---- Floating gear icon over the new hub (PR 1a) ----
  hubGear: {
    position: 'absolute',
    left: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: 'rgba(245,240,225,0.2)',
    backgroundColor: 'rgba(13,13,26,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
});
