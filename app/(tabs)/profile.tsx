import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Line } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, spacing, borderRadius } from '../../src/constants/theme';
import Sparkline from '../../src/components/Sparkline';
import {
  fetchUserProfile,
  fetchUserFilms,
  fetchUserWatchlist,
} from '../../src/lib/api';
import type { MockUser, MockFilm, MockWatchlistFilm } from '../../src/data/mockProfile';

const SCREEN_WIDTH = Dimensions.get('window').width;
const POSTER_GAP = 8;
const POSTER_COLS = 3;
const POSTER_PAD = 16;
const POSTER_W = (SCREEN_WIDTH - POSTER_PAD * 2 - POSTER_GAP * (POSTER_COLS - 1)) / POSTER_COLS;
const POSTER_H = POSTER_W * 1.5;

type SubTab = 'profile' | 'my-films' | 'lists' | 'watchlist';
type FilmFilter = 'reviewed' | 'watched';
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

function Avatar({ size, initial }: { size: number; initial: string }) {
  const fontSize = size < 48 ? 16 : 20;
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

  return (
    <Pressable
      onPress={() => {
        console.log('[Profile] PosterCell tap:', film.id, '->', `/film/${film.id}`);
        router.push(`/film/${film.id}` as any);
      }}
      style={styles.posterCell}
    >
      <View style={styles.posterImageContainer}>
        {imgError ? (
          <PosterFallback title={film.title} />
        ) : (
          <Image
            source={{ uri: film.posterUrl }}
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
// Graph card (arc view matching Trending Arcs style)
// ---------------------------------------------------------------------------

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function ArcCard({ film }: { film: MockFilm }) {
  const router = useRouter();
  const [imgError, setImgError] = useState(false);
  const cardW = SCREEN_WIDTH - POSTER_PAD * 2;
  // card padding (10) + poster (50) + gaps (10+10) + score (~40) + card padding (10)
  const sparklineWidth = cardW - 130;

  return (
    <Pressable
      onPress={() => {
        console.log('[Profile] ArcCard tap:', film.id, '->', `/film/${film.id}`);
        router.push(`/film/${film.id}` as any);
      }}
      style={[styles.arcCard, { borderLeftWidth: 3, borderLeftColor: hexToRgba(film.dominantColor, 0.5) }]}
    >
      {/* Dominant color gradient accent */}
      <LinearGradient
        colors={[hexToRgba(film.dominantColor, 0.5), 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.arcColorAccent}
      />

      {/* Poster thumbnail */}
      {imgError ? (
        <View style={[styles.arcPoster, styles.arcPosterPlaceholder]} />
      ) : (
        <Image
          source={{ uri: film.posterUrl }}
          style={styles.arcPoster}
          resizeMode="cover"
          onError={() => setImgError(true)}
        />
      )}

      {/* Title + graph */}
      <View style={styles.arcMiddle}>
        <Text style={styles.arcTitle} numberOfLines={1}>{film.title}</Text>
        <Sparkline
          dataPoints={film.sparklineData.map((s) => ({ score: s }))}
          width={sparklineWidth}
          height={50}
          strokeColor={colors.gold}
          strokeWidth={2}
          showAxes
          showMidline
          runtimeMinutes={film.runtime}
          peakDotColor={colors.teal}
          peakDotRadius={3.5}
          lowDotColor="#E24B4A"
          lowDotRadius={3.5}
        />
      </View>

      {/* Score */}
      <Text style={styles.arcScore}>{film.personalScore.toFixed(1)}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Watchlist poster cell
// ---------------------------------------------------------------------------

function WatchlistCell({ film }: { film: MockWatchlistFilm }) {
  const router = useRouter();
  const [imgError, setImgError] = useState(false);

  return (
    <Pressable
      onPress={() => {
        console.log('[Profile] WatchlistCell tap:', film.id, '->', `/film/${film.id}`);
        router.push(`/film/${film.id}` as any);
      }}
      style={styles.posterCell}
    >
      <View style={styles.posterImageContainer}>
        {imgError ? (
          <PosterFallback title={film.title} />
        ) : (
          <Image
            source={{ uri: film.posterUrl }}
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

  const [user, setUser] = useState<MockUser | null>(null);
  const [films, setFilms] = useState<MockFilm[]>([]);
  const [watchlist, setWatchlist] = useState<MockWatchlistFilm[]>([]);

  const [subTab, setSubTab] = useState<SubTab>('profile');
  const [filmFilter, setFilmFilter] = useState<FilmFilter>('reviewed');
  const [viewMode, setViewMode] = useState<ViewMode>('poster');

  useEffect(() => {
    fetchUserProfile().then(setUser);
    fetchUserFilms().then(setFilms);
    fetchUserWatchlist().then(setWatchlist);
  }, []);

  // Navigation helpers from profile hub rows
  const handleRowTap = useCallback(
    (row: string) => {
      console.log('[Profile] Row tap:', row);
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
          console.log('[Profile] Unhandled row:', row);
      }
    },
    [],
  );

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const reviewed = films.filter((f) => f.status === 'reviewed');
  const watched = films.filter((f) => f.status === 'watched' || f.status === 'reviewed');
  const activeFilms = filmFilter === 'reviewed' ? reviewed : watched;

  // -----------------------------------------------------------------------
  // Profile hub (sub-tab: profile)
  // -----------------------------------------------------------------------
  const renderProfileHub = () => {
    const sectionRows: { label: string; count: number }[] = [
      { label: 'Reviewed', count: user.counts.reviewed },
      { label: 'Watched', count: user.counts.watched },
      { label: 'Watchlist', count: user.counts.watchlist },
      { label: 'Lists', count: user.counts.lists },
      { label: 'Following', count: user.stats.following },
      { label: 'Followers', count: user.stats.followers },
    ];

    return (
      <>
        {/* Avatar + username + bio */}
        <View style={styles.avatarSection}>
          <Avatar size={56} initial={user.avatarInitial} />
          <Text style={styles.username}>{user.name}</Text>
          <Text style={styles.bio}>{user.bio}</Text>
        </View>

        {/* Stats card */}
        <View style={styles.statsCard}>
          <Pressable style={styles.statCol} onPress={() => console.log('Films')}>
            <Text style={styles.statNumber}>{user.stats.films}</Text>
            <Text style={styles.statLabel}>Films</Text>
          </Pressable>
          <View style={styles.statDivider} />
          <Pressable style={styles.statCol} onPress={() => console.log('Following')}>
            <Text style={styles.statNumber}>{user.stats.following}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </Pressable>
          <View style={styles.statDivider} />
          <Pressable style={styles.statCol} onPress={() => console.log('Followers')}>
            <Text style={styles.statNumber}>{user.stats.followers}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </Pressable>
        </View>

        {/* Recently viewed */}
        <Text style={styles.sectionLabel}>RECENTLY VIEWED</Text>
        <View style={styles.emptySection}>
          <Text style={styles.emptyText}>
            Once you start browsing, your recently viewed films will appear here
          </Text>
        </View>

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
      {filmFilter === 'reviewed' && viewMode === 'graph' ? (
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
              elements.push(<ArcCard key={f.id} film={f} />);
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
  // Lists (placeholder)
  // -----------------------------------------------------------------------
  const renderLists = () => (
    <View style={styles.listEmptyWrap}>
      <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
        <Path
          d="M4 6h16M4 12h16M4 18h10"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={1.5}
        />
      </Svg>
      <Text style={styles.listEmptyText}>Your lists will appear here</Text>
      <Pressable
        onPress={() => console.log('New list')}
        style={styles.newListButton}
      >
        <Text style={styles.newListText}>New list</Text>
      </Pressable>
    </View>
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
            <Avatar size={44} initial={user.avatarInitial} />
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
  arcCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: borderRadius.lg,
    padding: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.08)',
    overflow: 'hidden',
  },
  arcColorAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  arcPoster: {
    width: 50,
    height: 75,
    minWidth: 50,
    maxWidth: 50,
    borderRadius: 6,
    backgroundColor: '#1a1a2e',
  },
  arcPosterPlaceholder: {
    backgroundColor: 'rgba(30,30,60,0.8)',
  },
  arcMiddle: {
    flex: 1,
  },
  arcTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 14,
    color: colors.ivory,
    marginBottom: 4,
  },
  arcScore: {
    fontFamily: fonts.headingBold,
    fontSize: 20,
    color: colors.gold,
    alignSelf: 'center',
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
});
